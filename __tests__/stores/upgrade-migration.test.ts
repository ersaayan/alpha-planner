/* eslint-disable @typescript-eslint/no-require-imports -- jest.isolateModules needs require() */
/**
 * Upgrade safety: data written by the previous release (master @ 2948236) must load
 * intact, and startup work that runs too early must never overwrite it on disk.
 * Every store is loaded in a fresh module registry, as on a cold app start.
 */
import { migrateCategoryState } from '@/stores/category-store';
import { migrateDailyQuestsState } from '@/stores/daily-quests-store';
import { migrateGamificationState } from '@/stores/gamification-store';
import { migrateTodoState } from '@/stores/todo-store';
import { migrateWeeklyGoalsState } from '@/stores/weekly-goals-store';

const TODAY = '2026-10-16';

const OLD_TODO = {
  id: 'todo-1',
  title: 'Write report',
  description: null,
  dueDate: null,
  status: 'pending',
  categoryId: 'cat-custom',
  priority: 'high',
  subtasks: [{ id: 's1', todoId: 'todo-1', title: 'Outline', isCompleted: true, order: 0, createdAt: '2026-09-01' }],
  pomodoroSessions: 3,
  estimatedPomodoros: 4,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-02T10:00:00.000Z',
  completedAt: null,
  order: 0,
};

const OLD_CATEGORIES = [
  { id: 'cat-custom', name: 'Side project', color: '#E57373', icon: 'folder-outline', isDefault: false, order: 0, createdAt: '2026-09-01' },
];

/** Exactly what the previous release persisted (versions as shipped). */
const PREVIOUS_RELEASE_STORAGE: Record<string, unknown> = {
  'settings-storage': {
    version: 1,
    state: {
      settings: { hasCompletedOnboarding: true, theme: 'dark', language: 'tr' },
      pomodoroSettings: { focusDuration: 1800 },
    },
  },
  'todo-storage': { version: 1, state: { todos: [OLD_TODO], filter: {} } },
  'category-storage': { version: 1, state: { categories: OLD_CATEGORIES, isInitialized: true } },
  'gamification-storage': {
    version: 2,
    state: {
      stats: { totalXp: 1234, level: 7, totalPomodoros: 42 },
      unlockedAchievements: [{ achievementId: 'first_focus', unlockedAt: '2026-09-01', notified: true }],
      dailyStats: [],
      pendingNotifications: [],
      combo: { sessionCombo: 2, dailyComboStreak: 5, lastDailyComboDate: '2026-10-15' },
      prestige: { count: 1, currentSeasonStart: '2026-10', history: [] },
    },
  },
  'daily-quests-store': {
    version: 0,
    state: {
      quests: [{ id: 'q1', date: TODAY, questType: 'complete_tasks', questParams: {}, targetValue: 3, currentValue: 2, isCompleted: false, xpReward: 20 }],
      lastGeneratedDate: TODAY,
    },
  },
  'weekly-goals-store': {
    version: 0,
    state: {
      goals: [{ id: 'g1', weekStart: '2026-10-12', goalType: 'system', goalParams: { metric: 'pomodoros' }, targetValue: 10, currentValue: 4, isCompleted: false, xpReward: 50 }],
      lastGeneratedWeek: '2026-10-12',
    },
  },
  'auth-store': {
    version: 0,
    state: {
      session: { access_token: 'old-access-token', refresh_token: 'old-refresh-token' },
      user: { id: 'user-1', email: 'a@b.com' },
      profile: null,
    },
  },
  'sync-store': {
    version: 0,
    state: {
      pendingOperations: [{ id: 'op-1', table: 'todos', type: 'insert', data: { id: 'todo-1' }, createdAt: '', retryCount: 0 }],
      lastSyncedAt: '2026-10-01T00:00:00.000Z',
    },
  },
};

type Disk = Record<string, string>;

