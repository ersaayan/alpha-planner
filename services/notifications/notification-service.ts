import * as Notifications from 'expo-notifications';
import i18n from '@/services/i18n/i18n-config';
import { APP_NOTIFICATION_KIND } from './app-notification-routes';
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
  /**
   * Creates channels and action categories. Never shows the permission prompt: the
   * Pomodoro screen asks at the first Start (see services/notifications/alert-permissions).
   */
  async initialize(): Promise<boolean> {
    await initializeAlerts();
    return this.checkPermission();
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
        // A tap opens the summary of that day (see app-notification-routes).
        data: { kind: APP_NOTIFICATION_KIND.dailySummary },
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
