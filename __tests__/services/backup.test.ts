/**
 * Export / import: a backup restores the same data, older backups are migrated like old
 * installs, and anything that is not a valid backup is rejected before data is replaced.
 */
const mockWritten: { uri: string; content: string }[] = [];
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  File: class {
    uri: string;
    exists = false;
    constructor(dir: { uri: string } | string, name?: string) {
      this.uri = typeof dir === 'string' ? dir : `${dir.uri}${name}`;
    }
    create() {}
    delete() {}
    async write(content: string) {
      mockWritten.push({ uri: this.uri, content });
    }
    async text() {
      return mockWritten.find((w) => w.uri === this.uri)?.content ?? '';
    }
  },
}));
const mockShare = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn().mockResolvedValue(true), shareAsync: (...args: unknown[]) => mockShare(...args) }));
const mockPick = jest.fn();
jest.mock('expo-document-picker', () => ({ getDocumentAsync: (...args: unknown[]) => mockPick(...args) }));

import {
  BACKUP_FORMAT,
  createBackup,
  describeBackup,
  exportBackup,
  parseBackup,
  pickBackup,
  restoreBackup,
} from '@/services/data/backup';
import { useCategoryStore } from '@/stores/category-store';
import { useDailyQuestsStore } from '@/stores/daily-quests-store';
import { useGamificationStore } from '@/stores/gamification-store';
import { usePomodoroStore, stopPomodoroEngine } from '@/stores/pomodoro-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useTodoStore } from '@/stores/todo-store';
import { useWeeklyGoalsStore } from '@/stores/weekly-goals-store';
import { INITIAL_USER_STATS } from '@/types';

function resetStores() {
  for (const store of [useSettingsStore, useTodoStore, useCategoryStore, useGamificationStore, useDailyQuestsStore, useWeeklyGoalsStore]) {
    (store as unknown as { setState: (s: unknown, r: boolean) => void; getInitialState: () => unknown }).setState(
      (store as unknown as { getInitialState: () => unknown }).getInitialState(),
      true
    );
  }
  usePomodoroStore.setState({ sessions: [], currentSession: null });
}

function makeSomeData() {
  useSettingsStore.getState().updateSettings({ language: 'tr', hasCompletedOnboarding: true, theme: 'dark' });
  useSettingsStore.getState().updatePomodoroSettings({ focusDuration: 50 * 60 });
  useCategoryStore.getState().initializeCategories();
  const side = useCategoryStore.getState().addCategory({ name: 'Side', color: '#123456', icon: null, order: 9 });
  const todo = useTodoStore.getState().addTodo({
    title: 'Write report', description: 'Q4', dueDate: '2026-10-20', dueTime: '09:30', status: 'pending',
    categoryId: side.id, priority: 'high', estimatedPomodoros: 3,
  });
  useTodoStore.getState().addSubtask(todo.id, 'Outline');
  useGamificationStore.getState().incrementPomodoro(1500, new Date());
  useTodoStore.getState().toggleTodoStatus(todo.id);
  return { todoId: todo.id, categoryId: side.id };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWritten.length = 0;
  resetStores();
});
afterEach(() => stopPomodoroEngine());

it('round trip: export, wipe, import gives back the same data', async () => {
  const { todoId, categoryId } = makeSomeData();
  const before = {
    todos: useTodoStore.getState().todos,
    categories: useCategoryStore.getState().categories,
    stats: useGamificationStore.getState().stats,
    achievements: useGamificationStore.getState().unlockedAchievements,
    dailyStats: useGamificationStore.getState().dailyStats,
    settings: useSettingsStore.getState().settings,
    pomodoroSettings: useSettingsStore.getState().pomodoroSettings,
  };

  const text = JSON.stringify(createBackup());
  resetStores();
  expect(useTodoStore.getState().todos).toHaveLength(0);

  const parsed = parseBackup(text);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  await restoreBackup(parsed.backup);

  expect(useTodoStore.getState().todos).toEqual(before.todos);
  expect(useTodoStore.getState().todos.find((t) => t.id === todoId)).toMatchObject({ dueDate: '2026-10-20', dueTime: '09:30', categoryId });
  expect(useCategoryStore.getState().categories).toEqual(before.categories);
  expect(useGamificationStore.getState().stats).toEqual(before.stats);
  expect(useGamificationStore.getState().unlockedAchievements).toEqual(before.achievements);
  expect(useGamificationStore.getState().dailyStats).toEqual(before.dailyStats);
  expect(useSettingsStore.getState().settings).toEqual(before.settings);
  expect(useSettingsStore.getState().pomodoroSettings).toEqual(before.pomodoroSettings);
  // The timer comes back stopped, with the imported focus length.
  expect(usePomodoroStore.getState().timer).toMatchObject({ state: 'stopped', totalTime: 50 * 60 });
});