interface FreshApp {
  disk: Disk;
  stores: {
    settings: typeof import('@/stores/settings-store').useSettingsStore;
    todos: typeof import('@/stores/todo-store').useTodoStore;
    categories: typeof import('@/stores/category-store').useCategoryStore;
    gamification: typeof import('@/stores/gamification-store').useGamificationStore;
    quests: typeof import('@/stores/daily-quests-store').useDailyQuestsStore;
    goals: typeof import('@/stores/weekly-goals-store').useWeeklyGoalsStore;
    auth: typeof import('@/stores/auth-store').useAuthStore;
    sync: typeof import('@/stores/sync-store').useSyncStore;
  };
  whenStoresHydrated: typeof import('@/stores/hydration').whenStoresHydrated;
  runStartupTasks: typeof import('@/services/app/startup-tasks').runStartupTasks;
}

/** Simulates a cold start: a fresh module registry over the given disk contents. */
function coldStart(contents: Record<string, unknown>): FreshApp {
  let app: FreshApp | undefined;
  jest.isolateModules(() => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const disk: Disk = AsyncStorage.__INTERNAL_MOCK_STORAGE__;
    for (const key of Object.keys(disk)) delete disk[key];
    for (const [key, value] of Object.entries(contents)) {
      disk[key] = JSON.stringify(value);
    }
    app = {
      disk,
      stores: {
        settings: require('@/stores/settings-store').useSettingsStore,
        todos: require('@/stores/todo-store').useTodoStore,
        categories: require('@/stores/category-store').useCategoryStore,
        gamification: require('@/stores/gamification-store').useGamificationStore,
        quests: require('@/stores/daily-quests-store').useDailyQuestsStore,
        goals: require('@/stores/weekly-goals-store').useWeeklyGoalsStore,
        auth: require('@/stores/auth-store').useAuthStore,
        sync: require('@/stores/sync-store').useSyncStore,
      },
      whenStoresHydrated: require('@/stores/hydration').whenStoresHydrated,
      runStartupTasks: require('@/services/app/startup-tasks').runStartupTasks,
    };
  });
  return app!;
}

