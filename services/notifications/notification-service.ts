import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import i18n from '@/services/i18n/i18n-config';
import { GENERAL_CHANNEL_ID, NOTIFICATION_KIND, initializeAlerts } from './pomodoro-alerts';

// Foreground presentation. Timer alerts must be seen and heard even while the app is
// open; the ongoing timer notification (Android) is listed silently.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const kind = notification.request.content.data?.kind;
    const isOngoing = kind === NOTIFICATION_KIND.ongoing;
    return {
      shouldPlaySound: !isOngoing,
      shouldSetBadge: false,
      shouldShowBanner: !isOngoing,
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

const DAILY_SUMMARY_ID = 'daily-summary-notification';

class NotificationService {
  private hasPermission = false;
  private permissionCacheTime = 0;
  private static PERMISSION_CACHE_TTL = 60000; // 1 minute
  // Track scheduled task-due notifications by todoId to prevent duplicates
  private scheduledTaskDueNotifications = new Map<string, string>();
  private static TASK_NOTIFICATION_KEY = 'task-due-notifications';
  private taskNotificationsLoaded = false;

  /**
   * Creates channels and action categories. Never shows the permission prompt: the
   * Pomodoro screen asks at the first Start (see services/notifications/alert-permissions).
   */
  async initialize(): Promise<boolean> {
    await initializeAlerts();
    await this.loadTaskNotifications();
    return this.checkPermission();
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

  async sendReminderNotification(todoTitle: string): Promise<void> {
    await this.checkPermission();
    if (!this.hasPermission) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t('notifications.taskReminder'),
        body: i18n.t('notifications.taskReminderBody', { title: todoTitle }),
        sound: true,
      },
      trigger: { channelId: GENERAL_CHANNEL_ID },
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
      },
      trigger: { channelId: GENERAL_CHANNEL_ID },
    });
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
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: GENERAL_CHANNEL_ID,
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
    await this.cancelDailySummaryNotification();

    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_SUMMARY_ID,
      content: {
        title: i18n.t('notifications.dailySummaryTitle'),
        body: i18n.t('notifications.dailySummaryBody'),
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 23,
        minute: 0,
        channelId: GENERAL_CHANNEL_ID,
      },
    });
  }

  /**
   * Cancel the daily summary notification.
   */
  async cancelDailySummaryNotification(): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(DAILY_SUMMARY_ID);
    } catch {
      // May not exist
    }
  }

  /** Schedules or cancels the daily summary to match the in-app notifications toggle. */
  async syncDailySummary(enabled: boolean): Promise<void> {
    if (enabled) {
      await this.scheduleDailySummaryNotification();
    } else {
      await this.cancelDailySummaryNotification();
    }
  }
}

export const notificationService = new NotificationService();
