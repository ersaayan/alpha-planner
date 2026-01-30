import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Timer notification ID for updating
const TIMER_NOTIFICATION_ID = 'pomodoro-timer-ongoing';
const TIMER_CATEGORY_ID = 'pomodoro-timer-actions';

const COMPLETION_CHANNELS = {
  soundVibrate: 'pomodoro',
  soundOnly: 'pomodoro-sound',
  vibrateOnly: 'pomodoro-vibrate',
  silent: 'pomodoro-silent',
};

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationConfig {
  title: string;
  body: string;
  sound?: boolean;
  vibrate?: boolean;
}

// Callback types for notification actions
type NotificationActionCallback = {
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
};

class NotificationService {
  private hasPermission = false;
  private actionCallbacks: NotificationActionCallback = {};
  private responseSubscription: Notifications.EventSubscription | null = null;

  async initialize(): Promise<boolean> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    this.hasPermission = finalStatus === 'granted';

    if (Platform.OS === 'android') {
      // Completion channels for sound/vibration combinations
      await Notifications.setNotificationChannelAsync(COMPLETION_CHANNELS.soundVibrate, {
        name: 'Pomodoro Timer',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#5A7868',
        sound: 'timer_complete.wav',
      });

      await Notifications.setNotificationChannelAsync(COMPLETION_CHANNELS.soundOnly, {
        name: 'Pomodoro Timer (Sound Only)',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: null,
        lightColor: '#5A7868',
        sound: 'timer_complete.wav',
      });

      await Notifications.setNotificationChannelAsync(COMPLETION_CHANNELS.vibrateOnly, {
        name: 'Pomodoro Timer (Vibrate Only)',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#5A7868',
        sound: null,
      });

      await Notifications.setNotificationChannelAsync(COMPLETION_CHANNELS.silent, {
        name: 'Pomodoro Timer (Silent)',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: null,
        lightColor: '#5A7868',
        sound: null,
      });

      // Ongoing timer notification channel (low importance = no sound/vibration)
      await Notifications.setNotificationChannelAsync('pomodoro-ongoing', {
        name: 'Timer Progress',
        importance: Notifications.AndroidImportance.LOW,
        vibrationPattern: null,
        lightColor: '#5A7868',
        sound: null,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    // Set up notification category with actions
    await this.setupNotificationCategory();

    // Listen for notification action responses
    this.setupResponseListener();

    return this.hasPermission;
  }

  // Set up notification category with interactive actions
  private async setupNotificationCategory(): Promise<void> {
    await Notifications.setNotificationCategoryAsync(TIMER_CATEGORY_ID, [
      {
        identifier: 'pause',
        buttonTitle: '⏸ Pause',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'stop',
        buttonTitle: '⏹ Stop',
        options: {
          opensAppToForeground: false,
          isDestructive: true,
        },
      },
    ]);
  }

  // Set up listener for notification action responses
  private setupResponseListener(): void {
    if (this.responseSubscription) {
      this.responseSubscription.remove();
    }

    this.responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const actionId = response.actionIdentifier;

      if (actionId === 'pause') {
        this.actionCallbacks.onPause?.();
      } else if (actionId === 'resume') {
        this.actionCallbacks.onResume?.();
      } else if (actionId === 'stop') {
        this.actionCallbacks.onStop?.();
      }
    });
  }

  // Register callbacks for notification actions
  setActionCallbacks(callbacks: NotificationActionCallback): void {
    this.actionCallbacks = callbacks;
  }

  // Format seconds to MM:SS
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Show ongoing timer notification with countdown
  async showTimerNotification(
    phase: 'focus' | 'short_break' | 'long_break',
    remainingSeconds: number,
    totalSeconds: number,
    isPaused: boolean = false
  ): Promise<void> {
    if (!this.hasPermission) return;

    const phaseLabels = {
      focus: '🎯 Focus Time',
      short_break: '☕ Short Break',
      long_break: '🌟 Long Break',
    };

    const progress = Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100);

    // Calculate when the timer will end (for Android chronometer)
    const endTime = Date.now() + remainingSeconds * 1000;

    // Update category based on paused state
    await Notifications.setNotificationCategoryAsync(TIMER_CATEGORY_ID, [
      {
        identifier: isPaused ? 'resume' : 'pause',
        buttonTitle: isPaused ? '▶️ Resume' : '⏸ Pause',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'stop',
        buttonTitle: '⏹ Stop',
        options: {
          opensAppToForeground: false,
          isDestructive: true,
        },
      },
    ]);