const stored = (disk: Disk, key: string) => JSON.parse(disk[key]);

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(`${TODAY}T12:00:00`), doNotFake: ['setTimeout', 'setImmediate', 'nextTick', 'queueMicrotask'] });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('upgrading from the previous release', () => {
  it('loads every store intact', async () => {
    const { stores, whenStoresHydrated } = coldStart(PREVIOUS_RELEASE_STORAGE);
    await whenStoresHydrated();

    const settings = stores.settings.getState();
    expect(settings.settings.hasCompletedOnboarding).toBe(true);
    expect(settings.settings.theme).toBe('dark');
    expect(settings.settings.language).toBe('tr');
    // Fields the old data did not have get their defaults
    expect(settings.settings.timeFormat).toBe('24h');
    expect(settings.pomodoroSettings.focusDuration).toBe(1800);
    expect(settings.pomodoroSettings.shortBreakDuration).toBeGreaterThan(0);

    // Intact, plus the v2 reward markers (the completed subtask was already paid for).
    expect(stores.todos.getState().todos).toEqual([
      {
        ...OLD_TODO,
        xpAwardedAt: null,
        subtasks: [{ ...OLD_TODO.subtasks[0], xpAwardedAt: OLD_TODO.subtasks[0].createdAt }],
      },
    ]);
    expect(stores.categories.getState().categories).toEqual(OLD_CATEGORIES);

    const gamification = stores.gamification.getState();
    expect(gamification.stats.totalXp).toBe(1234);
    expect(gamification.stats.currentStreak).toBe(0);
    expect(gamification.combo.dailyComboStreak).toBe(5);
    expect(gamification.prestige.count).toBe(1);

    expect(stores.quests.getState().quests).toHaveLength(1);
    expect(stores.goals.getState().goals).toHaveLength(1);
    expect(stores.auth.getState().lastUserId).toBe('user-1');
  });

  it('removes the duplicated auth tokens and ownerless sync operations from disk', async () => {
    const { disk, whenStoresHydrated } = coldStart(PREVIOUS_RELEASE_STORAGE);
    await whenStoresHydrated();

    expect(disk['auth-store']).not.toContain('old-access-token');
    expect(disk['auth-store']).not.toContain('old-refresh-token');
    expect(stored(disk, 'auth-store').version).toBe(1);

    const sync = stored(disk, 'sync-store');
    expect(sync.version).toBe(1);
    expect(sync.state.pendingOperations).toEqual([]);
    expect(sync.state.lastSyncedAt).toBeNull();
  });

  it('startup work that runs before hydration cannot overwrite stored categories', async () => {
    const { disk, stores, whenStoresHydrated, runStartupTasks } = coldStart(PREVIOUS_RELEASE_STORAGE);

    // The old startup order: default categories etc. before the stores have loaded.
    runStartupTasks();
    expect(stored(disk, 'category-storage').state.categories).toEqual(OLD_CATEGORIES);

    await whenStoresHydrated();
    runStartupTasks();

    expect(stores.categories.getState().categories).toEqual(OLD_CATEGORIES);
    expect(stored(disk, 'category-storage').state.categories).toEqual(OLD_CATEGORIES);
    // Today's quests were already generated: the stored progress is kept
    expect(stores.quests.getState().quests.find((q) => q.id === 'q1')?.currentValue).toBe(2);
  });

  it('a first launch gets the default categories, today\'s quests and this week\'s goals', async () => {
    const { stores, whenStoresHydrated, runStartupTasks } = coldStart({});
    await whenStoresHydrated();
    runStartupTasks();

    expect(stores.categories.getState().categories).toHaveLength(5);
    expect(stores.quests.getState().quests.filter((q) => q.date === TODAY).length).toBeGreaterThan(0);
    expect(stores.goals.getState().goals.length).toBeGreaterThan(0);
    expect(stores.settings.getState().settings.hasCompletedOnboarding).toBe(false);
  });

  it('a corrupted store is backed up and the others still load', async () => {
    const { disk, stores, whenStoresHydrated } = coldStart(PREVIOUS_RELEASE_STORAGE);
    // (written after the cold start above; simulate the next launch with a damaged todo file)
    const contents: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(disk)) contents[key] = JSON.parse(value);
    await whenStoresHydrated();
    expect(stores.todos.getState().todos).toHaveLength(1);

    let next: FreshApp | undefined;
    jest.isolateModules(() => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      const nextDisk: Disk = AsyncStorage.__INTERNAL_MOCK_STORAGE__;
      for (const key of Object.keys(nextDisk)) delete nextDisk[key];
      for (const [key, value] of Object.entries(contents)) nextDisk[key] = JSON.stringify(value);
      nextDisk['todo-storage'] = '{"state":{"todos":[{"id":"todo-1"';
      next = {
        disk: nextDisk,
        stores: { ...stores, todos: require('@/stores/todo-store').useTodoStore, categories: require('@/stores/category-store').useCategoryStore } as FreshApp['stores'],
        whenStoresHydrated: require('@/stores/hydration').whenStoresHydrated,
        runStartupTasks: require('@/services/app/startup-tasks').runStartupTasks,
      };
    });
    await next!.whenStoresHydrated();

    expect(next!.disk['todo-storage:backup']).toBe('{"state":{"todos":[{"id":"todo-1"');
    expect(next!.stores.todos.getState().todos).toEqual([]);
    expect(next!.stores.categories.getState().categories).toEqual(OLD_CATEGORIES);
  });
});

describe('pomodoro store (shared persistence)', () => {
  it('a corrupted timer file is backed up instead of blocking hydration', async () => {
    let app: { disk: Disk; whenStoresHydrated: FreshApp['whenStoresHydrated']; pomodoro: typeof import('@/stores/pomodoro-store').usePomodoroStore } | undefined;
    jest.isolateModules(() => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      const disk: Disk = AsyncStorage.__INTERNAL_MOCK_STORAGE__;
      for (const key of Object.keys(disk)) delete disk[key];
      disk['pomodoro-storage'] = '{"state":{"timer":{"state":"runn';
      app = {
        disk,
        pomodoro: require('@/stores/pomodoro-store').usePomodoroStore,
        whenStoresHydrated: require('@/stores/hydration').whenStoresHydrated,
      };
    });
    await app!.whenStoresHydrated();

    expect(app!.pomodoro.persist.hasHydrated()).toBe(true);
    expect(app!.pomodoro.getState().timer.state).toBe('stopped');
    expect(app!.disk['pomodoro-storage:backup']).toBe('{"state":{"timer":{"state":"runn');
  });

  it('sanitizes stored timer values on every load, not only on version changes', async () => {
    let app: { whenStoresHydrated: FreshApp['whenStoresHydrated']; pomodoro: typeof import('@/stores/pomodoro-store').usePomodoroStore } | undefined;
    jest.isolateModules(() => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      const disk: Disk = AsyncStorage.__INTERNAL_MOCK_STORAGE__;
      for (const key of Object.keys(disk)) delete disk[key];
      const { POMODORO_STORE_VERSION } = require('@/stores/pomodoro-store');
      disk['pomodoro-storage'] = JSON.stringify({
        version: POMODORO_STORE_VERSION,
        state: { timer: { state: 'stopped', phase: 'focus', totalTime: 1500, remainingTime: 99999, totalPausedDuration: -5 }, sessions: [], currentSession: null },
      });
      app = {
        pomodoro: require('@/stores/pomodoro-store').usePomodoroStore,
        whenStoresHydrated: require('@/stores/hydration').whenStoresHydrated,
      };
    });
    await app!.whenStoresHydrated();

    const { timer } = app!.pomodoro.getState();
    expect(timer.remainingTime).toBeLessThanOrEqual(timer.totalTime);
    expect(timer.totalPausedDuration ?? 0).toBeGreaterThanOrEqual(0);
  });
});

