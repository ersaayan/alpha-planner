jest.mock('@/stores/sync-store', () => ({
  useSyncStore: {
    getState: () => ({
      enqueue: jest.fn(),
    }),
  },
}));

jest.mock('@/stores/todo-store', () => ({
  useTodoStore: {
    getState: () => ({
      todos: [],
    }),
  },
}));

jest.mock('@/stores/category-store', () => ({
  useCategoryStore: {
    getState: () => ({
      categories: [],
    }),
  },
}));

jest.mock('@/stores/daily-quests-store', () => ({
  useDailyQuestsStore: {
    getState: () => ({
      updateQuestProgress: jest.fn(),
      recordQuestEvent: jest.fn(),
    }),
  },
}));

jest.mock('@/stores/weekly-goals-store', () => ({
  useWeeklyGoalsStore: {
    getState: () => ({
      updateGoalProgress: jest.fn(),
      refreshDerivedGoals: jest.fn(),
    }),
  },
}));

import { useGamificationStore } from '@/stores/gamification-store';
import { INITIAL_COMBO_STATE, INITIAL_PRESTIGE_STATE, INITIAL_USER_STATS } from '@/types';

const INITIAL_STATE = {
  stats: { ...INITIAL_USER_STATS },
  unlockedAchievements: [],
  dailyStats: [],
  pendingNotifications: [],
  combo: { ...INITIAL_COMBO_STATE },
  prestige: { ...INITIAL_PRESTIGE_STATE },
};

beforeEach(() => {
  useGamificationStore.setState(INITIAL_STATE);
});

