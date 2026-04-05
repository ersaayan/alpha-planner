import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const COMPLETION_CHANNELS = {
  soundVibrate: 'pomodoro',
  soundOnly: 'pomodoro-sound',
  vibrateOnly: 'pomodoro-vibrate',
  silent: 'pomodoro-silent',
};

let scheduledTimerNotificationId: string | null = null;
const SCHEDULED_NOTIFICATION_STORAGE_KEY = 'pomodoro:scheduledTimerNotificationId';

async function loadScheduledNotificationId(): Promise<string | null> {
  if (scheduledTimerNotificationId) return scheduledTimerNotificationId;
  try {
    const stored = await AsyncStorage.getItem(SCHEDULED_NOTIFICATION_STORAGE_KEY);
    if (stored) {
      scheduledTimerNotificationId = stored;
      return stored;
    }
  } catch (error) {
    console.warn('Failed to read scheduled notification id', error);
  }
  return null;
}

async function storeScheduledNotificationId(id: string | null): Promise<void> {
  scheduledTimerNotificationId = id;
  try {
    if (id) {
      await AsyncStorage.setItem(SCHEDULED_NOTIFICATION_STORAGE_KEY, id);
    } else {
      await AsyncStorage.removeItem(SCHEDULED_NOTIFICATION_STORAGE_KEY);
    }
  } catch (error) {
    console.warn('Failed to store scheduled notification id', error);
  }
}


/**
 * Schedule a notification for when the timer should complete.
 * Accepts either an absolute completionTimeMs timestamp or remainingSeconds (legacy).
 */
export async function scheduleTimerNotification(
  phase: 'focus' | 'short_break' | 'long_break',
  timeValue: number,
  options?: { soundEnabled?: boolean; vibrationEnabled?: boolean; isAbsoluteMs?: boolean }
): Promise<void> {
  // Determine trigger date from absolute timestamp or remaining seconds
  const isAbsolute = options?.isAbsoluteMs ?? false;
  const triggerDate = isAbsolute
    ? new Date(timeValue)
    : new Date(Date.now() + timeValue * 1000);

  // Don't schedule if already in the past
  if (triggerDate.getTime() <= Date.now()) return;

  const existingId = await loadScheduledNotificationId();
  if (existingId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(existingId);
    } catch {
      // Notification may have already fired or expired
    }
    await storeScheduledNotificationId(null);
  }

  const messages = {
    focus: {
      title: 'Focus Complete! 🎯',
      body: 'Great work! Time for a break.',
    },
    short_break: {
      title: 'Break Over! ☕',
      body: 'Ready to focus again?',
    },
    long_break: {
      title: 'Long Break Over! 🌟',
      body: 'Feeling refreshed? Let\'s get back to work!',
    },
  };

  const message = messages[phase];

  const soundEnabled = options?.soundEnabled ?? true;
  const vibrationEnabled = options?.vibrationEnabled ?? true;

  const channelId =
    soundEnabled && vibrationEnabled
      ? COMPLETION_CHANNELS.soundVibrate
      : soundEnabled
        ? COMPLETION_CHANNELS.soundOnly
        : vibrationEnabled
          ? COMPLETION_CHANNELS.vibrateOnly
          : COMPLETION_CHANNELS.silent;

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: message.title,
      body: message.body,
      sound: soundEnabled ? 'timer_complete.wav' : false,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      ...(Platform.OS === 'android' && {
        channelId,
      }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  await storeScheduledNotificationId(identifier);
}

export async function cancelScheduledTimerNotifications(): Promise<void> {
  try {
    const existingId = await loadScheduledNotificationId();
    if (!existingId) return;
    await Notifications.cancelScheduledNotificationAsync(existingId);
  } catch (error) {
    console.warn('[PomodoroTask] Failed to cancel scheduled timer notification:', error);
  } finally {
    await storeScheduledNotificationId(null);
  }
}