describe('store migrate functions', () => {
  it('todo: normalizes old todos without dropping them', () => {
    const migrated = migrateTodoState({ todos: [{ id: 'a', title: 'Old' }, { title: 'No id' }, 'junk'] }, 0);
    expect(migrated.todos).toHaveLength(2);
    expect(migrated.todos[0]).toMatchObject({ id: 'a', title: 'Old', status: 'pending', subtasks: [], pomodoroSessions: 0 });
    expect(typeof migrated.todos[1].id).toBe('string');
    expect(migrated.todos[1].title).toBe('No id');
    expect(migrated.filter).toEqual({});
  });

  it('category: stored categories count as initialized', () => {
    expect(migrateCategoryState({ categories: OLD_CATEGORIES }, 0)).toEqual({ categories: OLD_CATEGORIES, isInitialized: true });
    expect(migrateCategoryState(undefined, 0)).toEqual({ categories: [], isInitialized: false });
  });

  it('gamification: v1 without combo/prestige', () => {
    const migrated = migrateGamificationState({ stats: { totalXp: 5 }, unlockedAchievements: [] }, 1);
    expect(migrated.stats).toEqual({ totalXp: 5 });
    expect(migrated.combo).toEqual({});
    expect(migrated.prestige).toEqual({});
  });

  it('daily quests and weekly goals: drop malformed entries only', () => {
    expect(migrateDailyQuestsState({ quests: [{ id: 'q' }, { nope: 1 }], lastGeneratedDate: 3 }, 0)).toEqual({
      quests: [{ id: 'q' }],
      lastGeneratedDate: null,
    });
    expect(migrateWeeklyGoalsState({ goals: [{ id: 'g' }], lastGeneratedWeek: '2026-10-12' }, 0)).toEqual({
      goals: [{ id: 'g' }],
      lastGeneratedWeek: '2026-10-12',
    });
  });

  it('daily quests v1 → v2: hours and minutes move into the quest params', () => {
    const quest = (questType: string, targetValue: number, extra: Record<string, unknown> = {}) => ({
      id: questType, date: TODAY, questType, questParams: {}, targetValue, currentValue: 0, isCompleted: false, xpReward: 20, ...extra,
    });
    const { quests } = migrateDailyQuestsState(
      {
        quests: [
          quest('start_early', 8),
          quest('long_focus', 45, { currentValue: 1 }),
          quest('uninterrupted_focus', 30, { isCompleted: true, currentValue: 30 }),
          quest('complete_tasks', 3, { currentValue: 2 }),
        ],
      },
      1
    );
    expect(quests[0]).toMatchObject({ questParams: { beforeHour: 8 }, targetValue: 1, currentValue: 0 });
    expect(quests[1]).toMatchObject({ questParams: { minutes: 45 }, targetValue: 1, currentValue: 0 });
    expect(quests[2]).toMatchObject({ targetValue: 1, currentValue: 1, isCompleted: true });
    expect(quests[3]).toMatchObject({ targetValue: 3, currentValue: 2 });
    // Already-migrated data is left alone.
    expect(migrateDailyQuestsState({ quests: [quests[0]] }, 2).quests[0]).toEqual(quests[0]);
  });
});
