/**
 * Integration tests: Prestige Reset in Gamification Store
 *
 * Tests that the monthly prestige reset correctly resets transient state
 * (level, XP, combo) while preserving cumulative stats and achievements.
 *
 * Real stores are used; only external services are mocked (via jest.setup.ts).
 */

import { useGamificationStore } from '@/stores/gamification-store';
import { useSyncStore } from '@/stores/sync-store';
import { INITIAL_COMBO_STATE, INITIAL_PRESTIGE_STATE, INITIAL_USER_STATS, currentMonthKey, type DailyStats } from '@/types';
import { migrateGamificationState } from '@/stores/gamification-store';
import { SEASON_REWARDS } from '@/services/gamification/season';
import { ACHIEVEMENTS, LEVELS, calculateLevel } from '@/constants/gamification';

// ---------------------------------------------------------------------------
// Reset helpers
// ---------------------------------------------------------------------------

const GAMIFICATION_INITIAL = {
  stats: { ...INITIAL_USER_STATS },
  unlockedAchievements: [],
  dailyStats: [],
  pendingNotifications: [],
  combo: { ...INITIAL_COMBO_STATE },
  prestige: { ...INITIAL_PRESTIGE_STATE },
};

const SYNC_INITIAL = {
  pendingOperations: [],
  lastSyncedAt: null,
  isSyncing: false,
  lastError: null,
};

/** Returns the current local month as "YYYY-MM" */
function getCurrentMonth(): string {
  return currentMonthKey();
}