it('the backup leaves out the sign-in session, the sync queue and the running timer', () => {
  makeSomeData();
  const backup = createBackup();
  expect(Object.keys(backup.stores).sort()).toEqual(
    ['category-storage', 'daily-quests-store', 'gamification-storage', 'pomodoro-storage', 'settings-storage', 'todo-storage', 'weekly-goals-store'].sort()
  );
  expect(Object.keys(backup.stores['pomodoro-storage'].state)).toEqual(['sessions']);
  expect(backup).toMatchObject({ format: BACKUP_FORMAT, version: 1 });
});

it('a backup from an older version is migrated like an old install', async () => {
  const old = {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: '2026-09-01T10:00:00.000Z',
    stores: {
      // todo store v1: ISO due date, no reward markers
      'todo-storage': {
        version: 1,
        state: { todos: [{ id: 'a', title: 'Old', status: 'completed', dueDate: new Date(2026, 8, 3).toISOString(), completedAt: '2026-09-02T10:00:00.000Z' }], filter: {} },
      },
      'gamification-storage': {
        version: 2,
        state: { stats: { ...INITIAL_USER_STATS, totalXp: 900, currentStreak: 4 }, dailyStats: [{ date: '2026-09-01', pomodorosCompleted: 2, tasksCompleted: 1, dailyQuestsCompleted: 1 }] },
      },
    },
  };
  const parsed = parseBackup(JSON.stringify(old));
  if (!parsed.ok) throw new Error(parsed.error);
  await restoreBackup(parsed.backup);

  expect(useTodoStore.getState().todos[0]).toMatchObject({ dueDate: '2026-09-03', xpAwardedAt: '2026-09-02T10:00:00.000Z' });
  expect(useGamificationStore.getState().stats).toMatchObject({ totalXp: 900, streakLength: 4, activeDays: 1, perfectQuestDays: 1 });
  // Missing stores return to their first-launch state.
  expect(useSettingsStore.getState().settings.hasCompletedOnboarding).toBe(false);
});

it('rejects files that are not valid backups, before anything is replaced', () => {
  expect(parseBackup('not json')).toEqual({ ok: false, error: 'unreadable' });
  expect(parseBackup(JSON.stringify({ hello: 'world' }))).toEqual({ ok: false, error: 'notBackup' });
  expect(parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 99, stores: {} }))).toEqual({ ok: false, error: 'newerVersion' });
  expect(parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, stores: { 'todo-storage': { version: 99, state: {} } } }))).toEqual({
    ok: false,
    error: 'newerVersion',
  });
  expect(parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, stores: { 'todo-storage': { version: 1, state: [] } } }))).toEqual({
    ok: false,
    error: 'notBackup',
  });
  expect(parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, stores: { 'auth-store': { version: 1, state: {} } } }))).toEqual({
    ok: false,
    error: 'empty',
  });
});

it('describes a backup for the confirmation', () => {
  makeSomeData();
  const summary = describeBackup(createBackup(new Date('2026-10-14T10:00:00.000Z')));
  expect(summary).toMatchObject({ exportedAt: '2026-10-14T10:00:00.000Z', todos: 1 });
  expect(summary.achievements).toBeGreaterThan(0);
});

it('export writes a JSON file and opens the share sheet; import reads a picked file', async () => {
  makeSomeData();
  await exportBackup('Backup');
  expect(mockWritten).toHaveLength(1);
  expect(mockWritten[0].uri).toMatch(/^file:\/\/\/cache\/alpha-planner-backup-\d{4}-\d{2}-\d{2}\.json$/);
  expect(mockShare).toHaveBeenCalledWith(mockWritten[0].uri, expect.objectContaining({ mimeType: 'application/json' }));

  mockPick.mockResolvedValueOnce({ canceled: false, assets: [{ uri: mockWritten[0].uri, name: 'b.json' }] });
  const picked = await pickBackup();
  expect(picked?.ok).toBe(true);

  mockPick.mockResolvedValueOnce({ canceled: true, assets: null });
  expect(await pickBackup()).toBeNull();
});
