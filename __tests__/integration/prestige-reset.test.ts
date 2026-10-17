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
import { INITIAL_COMBO_STATE, INITIAL_PRESTIGE_STATE, INITIAL_USER_STATS } from '@/types';

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

/** Returns current month as "YYYY-MM" */
function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
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
      prestige: { count: 0, currentSeasonStart: currentMonth, history: [] },
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
      prestige: { count: 0, currentSeasonStart: '2026-01', history: [] },
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
      prestige: { count: 0, currentSeasonStart: '2026-02', history: [] },
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
      prestige: { count: 0, currentSeasonStart: '2026-02', history: [] },
      stats: { ...INITIAL_USER_STATS, level: 15, totalXp: 3000 },
      unlockedAchievements: achievements,
    });

    useGamificationStore.getState().checkPrestigeReset();

    const { unlockedAchievements } = useGamificationStore.getState();
    expect(unlockedAchievements).toHaveLength(2);
    expect(unlockedAchievements[0].achievementId).toBe('first_focus');
    expect(unlockedAchievements[1].achievementId).toBe('task_starter');
  });

  it('checkPrestigeReset increments prestige count', () => {
    useGamificationStore.setState({
      ...GAMIFICATION_INITIAL,
      prestige: { count: 2, currentSeasonStart: '2026-01', history: [
        { month: '2025-11', finalLevel: 20, totalXp: 4000, rewards: [] },
        { month: '2025-12', finalLevel: 18, totalXp: 3500, rewards: [] },
      ]},
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
      ]},
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

  it('checkPrestigeReset resets combo state', () => {
    useGamificationStore.setState({
      ...GAMIFICATION_INITIAL,
      prestige: { count: 0, currentSeasonStart: '2026-01', history: [] },
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
    expect(combo.sessionCombo).toBe(0);
    expect(combo.dailyComboStreak).toBe(0);
    expect(combo.lastDailyComboDate).toBeNull();
  });
});