    const statusText = isPaused ? '⏸ PAUSED' : `${this.formatTime(remainingSeconds)} remaining`;

    await Notifications.scheduleNotificationAsync({
      identifier: TIMER_NOTIFICATION_ID,
      content: {
        title: phaseLabels[phase],
        body: statusText,
        sound: false,
        priority: Notifications.AndroidNotificationPriority.LOW,
        sticky: true,
        autoDismiss: false,
        categoryIdentifier: TIMER_CATEGORY_ID,
        ...(Platform.OS === 'android' && {
          channelId: 'pomodoro-ongoing',
          // Use chronometer for live countdown on Android (only when not paused)
          chronometerCountDown: !isPaused,
          showChronometer: !isPaused,
          when: isPaused ? Date.now() : endTime,
        }),
        data: {
          phase,
          remainingSeconds,
          totalSeconds,
          progress,
          endTime,
          isPaused,
        },
      },
      trigger: null,
    });
  }

  // Update ongoing timer notification
  async updateTimerNotification(
    phase: 'focus' | 'short_break' | 'long_break',
    remainingSeconds: number,
    totalSeconds: number,
    isPaused: boolean = false
  ): Promise<void> {
    await this.showTimerNotification(phase, remainingSeconds, totalSeconds, isPaused);
  }

  // Dismiss ongoing timer notification
  async dismissTimerNotification(): Promise<void> {
    await Notifications.dismissNotificationAsync(TIMER_NOTIFICATION_ID);
  }

  async sendTimerCompleteNotification(
    phase: 'focus' | 'short_break' | 'long_break',
    options?: { soundEnabled?: boolean; vibrationEnabled?: boolean }
  ): Promise<void> {
    if (!this.hasPermission) {
      console.warn('Notification permission not granted');
      return;
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

    await Notifications.scheduleNotificationAsync({
      content: {
        title: message.title,
        body: message.body,
        // Use custom sound - reference the filename from app.json plugin config
        sound: soundEnabled ? 'timer_complete.wav' : false,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        ...(Platform.OS === 'android' && {
          channelId,
        }),
      },
      trigger: null, // Send immediately
    });
  }

  async sendPhaseStartNotification(
    phase: 'focus' | 'short_break' | 'long_break',
    options?: { soundEnabled?: boolean; vibrationEnabled?: boolean }
  ): Promise<void> {
    if (!this.hasPermission) {
      console.warn('Notification permission not granted');
      return;
    }

    const messages = {
      focus: {
        title: 'Focus Started 🎯',
        body: 'Time to focus. You got this!',
      },
      short_break: {
        title: 'Break Started ☕',
        body: 'Take a short breather.',
      },
      long_break: {
        title: 'Long Break Started 🌟',
        body: 'Enjoy a longer rest.',
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

    await Notifications.scheduleNotificationAsync({
      content: {
        title: message.title,
        body: message.body,
        sound: soundEnabled ? 'timer_complete.wav' : false,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        ...(Platform.OS === 'android' && {
          channelId,
        }),
      },
      trigger: null,
    });
  }

  async sendReminderNotification(todoTitle: string): Promise<void> {
    if (!this.hasPermission) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Task Reminder 📋',
        body: `Don't forget: ${todoTitle}`,
        sound: true,
      },
      trigger: null,
    });
  }

  async sendAchievementNotification(achievementTitle: string): Promise<void> {
    if (!this.hasPermission) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Achievement Unlocked! 🏆',
        body: achievementTitle,
        sound: true,
      },
      trigger: null,
    });
  }

  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  // Schedule a notification for a specific time (for task due dates)
  async scheduleTaskDueNotification(
    todoId: string,
    todoTitle: string,
    dueDate: Date
  ): Promise<string | null> {
    if (!this.hasPermission) return null;

    // Schedule 1 hour before due
    const triggerDate = new Date(dueDate.getTime() - 60 * 60 * 1000);

    if (triggerDate <= new Date()) {
      return null; // Don't schedule if already past
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Task Due Soon! ⏰',
        body: `"${todoTitle}" is due in 1 hour`,
        data: { todoId },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    return identifier;
  }

  async cancelNotification(identifier: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  }
}

export const notificationService = new NotificationService();