beforeEach(() => {
  useGamificationStore.setState(GAMIFICATION_INITIAL);
  useSyncStore.setState(SYNC_INITIAL);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Prestige reset integration', () => {
  it('checkPrestigeReset does nothing when still in current month', () => {
    const currentMonth = getCurrentMonth();

    useGamificationStore.setState({
      ...GAMIFICATION_INITIAL,
      prestige: { count: 0, currentSeasonStart: currentMonth, history: [], acknowledgedMonth: null },
      stats: { ...INITIAL_USER_STATS, level: 10, totalXp: 2000, currentXp: 200 },
    });

    useGamificationStore.getState().checkPrestigeReset();

    const { stats, prestige } = useGamificationStore.getState();
    // Nothing should change
    expect(stats.level).toBe(10);
    expect(stats.totalXp).toBe(2000);
    expect(prestige.count).toBe(0);
    expect(prestige.currentSeasonStart).toBe(currentMonth);
  });

  it('checkPrestigeReset resets level to 1 and currentXp to 0 on new month', () => {
    useGamificationStore.setState({
      ...GAMIFICATION_INITIAL,
      // Without achievement XP (first_prestige would otherwise start the new season).
      unlockedAchievements: ACHIEVEMENTS.map((a) => ({ achievementId: a.id, unlockedAt: '', notified: true })),
      prestige: { count: 0, currentSeasonStart: '2026-01', history: [], acknowledgedMonth: null },
      stats: {
        ...INITIAL_USER_STATS,
        level: 25,
        currentXp: 500,
        totalXp: 5000,
        totalPomodoros: 100,
        totalFocusTime: 150000,
        totalTasksCompleted: 80,
      },
    });

    useGamificationStore.getState().checkPrestigeReset();

    const { stats } = useGamificationStore.getState();
    expect(stats.level).toBe(1);
    expect(stats.currentXp).toBe(0);
    expect(stats.totalXp).toBe(0);
  });

  it('checkPrestigeReset preserves totalPomodoros and totalFocusTime', () => {
    useGamificationStore.setState({
      ...GAMIFICATION_INITIAL,
      prestige: { count: 0, currentSeasonStart: '2026-02', history: [], acknowledgedMonth: null },
      stats: {
        ...INITIAL_USER_STATS,
        level: 30,
        totalXp: 8000,
        currentXp: 300,
        totalPomodoros: 200,
        totalFocusTime: 300000,
        totalTasksCompleted: 150,
        currentStreak: 14,
        longestStreak: 20,
      },
    });

    useGamificationStore.getState().checkPrestigeReset();

    const { stats } = useGamificationStore.getState();
    // These should be preserved
    expect(stats.totalPomodoros).toBe(200);
    expect(stats.totalFocusTime).toBe(300000);
    expect(stats.totalTasksCompleted).toBe(150);
    expect(stats.currentStreak).toBe(14);
    expect(stats.longestStreak).toBe(20);
  });

  it('checkPrestigeReset preserves unlockedAchievements', () => {
    const achievements = [
      { achievementId: 'first_focus', unlockedAt: '2026-02-15T10:00:00.000Z', notified: true },
      { achievementId: 'task_starter', unlockedAt: '2026-02-16T10:00:00.000Z', notified: true },
    ];

    useGamificationStore.setState({
      ...GAMIFICATION_INITIAL,
      prestige: { count: 0, currentSeasonStart: '2026-02', history: [], acknowledgedMonth: null },
      stats: { ...INITIAL_USER_STATS, level: 15, totalXp: 3000 },
      unlockedAchievements: achievements,
    });

    useGamificationStore.getState().checkPrestigeReset();

    const { unlockedAchievements } = useGamificationStore.getState();
    expect(unlockedAchievements[0].achievementId).toBe('first_focus');
    expect(unlockedAchievements[1].achievementId).toBe('task_starter');
    // ...and the prestige itself is an achievement.
    expect(unlockedAchievements.map((a) => a.achievementId)).toContain('first_prestige');
  });

  it('checkPrestigeReset increments prestige count', () => {
    useGamificationStore.setState({
      ...GAMIFICATION_INITIAL,
      prestige: { count: 2, currentSeasonStart: '2026-01', history: [
        { month: '2025-11', finalLevel: 20, totalXp: 4000, rewards: [] },
        { month: '2025-12', finalLevel: 18, totalXp: 3500, rewards: [] },
      ], acknowledgedMonth: '2025-12' },
      stats: { ...INITIAL_USER_STATS, level: 22, totalXp: 4500 },
    });

    useGamificationStore.getState().checkPrestigeReset();

    const { prestige } = useGamificationStore.getState();
    expect(prestige.count).toBe(3);
    expect(prestige.currentSeasonStart).toBe(getCurrentMonth());
  });

  it('checkPrestigeReset adds record to prestige history', () => {
    useGamificationStore.setState({
      ...GAMIFICATION_INITIAL,
      prestige: { count: 1, currentSeasonStart: '2026-03', history: [
        { month: '2026-02', finalLevel: 15, totalXp: 3000, rewards: [] },
      ], acknowledgedMonth: '2026-02' },
      stats: { ...INITIAL_USER_STATS, level: 20, totalXp: 4000 },
    });

    useGamificationStore.getState().checkPrestigeReset();

    const { prestige } = useGamificationStore.getState();
    expect(prestige.history).toHaveLength(2);

    const latestRecord = prestige.history[1];
    expect(latestRecord.month).toBe('2026-03');
    expect(latestRecord.finalLevel).toBe(20);
    expect(latestRecord.totalXp).toBe(4000);
    expect(latestRecord.rewards).toEqual([]);
  });

  it('checkPrestigeReset keeps combos (a month change must not break a 30-day combo)', () => {
    useGamificationStore.setState({
      ...GAMIFICATION_INITIAL,
      prestige: { count: 0, currentSeasonStart: '2026-01', history: [], acknowledgedMonth: null },
      stats: { ...INITIAL_USER_STATS, level: 10, totalXp: 2000 },
      combo: {
        sessionCombo: 5,
        dailyComboStreak: 7,
        lastDailyComboDate: '2026-01-30',
        lastSessionAt: null,
      },
    });

    useGamificationStore.getState().checkPrestigeReset();

    const { combo } = useGamificationStore.getState();
    expect(combo.dailyComboStreak).toBe(7);
    expect(combo.lastDailyComboDate).toBe('2026-01-30');
  });
});

