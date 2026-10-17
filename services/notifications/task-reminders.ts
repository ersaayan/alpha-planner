/**
 * Reminders for tasks with a due time. One notification per open task, at its due time,
 * with a fixed identifier per task. `syncTaskReminders` is the only writer: it compares
 * what should be scheduled (from the todos) with what is, so it is safe to call after
 * any change (create, edit, complete, delete, reset, language or permission change).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/services/i18n/i18n-config';
import type { Todo } from '@/types';
import { getDueAt } from '@/utils/todo-dates';

import { APP_NOTIFICATION_KIND } from './app-notification-routes';

/** Android channel; versioned because a channel's sound and importance cannot change later. */
export const TASK_REMINDER_CHANNEL_ID = 'task-reminders-v1';
export const TASK_REMINDER_ID_PREFIX = 'task-reminder-';
/**
 * iOS keeps at most 64 pending notifications per app. The timer alert chain uses up to
 * 8, plus the daily summary and a test alert: the soonest 40 reminders leave room.
 */
export const MAX_TASK_REMINDERS = 40;

// Left by the previous implementation (never called in practice).
const LEGACY_TASK_NOTIFICATIONS_KEY = 'task-due-notifications';

export function taskReminderId(todoId: string): string {
  return `${TASK_REMINDER_ID_PREFIX}${todoId}`;
}

export interface PlannedReminder {
  id: string;
  todoId: string;
  title: string;
  at: number;
}

/** The reminders that should be pending at `now`: open tasks due later, soonest first. */
export function planTaskReminders(todos: Todo[], now: number, limit = MAX_TASK_REMINDERS): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  for (const todo of todos) {
    if (todo.status !== 'pending' && todo.status !== 'in_progress') continue;
    const dueAt = getDueAt(todo.dueDate, todo.dueTime);
    // iOS rejects a trigger less than a second away.
    if (!dueAt || dueAt.getTime() - now < 1000) continue;
    planned.push({ id: taskReminderId(todo.id), todoId: todo.id, title: todo.title, at: dueAt.getTime() });
  }
  return planned.sort((a, b) => a.at - b.at).slice(0, limit);
}

export async function ensureTaskReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(TASK_REMINDER_CHANNEL_ID, {
    name: i18n.t('notifications.channelTaskReminders'),
    description: i18n.t('notifications.channelTaskRemindersDescription'),
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}

async function cleanupLegacyTaskNotifications(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_TASK_NOTIFICATIONS_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw) as [string, string][];
    await Promise.all(
      (Array.isArray(entries) ? entries : []).map(([, id]) =>
        Notifications.cancelScheduledNotificationAsync(String(id)).catch(() => undefined)
      )
    );
    await AsyncStorage.removeItem(LEGACY_TASK_NOTIFICATIONS_KEY);
  } catch {
    // Best effort.
  }
}

/** What a scheduled reminder was made from, to tell whether it is still right. */
function signature(title: string, at: number, language: string): string {
  return `${at}|${language}|${title}`;
}

export interface ReminderSnapshot {
  todos: Todo[];
  notificationsEnabled: boolean;
}

async function applyReminders(snapshot: ReminderSnapshot): Promise<void> {
  await cleanupLegacyTaskNotifications();

  let granted = false;
  if (snapshot.notificationsEnabled) {
    try {
      granted = (await Notifications.getPermissionsAsync()).granted;
    } catch {
      granted = false;
    }
  }
  const language = i18n.language ?? 'en';
  const plan = granted ? planTaskReminders(snapshot.todos, Date.now()) : [];
  const wanted = new Map(plan.map((reminder) => [reminder.id, reminder]));

  const scheduled = (await Notifications.getAllScheduledNotificationsAsync().catch(() => [])).filter((request) =>
    request.identifier.startsWith(TASK_REMINDER_ID_PREFIX)
  );
  const upToDate = new Set<string>();
  for (const request of scheduled) {
    const reminder = wanted.get(request.identifier);
    const data = (request.content.data ?? {}) as Record<string, unknown>;
    if (reminder && data.signature === signature(reminder.title, reminder.at, language)) {
      upToDate.add(request.identifier);
    } else {
      await Notifications.cancelScheduledNotificationAsync(request.identifier).catch(() => undefined);
    }
  }

  if (plan.length > 0) await ensureTaskReminderChannel().catch(() => undefined);
  for (const reminder of plan) {
    if (upToDate.has(reminder.id)) continue;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.id,
        content: {
          title: i18n.t('notifications.taskDue'),
          body: reminder.title,
          sound: 'default',
          data: {
            kind: APP_NOTIFICATION_KIND.taskReminder,
            todoId: reminder.todoId,
            signature: signature(reminder.title, reminder.at, language),
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminder.at,
          channelId: TASK_REMINDER_CHANNEL_ID,
        },
      });
    } catch (error) {
      console.warn('[reminders] Could not schedule a task reminder', error);
    }
  }
}

let pending: ReminderSnapshot | null = null;
let worker: Promise<void> | null = null;

/**
 * Makes the scheduled task reminders match `snapshot`. Serialized; calls made while one
 * is running are coalesced to the latest snapshot.
 */
export function syncTaskReminders(snapshot: ReminderSnapshot): Promise<void> {
  pending = snapshot;
  if (!worker) {
    worker = (async () => {
      try {
        while (pending) {
          const job = pending;
          pending = null;
          try {
            await applyReminders(job);
          } catch (error) {
            console.warn('[reminders] Sync failed', error);
          }
        }
      } finally {
        worker = null;
      }
    })();
  }
  return worker;
}

export function whenRemindersSettled(): Promise<void> {
  return worker ?? Promise.resolve();
}
