/** Task due-time reminders: what is scheduled, with which channel and identifiers. */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  MAX_TASK_REMINDERS,
  TASK_REMINDER_CHANNEL_ID,
  planTaskReminders,
  syncTaskReminders,
  taskReminderId,
} from '@/services/notifications/task-reminders';
import type { Todo } from '@/types';

const NOW = new Date(2026, 9, 14, 8, 0).getTime();
const schedule = Notifications.scheduleNotificationAsync as jest.Mock;
const cancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const getScheduled = Notifications.getAllScheduledNotificationsAsync as jest.Mock;
const getPermissions = Notifications.getPermissionsAsync as jest.Mock;

function todo(id: string, overrides: Partial<Todo> = {}): Todo {
  return {
    id, title: `Task ${id}`, description: null, dueDate: '2026-10-14', dueTime: '10:00', status: 'pending',
    categoryId: null, priority: 'medium', subtasks: [], pomodoroSessions: 0, estimatedPomodoros: null,
    createdAt: '', updatedAt: '', completedAt: null, order: 0, ...overrides,
  };
}

/** Pretends the OS kept what was scheduled. */
function rememberScheduled() {
  const pending = new Map<string, unknown>();
  schedule.mockImplementation(async (request: { identifier: string }) => {
    pending.set(request.identifier, request);
    return request.identifier;
  });
  cancel.mockImplementation(async (id: string) => {
    pending.delete(id);
  });
  getScheduled.mockImplementation(async () => [...pending.values()]);
  return pending;
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['setTimeout', 'setImmediate', 'nextTick', 'queueMicrotask'] });
  jest.clearAllMocks();
  getPermissions.mockResolvedValue({ status: 'granted', granted: true });
});
afterEach(() => jest.useRealTimers());

describe('planTaskReminders', () => {
  it('reminds open tasks with a due time, at that time, soonest first', () => {
    const plan = planTaskReminders(
      [
        todo('late', { dueTime: '18:00' }),
        todo('soon', { dueTime: '09:00' }),
        todo('no-time', { dueTime: null }),
        todo('done', { status: 'completed' }),
        todo('archived', { status: 'archived' }),
        todo('past', { dueTime: '07:00' }),
        todo('progress', { status: 'in_progress', dueDate: '2026-10-15' }),
      ],
      NOW
    );
    expect(plan.map((p) => p.todoId)).toEqual(['soon', 'late', 'progress']);
    expect(plan[0]).toEqual({ id: taskReminderId('soon'), todoId: 'soon', title: 'Task soon', at: new Date(2026, 9, 14, 9, 0).getTime() });
  });

  it(`keeps at most ${MAX_TASK_REMINDERS} (iOS allows 64 pending in total, the timer uses some)`, () => {
    const many = Array.from({ length: 70 }, (_, i) => todo(`t${i}`, { dueDate: '2026-10-20', dueTime: `${String(i % 24).padStart(2, '0')}:00` }));
    expect(planTaskReminders(many, NOW)).toHaveLength(MAX_TASK_REMINDERS);
  });
});

describe('syncTaskReminders', () => {
  it('schedules with the task-reminder channel in the trigger and a stable id', async () => {
    rememberScheduled();
    await syncTaskReminders({ todos: [todo('a')], notificationsEnabled: true });

    expect(schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'task-reminder-a',
        content: expect.objectContaining({ body: 'Task a', data: expect.objectContaining({ kind: 'task-reminder', todoId: 'a' }) }),
        trigger: expect.objectContaining({ channelId: TASK_REMINDER_CHANNEL_ID, date: new Date(2026, 9, 14, 10, 0).getTime() }),
      })
    );
  });

  it('does nothing new when nothing changed, reschedules an edited task, cancels completed and deleted ones', async () => {
    const pending = rememberScheduled();
    await syncTaskReminders({ todos: [todo('a'), todo('b')], notificationsEnabled: true });
    expect(schedule).toHaveBeenCalledTimes(2);

    schedule.mockClear();
    await syncTaskReminders({ todos: [todo('a'), todo('b')], notificationsEnabled: true });
    expect(schedule).not.toHaveBeenCalled();

    // Edited time → rescheduled; b completed → cancelled.
    await syncTaskReminders({ todos: [todo('a', { dueTime: '11:00' }), todo('b', { status: 'completed' })], notificationsEnabled: true });
    expect(cancel).toHaveBeenCalledWith('task-reminder-b');
    expect(schedule).toHaveBeenCalledTimes(1);
    expect([...pending.keys()]).toEqual(['task-reminder-a']);

    // Deleted → cancelled.
    await syncTaskReminders({ todos: [], notificationsEnabled: true });
    expect(pending.size).toBe(0);
  });

  it('respects the notifications setting and the permission', async () => {
    const pending = rememberScheduled();
    await syncTaskReminders({ todos: [todo('a')], notificationsEnabled: true });
    await syncTaskReminders({ todos: [todo('a')], notificationsEnabled: false });
    expect(pending.size).toBe(0);

    getPermissions.mockResolvedValue({ status: 'denied', granted: false });
    await syncTaskReminders({ todos: [todo('a')], notificationsEnabled: true });
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(pending.size).toBe(0);
  });

  it('never touches the timer alerts or the daily summary', async () => {
    rememberScheduled();
    getScheduled.mockResolvedValueOnce([
      { identifier: 'pomodoro-phase-end-0', content: { data: {} } },
      { identifier: 'daily-summary-notification', content: { data: {} } },
    ]);
    await syncTaskReminders({ todos: [], notificationsEnabled: true });
    expect(cancel).not.toHaveBeenCalled();
  });

  it('creates the Android channel before scheduling', async () => {
    rememberScheduled();
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    try {
      await syncTaskReminders({ todos: [todo('a')], notificationsEnabled: true });
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(TASK_REMINDER_CHANNEL_ID, expect.objectContaining({ name: 'Task reminders' }));
    } finally {
      Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
    }
  });
});

describe('foreground presentation', () => {
  it('a task reminder is shown with sound, whatever its identifier contains', async () => {
    jest.isolateModules(() => {
      jest.unmock('@/services/notifications');
      require('@/services/notifications/notification-service');
    });
    const setHandler = Notifications.setNotificationHandler as jest.Mock;
    const handler = setHandler.mock.calls[setHandler.mock.calls.length - 1][0];
    const behavior = await handler.handleNotification({
      request: { identifier: 'task-reminder-timer-todo', content: { data: { kind: 'task-reminder' } } },
    });
    expect(behavior).toMatchObject({ shouldPlaySound: true, shouldShowBanner: true });
  });
});