describe('season rewards', () => {
  const day = (date: string, overrides: Partial<DailyStats> = {}): DailyStats => ({
    date, pomodorosCompleted: 0, focusTime: 0, tasksCompleted: 0, xpEarned: 0, dailyQuestsCompleted: 0, summaryShownAt: null, ...overrides,
  });
  const september = (overrides: Partial<DailyStats>, count = 30) =>
    Array.from({ length: count }, (_, i) => day(`2026-09-${String(i + 1).padStart(2, '0')}`, overrides));

  const startSeason = (dailyStats: DailyStats[], stats: Partial<typeof INITIAL_USER_STATS> = {}) =>
    useGamificationStore.setState({
      ...GAMIFICATION_INITIAL,
      // Measure the season mechanics only.
      unlockedAchievements: [],
      dailyStats,
      stats: { ...INITIAL_USER_STATS, level: 12, totalXp: 6000, ...stats },
      prestige: { count: 0, currentSeasonStart: '2026-09', history: [], acknowledgedMonth: null },
    });

  it('are based on the finished season, not lifetime totals', () => {
    // Huge lifetime totals, a quiet September.
    startSeason(september({ pomodorosCompleted: 1 }, 5), { totalPomodoros: 5000, totalTasksCompleted: 900, currentStreak: 400 });
    const record = useGamificationStore.getState().checkPrestigeReset(new Date(2026, 9, 1, 9))!;
    expect(record.rewards).toEqual([]);
    expect(record).toMatchObject({ month: '2026-09', finalLevel: 12, totalXp: 6000, pomodoros: 5, activeDays: 5 });
  });

  it('a strong season earns its rewards; their XP is the new season head start', () => {
    startSeason(september({ pomodorosCompleted: 4, tasksCompleted: 2, perfectQuestDay: true }), { level: 31, totalXp: LEVELS[30].xpRequired });
    const record = useGamificationStore.getState().checkPrestigeReset(new Date(2026, 9, 1, 9))!;
    expect(record.rewards.sort()).toEqual(SEASON_REWARDS.map((r) => r.id).sort());
    const rewardXp = SEASON_REWARDS.reduce((sum, r) => sum + r.xp, 0);
    expect(record.rewardXp).toBe(rewardXp);

    const { stats, prestige } = useGamificationStore.getState();
    // Not wiped by the reset: the new season starts with it.
    expect(stats.totalXp).toBeGreaterThanOrEqual(rewardXp);
    expect(stats.level).toBe(calculateLevel(stats.totalXp));
    expect(prestige).toMatchObject({ count: 1, currentSeasonStart: '2026-10' });
    expect(prestige.history[0].rewards.length).toBe(SEASON_REWARDS.length);
  });

  it('quest_hunter needs real quest days, not 0–1 active days', () => {
    startSeason([day('2026-09-03', { pomodorosCompleted: 1 })]);
    expect(useGamificationStore.getState().checkPrestigeReset(new Date(2026, 9, 1))!.rewards).not.toContain('quest_hunter');
    startSeason([]);
    useGamificationStore.setState({ stats: { ...INITIAL_USER_STATS, totalXp: 10 } });
    expect(useGamificationStore.getState().checkPrestigeReset(new Date(2026, 9, 1))!.rewards).toEqual([]);
  });

  it('an empty season moves on without a prestige', () => {
    useGamificationStore.setState({ ...GAMIFICATION_INITIAL, prestige: { count: 2, currentSeasonStart: '2026-07', history: [], acknowledgedMonth: null } });
    expect(useGamificationStore.getState().checkPrestigeReset(new Date(2026, 9, 5))).toBeNull();
    expect(useGamificationStore.getState().prestige).toMatchObject({ count: 2, currentSeasonStart: '2026-10' });
  });

  it('the season follows the local month, not UTC', () => {
    startSeason(september({ pomodorosCompleted: 1 }, 3));
    // 31 Oct 2026, 23:30 in New York is already November in UTC.
    useGamificationStore.setState({ prestige: { count: 0, currentSeasonStart: '2026-10', history: [], acknowledgedMonth: null } });
    const lateOctober = new Date(2026, 9, 31, 23, 30);
    expect(lateOctober.toISOString().startsWith('2026-11')).toBe(true);
    expect(useGamificationStore.getState().checkPrestigeReset(lateOctober)).toBeNull();
    expect(useGamificationStore.getState().prestige.count).toBe(0);
  });

  it('a clock moved back to an earlier month does not reset anything', () => {
    startSeason([]);
    useGamificationStore.setState({ prestige: { count: 1, currentSeasonStart: '2026-11', history: [], acknowledgedMonth: null } });
    expect(useGamificationStore.getState().checkPrestigeReset(new Date(2026, 9, 20))).toBeNull();
    expect(useGamificationStore.getState().stats.level).toBe(12);
  });

  it('the v3 migration marks old seasons as already seen', () => {
    const migrated = migrateGamificationState({ prestige: { count: 2, history: [{ month: '2026-08' }, { month: '2026-09' }] } }, 2);
    expect(migrated.prestige.acknowledgedMonth).toBe('2026-09');
  });
});
