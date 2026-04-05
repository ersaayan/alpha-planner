import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import i18n from '@/services/i18n/i18n-config';

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
  handleNotification: async (notification) => {
    const identifier = notification.request.identifier ?? '';
    const category =
      (notification.request.content.categoryIdentifier as string) ?? '';
    // Suppress sound for ongoing timer notifications to avoid repeated alerts
    const isTimerNotification =
      identifier.includes('timer') || category.includes('timer');

    return {
      shouldPlaySound: !isTimerNotification,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
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
  private permissionCacheTime = 0;
  private static PERMISSION_CACHE_TTL = 60000; // 1 minute
  private actionCallbacks: NotificationActionCallback = {};
  private responseSubscription: Notifications.EventSubscription | null = null;
  private lastCategoryIsPaused: boolean | null = null;
  // Track scheduled task-due notifications by todoId to prevent duplicates
  private scheduledTaskDueNotifications = new Map<string, string>();
  private static TASK_NOTIFICATION_KEY = 'task-due-notifications';
  private taskNotificationsLoaded = false;

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

      // General notifications channel for achievements, reminders, task due
      await Notifications.setNotificationChannelAsync('general', {
        name: 'General Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#5A7868',
        sound: 'default',
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

    // Load persisted task-due notification IDs
    await this.loadTaskNotifications();

    // Set up notification category with actions
    await this.setupNotificationCategory();

    // Listen for notification action responses
    this.setupResponseListener();

    return this.hasPermission;
  }

  // Load persisted task-due notification map from storage
  private async loadTaskNotifications(): Promise<void> {
    if (this.taskNotificationsLoaded) return;
    try {
      const raw = await AsyncStorage.getItem(NotificationService.TASK_NOTIFICATION_KEY);
      if (raw) {
        this.scheduledTaskDueNotifications = new Map(JSON.parse(raw));
      }
    } catch {
      // best-effort
    }
    this.taskNotificationsLoaded = true;
  }

  // Save task-due notification map to storage
  private async saveTaskNotifications(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        NotificationService.TASK_NOTIFICATION_KEY,
        JSON.stringify([...this.scheduledTaskDueNotifications.entries()])
      );
    } catch {
      // best-effort
    }
  }

  // Re-check notification permissions with TTL cache to avoid excessive native bridge calls
  async checkPermission(): Promise<boolean> {
    const now = Date.now();
    if (this.hasPermission && now - this.permissionCacheTime < NotificationService.PERMISSION_CACHE_TTL) {
      return this.hasPermission;
    }
    const { status } = await Notifications.getPermissionsAsync();
    this.hasPermission = status === 'granted';
    this.permissionCacheTime = now;
    return this.hasPermission;
  }

  // Set up notification category with interactive actions
  private async setupNotificationCategory(): Promise<void> {
    await Notifications.setNotificationCategoryAsync(TIMER_CATEGORY_ID, [
      {
        identifier: 'pause',
        buttonTitle: i18n.t('notifications.actionPause'),
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'stop',
        buttonTitle: i18n.t('notifications.actionStop'),
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
    const safe = Math.max(0, seconds);
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Show ongoing timer notification with countdown
  async showTimerNotification(
    phase: 'focus' | 'short_break' | 'long_break',
    remainingSeconds: number,
    totalSeconds: number,
    isPaused: boolean = false
  ): Promise<void> {
    await this.checkPermission();
    if (!this.hasPermission) return;

    const phaseLabels = {
      focus: i18n.t('notifications.focusTime'),
      short_break: i18n.t('notifications.shortBreak'),
      long_break: i18n.t('notifications.longBreak'),
    };

    const progress = Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100);

    // Calculate when the timer will end (for Android chronometer)
    const endTime = Date.now() + remainingSeconds * 1000;

    // Only update category when paused state changes
    if (this.lastCategoryIsPaused !== isPaused) {
      this.lastCategoryIsPaused = isPaused;
      await Notifications.setNotificationCategoryAsync(TIMER_CATEGORY_ID, [
        {
          identifier: isPaused ? 'resume' : 'pause',
          buttonTitle: isPaused ? i18n.t('notifications.actionResume') : i18n.t('notifications.actionPause'),
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'stop',
          buttonTitle: i18n.t('notifications.actionStop'),
          options: {
            opensAppToForeground: false,
            isDestructive: true,
          },
        },
      ]);
    }

    const statusText = isPaused ? i18n.t('notifications.paused') : i18n.t('notifications.remaining', { time: this.formatTime(remainingSeconds) });

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

  // Dismiss and cancel ongoing timer notification
  async dismissTimerNotification(): Promise<void> {
    this.lastCategoryIsPaused = null;
    try {
      await Notifications.dismissNotificationAsync(TIMER_NOTIFICATION_ID);
    } catch {
      // Notification may not exist
    }
    try {
      await Notifications.cancelScheduledNotificationAsync(TIMER_NOTIFICATION_ID);
    } catch {
      // Notification may not exist
    }
  }

  async sendTimerCompleteNotification(
    phase: 'focus' | 'short_break' | 'long_break',
    options?: { soundEnabled?: boolean; vibrationEnabled?: boolean }
  ): Promise<void> {
    await this.checkPermission();
    if (!this.hasPermission) return;

    const messages = {
      focus: {
        title: i18n.t('notifications.focusComplete'),
        body: i18n.t('notifications.focusCompleteBody'),
      },
      short_break: {
        title: i18n.t('notifications.shortBreakOver'),
        body: i18n.t('notifications.shortBreakOverBody'),
      },
      long_break: {
        title: i18n.t('notifications.longBreakOver'),
        body: i18n.t('notifications.longBreakOverBody'),
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
    await this.checkPermission();
    if (!this.hasPermission) return;

    const messages = {
      focus: {
        title: i18n.t('notifications.focusStarted'),
        body: i18n.t('notifications.focusStartedBody'),
      },
      short_break: {
        title: i18n.t('notifications.breakStarted'),
        body: i18n.t('notifications.breakStartedBody'),
      },
      long_break: {
        title: i18n.t('notifications.longBreakStarted'),
        body: i18n.t('notifications.longBreakStartedBody'),
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
    await this.checkPermission();
    if (!this.hasPermission) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t('notifications.taskReminder'),
        body: i18n.t('notifications.taskReminderBody', { title: todoTitle }),
        sound: true,
        ...(Platform.OS === 'android' && { channelId: 'general' }),
      },
      trigger: null,
    });
  }

  async sendAchievementNotification(achievementTitle: string): Promise<void> {
    await this.checkPermission();
    if (!this.hasPermission) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t('notifications.achievementUnlocked'),
        body: achievementTitle,
        sound: true,
        ...(Platform.OS === 'android' && { channelId: 'general' }),
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
    await this.checkPermission();
    if (!this.hasPermission) return null;

    // Cancel any existing notification for this todo to prevent duplicates
    const existingId = this.scheduledTaskDueNotifications.get(todoId);
    if (existingId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(existingId);
      } catch {
        // Notification may have already fired or been dismissed
      }
      this.scheduledTaskDueNotifications.delete(todoId);
      await this.saveTaskNotifications();
    }

    // Schedule 1 hour before due
    const triggerDate = new Date(dueDate.getTime() - 60 * 60 * 1000);

    if (triggerDate <= new Date()) {
      return null; // Don't schedule if already past
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t('notifications.taskDueSoon'),
        body: i18n.t('notifications.taskDueSoonBody', { title: todoTitle }),
        data: { todoId },
        sound: true,
        ...(Platform.OS === 'android' && { channelId: 'general' }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    this.scheduledTaskDueNotifications.set(todoId, identifier);
    await this.saveTaskNotifications();

    return identifier;
  }

  async cancelNotification(identifier: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  }

  /**
   * Schedule daily summary notification at 23:00 every day.
   * Idempotent — cancels existing before rescheduling.
   */
  async scheduleDailySummaryNotification(): Promise<void> {
    const DAILY_SUMMARY_ID = 'daily-summary-notification';

    // Cancel existing
    try {
      await Notifications.cancelScheduledNotificationAsync(DAILY_SUMMARY_ID);
    } catch {
      // May not exist
    }

    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_SUMMARY_ID,
      content: {
        title: i18n.t('notifications.dailySummaryTitle'),
        body: i18n.t('notifications.dailySummaryBody'),
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
        ...(Platform.OS === 'android' && {
          channelId: 'general',
        }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 23,
        minute: 0,
      },
    });
  }

  /**
   * Cancel the daily summary notification.
   */
  async cancelDailySummaryNotification(): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync('daily-summary-notification');
    } catch {
      // May not exist
    }
  }
}

export const notificationService = new NotificationService();
