import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export const POMODORO_BACKGROUND_TASK = 'pomodoro-background-task';

// Define the background task
TaskManager.defineTask(POMODORO_BACKGROUND_TASK, async () => {
  try {
    // This task runs periodically when app is in background
    // We use it mainly to schedule notifications
    // The actual timer state is managed by startedAt timestamp
    console.log('Background task executed');
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundTask(): Promise<void> {
  try {
    await BackgroundFetch.registerTaskAsync(POMODORO_BACKGROUND_TASK, {
      minimumInterval: 60, // 1 minute minimum
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log('Background task registered');
  } catch (error) {
    console.error('Failed to register background task:', error);
  }
}

export async function unregisterBackgroundTask(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(POMODORO_BACKGROUND_TASK);
    console.log('Background task unregistered');
  } catch (error) {
    console.error('Failed to unregister background task:', error);
  }
}

// Schedule a notification for when the timer should complete
export async function scheduleTimerNotification(
  phase: 'focus' | 'short_break' | 'long_break',
  remainingSeconds: number,
  options?: { soundEnabled?: boolean; vibrationEnabled?: boolean }
): Promise<void> {
  if (remainingSeconds <= 0) return;

  const existingId = await loadScheduledNotificationId();
  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId);
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
  const triggerDate = new Date(Date.now() + remainingSeconds * 1000);

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
      sound: soundEnabled ? 'timer-complete.wav' : false,
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
  const existingId = await loadScheduledNotificationId();
  if (!existingId) return;
  await Notifications.cancelScheduledNotificationAsync(existingId);
  await storeScheduledNotificationId(null);
}
