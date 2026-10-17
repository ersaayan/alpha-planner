import type * as Notifications from 'expo-notifications';

import { requestDailySummary } from '@/services/gamification/summary-request';
import { getDateKey } from '@/utils/date';

/** `content.data.kind` of the app's non-timer notifications. */
export const APP_NOTIFICATION_KIND = {
  dailySummary: 'daily-summary',
  taskReminder: 'task-reminder',
} as const;

const handled = new Set<string>();

/**
 * Where a tap on a daily-summary or task-reminder notification leads (timer notifications
 * are handled by handleTimerResponse). Each response is handled once.
 */
export function routeForAppNotification(response: Notifications.NotificationResponse): string | null {
  const { request, date } = response.notification;
  const data = (request.content.data ?? {}) as Record<string, unknown>;
  const key = `${request.identifier}|${date}`;

  if (data.kind === APP_NOTIFICATION_KIND.dailySummary) {
    if (handled.has(key)) return null;
    handled.add(key);
    // The summary of the day the notification fired on (also when tapped after midnight).
    requestDailySummary(getDateKey(new Date(typeof date === 'number' && date > 0 ? date : Date.now())));
    return '/';
  }
  if (data.kind === APP_NOTIFICATION_KIND.taskReminder && typeof data.todoId === 'string') {
    if (handled.has(key)) return null;
    handled.add(key);
    return `/todo/${data.todoId}`;
  }
  return null;
}