describe('useGamificationStore', () => {
  // ── addXp ──────────────────────────────────────────────────────────

  it('addXp: increases totalXp by the given amount', () => {
    useGamificationStore.getState().addXp(50);

    const { stats } = useGamificationStore.getState();
    expect(stats.totalXp).toBe(50);
  });

  it('addXp: recalculates level when enough XP is accumulated', () => {
    // Level 2 requires floor(50 * 2^1.8) = 173 XP
    useGamificationStore.getState().addXp(200);

    const { stats } = useGamificationStore.getState();
    expect(stats.level).toBeGreaterThanOrEqual(2);
  });

  it('addXp: updates currentXp relative to current level', () => {
    useGamificationStore.getState().addXp(10);

    const { stats } = useGamificationStore.getState();
    // At level 1 (xpRequired = 0), currentXp = totalXp - 0 = totalXp
    expect(stats.currentXp).toBe(10);
  });

  it('addXp: accumulates across multiple calls', () => {
    useGamificationStore.getState().addXp(30);
    useGamificationStore.getState().addXp(20);

    expect(useGamificationStore.getState().stats.totalXp).toBe(50);
  });

  // ── incrementPomodoro ──────────────────────────────────────────────

  it('incrementPomodoro: increases totalPomodoros by 1', () => {
    useGamificationStore.getState().incrementPomodoro(1500);

    expect(useGamificationStore.getState().stats.totalPomodoros).toBe(1);
  });

  it('incrementPomodoro: adds focusTime to totalFocusTime', () => {
    useGamificationStore.getState().incrementPomodoro(1500);
    useGamificationStore.getState().incrementPomodoro(2700);

    expect(useGamificationStore.getState().stats.totalFocusTime).toBe(4200);
  });

  it('incrementPomodoro: awards XP (totalXp increases)', () => {
    useGamificationStore.getState().incrementPomodoro(1500);

    const { stats } = useGamificationStore.getState();
    expect(stats.totalXp).toBeGreaterThan(0);
  });

  it('incrementPomodoro: increments session combo', () => {
    useGamificationStore.getState().incrementPomodoro(1500);

    expect(useGamificationStore.getState().combo.sessionCombo).toBe(1);
  });

  // ── incrementTaskCompleted ─────────────────────────────────────────

  it('incrementTaskCompleted: increases totalTasksCompleted by 1', () => {
    useGamificationStore.getState().incrementTaskCompleted();

    expect(useGamificationStore.getState().stats.totalTasksCompleted).toBe(1);
  });

  it('incrementTaskCompleted: awards XP', () => {
    useGamificationStore.getState().incrementTaskCompleted();

    expect(useGamificationStore.getState().stats.totalXp).toBeGreaterThan(0);
  });

  // ── updateStreak ───────────────────────────────────────────────────

  it('updateStreak: sets streak to 1 when no previous activity', () => {
    useGamificationStore.getState().updateStreak();

    const { stats } = useGamificationStore.getState();
    expect(stats.currentStreak).toBe(1);
    expect(stats.lastActiveDate).toBeDefined();
    expect(stats.lastActiveDate.length).toBeGreaterThan(0);
  });

  it('updateStreak: increments streak on consecutive days', () => {
    const { getDateKey } = require('@/utils/date');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yyyymmdd = getDateKey(yesterday);

    useGamificationStore.setState((state) => ({
      stats: {
        ...state.stats,
        currentStreak: 3,
        longestStreak: 3,
        lastActiveDate: yyyymmdd,
      },
    }));

    useGamificationStore.getState().updateStreak();

    const { stats } = useGamificationStore.getState();
    expect(stats.currentStreak).toBe(4);
    expect(stats.longestStreak).toBe(4);
  });

  it('updateStreak: resets streak to 1 on non-consecutive days', () => {
    const { getDateKey } = require('@/utils/date');
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const yyyymmdd = getDateKey(twoDaysAgo);

    useGamificationStore.setState((state) => ({
      stats: {
        ...state.stats,
        currentStreak: 5,
        longestStreak: 5,
        lastActiveDate: yyyymmdd,
      },
    }));

    useGamificationStore.getState().updateStreak();

    const { stats } = useGamificationStore.getState();
    expect(stats.currentStreak).toBe(1);
    // longestStreak should be preserved
    expect(stats.longestStreak).toBe(5);
  });

  it('updateStreak: does not change streak when called twice on same day', () => {
    useGamificationStore.getState().updateStreak();
    const streakAfterFirst = useGamificationStore.getState().stats.currentStreak;

    useGamificationStore.getState().updateStreak();
    expect(useGamificationStore.getState().stats.currentStreak).toBe(streakAfterFirst);
  });

  // ── checkAchievements ──────────────────────────────────────────────

  it('checkAchievements: unlocks first_focus when totalPomodoros >= 1', () => {
    useGamificationStore.setState((state) => ({
      stats: { ...state.stats, totalPomodoros: 1 },
    }));

    useGamificationStore.getState().checkAchievements();

    const unlocked = useGamificationStore.getState().unlockedAchievements;
    const ids = unlocked.map((ua) => ua.achievementId);
    expect(ids).toContain('first_focus');
  });

  it('checkAchievements: does not re-unlock already unlocked achievements', () => {
    useGamificationStore.setState((state) => ({
      stats: { ...state.stats, totalPomodoros: 1 },
      unlockedAchievements: [
        { achievementId: 'first_focus', unlockedAt: '2026-01-01T00:00:00.000Z', notified: false },
      ],
    }));

    useGamificationStore.getState().checkAchievements();

    const unlocked = useGamificationStore.getState().unlockedAchievements;
    const firstFocusCount = unlocked.filter((ua) => ua.achievementId === 'first_focus').length;
    expect(firstFocusCount).toBe(1);
  });

  it('checkAchievements: adds newly unlocked to pendingNotifications', () => {
    useGamificationStore.setState((state) => ({
      stats: { ...state.stats, totalPomodoros: 1 },
    }));

    useGamificationStore.getState().checkAchievements();

    const pending = useGamificationStore.getState().pendingNotifications;
    expect(pending.some((a) => a.id === 'first_focus')).toBe(true);
  });

  it('checkAchievements: awards XP for newly unlocked achievements', () => {
    useGamificationStore.setState((state) => ({
      stats: { ...state.stats, totalPomodoros: 1, totalXp: 0 },
    }));

    useGamificationStore.getState().checkAchievements();

    // first_focus grants 25 XP
    expect(useGamificationStore.getState().stats.totalXp).toBeGreaterThanOrEqual(25);
  });

  // ── unlockAchievement ──────────────────────────────────────────────

  it('unlockAchievement: adds achievement to unlockedAchievements and awards XP', () => {
    useGamificationStore.getState().unlockAchievement('early_bird');

    const unlocked = useGamificationStore.getState().unlockedAchievements;
    expect(unlocked.some((ua) => ua.achievementId === 'early_bird')).toBe(true);
    expect(useGamificationStore.getState().stats.totalXp).toBeGreaterThan(0);
  });

  it('unlockAchievement: does not re-unlock already unlocked achievement', () => {
    useGamificationStore.getState().unlockAchievement('early_bird');
    const xpAfterFirst = useGamificationStore.getState().stats.totalXp;

    useGamificationStore.getState().unlockAchievement('early_bird');

    expect(useGamificationStore.getState().stats.totalXp).toBe(xpAfterFirst);
    const count = useGamificationStore.getState().unlockedAchievements
      .filter((ua) => ua.achievementId === 'early_bird').length;
    expect(count).toBe(1);
  });

  it('unlockAchievement: adds to pendingNotifications', () => {
    useGamificationStore.getState().unlockAchievement('night_owl');

    const pending = useGamificationStore.getState().pendingNotifications;
    expect(pending.some((a) => a.id === 'night_owl')).toBe(true);
  });

  // ── dismissNotification ────────────────────────────────────────────

  it('dismissNotification: removes achievement from pendingNotifications', () => {
    useGamificationStore.getState().unlockAchievement('early_bird');
    expect(useGamificationStore.getState().pendingNotifications.length).toBeGreaterThan(0);

    useGamificationStore.getState().dismissNotification('early_bird');
    expect(useGamificationStore.getState().pendingNotifications.some((a) => a.id === 'early_bird')).toBe(false);
  });

  it('dismissNotification: sets notified to true on the UserAchievement', () => {
    useGamificationStore.getState().unlockAchievement('early_bird');
    useGamificationStore.getState().dismissNotification('early_bird');

    const ua = useGamificationStore.getState().unlockedAchievements
      .find((u) => u.achievementId === 'early_bird');
    expect(ua?.notified).toBe(true);
  });

  // ── incrementSessionCombo ──────────────────────────────────────────

  it('incrementSessionCombo: increments the combo counter by 1', () => {
    useGamificationStore.getState().incrementSessionCombo();
    useGamificationStore.getState().incrementSessionCombo();

    expect(useGamificationStore.getState().combo.sessionCombo).toBe(2);
  });

  // ── resetSessionCombo ──────────────────────────────────────────────

  it('resetSessionCombo: resets session combo to 0', () => {
    useGamificationStore.getState().incrementSessionCombo();
    useGamificationStore.getState().incrementSessionCombo();
    useGamificationStore.getState().incrementSessionCombo();

    useGamificationStore.getState().resetSessionCombo();
    expect(useGamificationStore.getState().combo.sessionCombo).toBe(0);
  });

  // ── checkDailyCombo ────────────────────────────────────────────────

  it('checkDailyCombo: sets dailyComboStreak to 1 when today has pomodoro and task', () => {
    const { getDateKey } = require('@/utils/date');
    const today = getDateKey();

    useGamificationStore.setState((state) => ({
      dailyStats: [
        {
          date: today,
          pomodorosCompleted: 1,
          focusTime: 1500,
          tasksCompleted: 1,
          xpEarned: 0,
          dailyQuestsCompleted: 0,
          summaryShownAt: null,
        },
      ],
    }));

    useGamificationStore.getState().checkDailyCombo();

    expect(useGamificationStore.getState().combo.dailyComboStreak).toBe(1);
    expect(useGamificationStore.getState().combo.lastDailyComboDate).toBe(today);
  });

  it('checkDailyCombo: increments streak on consecutive days', () => {
    const { getDateKey } = require('@/utils/date');
    const today = getDateKey();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getDateKey(yesterday);

    useGamificationStore.setState((state) => ({
      combo: {
        ...state.combo,
        dailyComboStreak: 2,
        lastDailyComboDate: yesterdayStr,
      },
      dailyStats: [
        {
          date: today,
          pomodorosCompleted: 1,
          focusTime: 1500,
          tasksCompleted: 1,
          xpEarned: 0,
          dailyQuestsCompleted: 0,
          summaryShownAt: null,
        },
      ],
    }));

    useGamificationStore.getState().checkDailyCombo();

    expect(useGamificationStore.getState().combo.dailyComboStreak).toBe(3);
  });

  it('checkDailyCombo: does nothing when today has no pomodoros', () => {
    const { getDateKey } = require('@/utils/date');
    const today = getDateKey();

    useGamificationStore.setState((state) => ({
      dailyStats: [
        {
          date: today,
          pomodorosCompleted: 0,
          focusTime: 0,
          tasksCompleted: 1,
          xpEarned: 0,
          dailyQuestsCompleted: 0,
          summaryShownAt: null,
        },
      ],
    }));

    useGamificationStore.getState().checkDailyCombo();

    expect(useGamificationStore.getState().combo.dailyComboStreak).toBe(0);
  });

  // ── getXpProgress ──────────────────────────────────────────────────

  it('getXpProgress: returns correct percentage for level 1', () => {
    useGamificationStore.getState().addXp(50);

    const progress = useGamificationStore.getState().getXpProgress();
    expect(progress.current).toBeGreaterThan(0);
    expect(progress.required).toBeGreaterThan(0);
    expect(progress.percentage).toBeGreaterThan(0);
    expect(progress.percentage).toBeLessThanOrEqual(100);
  });

  it('getXpProgress: returns 0 percentage when no XP', () => {
    const progress = useGamificationStore.getState().getXpProgress();
    expect(progress.current).toBe(0);
    expect(progress.percentage).toBe(0);
  });

  // ── isAchievementUnlocked ──────────────────────────────────────────

  it('isAchievementUnlocked: returns false for not-yet-unlocked achievement', () => {
    expect(useGamificationStore.getState().isAchievementUnlocked('first_focus')).toBe(false);
  });

  it('isAchievementUnlocked: returns true after achievement is unlocked', () => {
    useGamificationStore.setState({
      unlockedAchievements: [
        { achievementId: 'first_focus', unlockedAt: '2026-01-01T00:00:00.000Z', notified: false },
      ],
    });

    expect(useGamificationStore.getState().isAchievementUnlocked('first_focus')).toBe(true);
  });
});
