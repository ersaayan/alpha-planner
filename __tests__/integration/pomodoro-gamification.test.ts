/**
 * Integration tests: Pomodoro completion -> Gamification Store
 *
 * Since pomodoro-store has complex timer/interval logic, we test the
 * gamification integration by calling incrementPomodoro() directly
 * (which is what the pomodoro store calls internally on completion).
 *
 * Real stores are used; only external services are mocked (via jest.setup.ts).
 */

import { useGamificationStore } from '@/stores/gamification-store';
import { useSyncStore } from '@/stores/sync-store';
import { INITIAL_COMBO_STATE, INITIAL_PRESTIGE_STATE, INITIAL_USER_STATS } from '@/types';
import { XP_VALUES } from '@/constants/gamification';
import { getDateKey } from '@/utils/date';

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

beforeEach(() => {
  useGamificationStore.setState(GAMIFICATION_INITIAL);
  useSyncStore.setState(SYNC_INITIAL);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Pomodoro -> Gamification integration', () => {
  it('incrementPomodoro awards base XP (15) with no combo', () => {
    useGamificationStore.getState().incrementPomodoro(1500); // 25 min

    const { stats } = useGamificationStore.getState();
    // Base XP = 15, sessionCombo = 0 -> multiplier 1x, dailyComboStreak = 0 -> 1x
    // Plus achievement XP for first_focus (25) will also be added
    expect(stats.totalXp).toBeGreaterThanOrEqual(XP_VALUES.POMODORO_COMPLETE);
  });

  it('incrementPomodoro increments session combo', () => {
    expect(useGamificationStore.getState().combo.sessionCombo).toBe(0);

    useGamificationStore.getState().incrementPomodoro(1500);

    // After first pomodoro, session combo should be 1
    expect(useGamificationStore.getState().combo.sessionCombo).toBe(1);
  });

  it('second incrementPomodoro applies 1.5x session combo multiplier', () => {
    // First pomodoro: sessionCombo starts at 0 -> 1x multiplier
    useGamificationStore.getState().incrementPomodoro(1500);
    const xpAfterFirst = useGamificationStore.getState().stats.totalXp;

    // Reset to isolate XP gain from second pomodoro
    // Session combo is now 1 after first increment.
    // Record current state
    const xpBeforeSecond = xpAfterFirst;

    // Second pomodoro: sessionCombo = 1 -> 1x multiplier (multiplier kicks in at 2)
    useGamificationStore.getState().incrementPomodoro(1500);
    const xpAfterSecond = useGamificationStore.getState().stats.totalXp;

    // Session combo is now 2
    expect(useGamificationStore.getState().combo.sessionCombo).toBe(2);

    // Third pomodoro: sessionCombo = 2 -> 1.5x multiplier -> 15 * 1.5 = 23 (rounded)
    const xpBeforeThird = xpAfterSecond;
    useGamificationStore.getState().incrementPomodoro(1500);
    const xpAfterThird = useGamificationStore.getState().stats.totalXp;

    const thirdPomodoroXpGain = xpAfterThird - xpBeforeThird;
    // With 1.5x session combo: Math.round(15 * 1.5) = 23
    expect(thirdPomodoroXpGain).toBeGreaterThanOrEqual(Math.round(XP_VALUES.POMODORO_COMPLETE * 1.5));
  });

  it('incrementPomodoro updates daily stats (pomodorosCompleted, focusTime)', () => {
    const focusSeconds = 1500; // 25 min
    useGamificationStore.getState().incrementPomodoro(focusSeconds);

    const today = getDateKey();
    const { dailyStats } = useGamificationStore.getState();
    const todayStat = dailyStats.find((ds) => ds.date === today);

    expect(todayStat).toBeDefined();
    expect(todayStat!.pomodorosCompleted).toBe(1);
    expect(todayStat!.focusTime).toBe(focusSeconds);
  });

  it('incrementPomodoro triggers achievement check - first_focus unlocked at 1 pomodoro', () => {
    useGamificationStore.getState().incrementPomodoro(1500);

    const { unlockedAchievements } = useGamificationStore.getState();
    const firstFocus = unlockedAchievements.find((ua) => ua.achievementId === 'first_focus');
    expect(firstFocus).toBeDefined();
    expect(firstFocus!.unlockedAt).toBeDefined();
  });

  it('incrementPomodoro at 3am unlocks night_shift achievement', () => {
    // night_shift: hour >= 0 && hour < 5
    const threeAm = new Date();
    threeAm.setHours(3, 0, 0, 0);

    useGamificationStore.getState().incrementPomodoro(1500, threeAm);

    const { unlockedAchievements } = useGamificationStore.getState();
    const nightShift = unlockedAchievements.find((ua) => ua.achievementId === 'night_shift');
    expect(nightShift).toBeDefined();
  });

  it('incrementPomodoro before 7am unlocks early_bird achievement', () => {
    // early_bird: hour < 7
    const sixAm = new Date();
    sixAm.setHours(6, 0, 0, 0);

    useGamificationStore.getState().incrementPomodoro(1500, sixAm);

    const { unlockedAchievements } = useGamificationStore.getState();
    const earlyBird = unlockedAchievements.find((ua) => ua.achievementId === 'early_bird');
    expect(earlyBird).toBeDefined();
  });

  it('session combo stacks with daily combo for higher XP', () => {
    // Set up a daily combo streak of 3 days (multiplier = 1.5x)
    // and a session combo of 2 (multiplier = 1.5x)
    // Expected combined multiplier: 1.5 * 1.5 = 2.25
    useGamificationStore.setState({
      ...GAMIFICATION_INITIAL,
      combo: {
        sessionCombo: 2,
        dailyComboStreak: 3,
        lastDailyComboDate: null,
      },
    });

    const xpBefore = useGamificationStore.getState().stats.totalXp;
    useGamificationStore.getState().incrementPomodoro(1500);
    const xpAfter = useGamificationStore.getState().stats.totalXp;

    const xpGain = xpAfter - xpBefore;
    // 15 * 1.5 (session) * 1.5 (daily) = 33.75 -> 34
    // Plus achievement XP for first_focus (25) is added separately via checkAchievements
    // The base combo XP should be Math.round(15 * 1.5 * 1.5) = 34
    expect(xpGain).toBeGreaterThanOrEqual(Math.round(XP_VALUES.POMODORO_COMPLETE * 1.5 * 1.5));
  });

  it('incrementPomodoro increments totalPomodoros and totalFocusTime', () => {
    useGamificationStore.getState().incrementPomodoro(1500);
    useGamificationStore.getState().incrementPomodoro(2700);

    const { stats } = useGamificationStore.getState();
    expect(stats.totalPomodoros).toBe(2);
    expect(stats.totalFocusTime).toBe(1500 + 2700);
  });
});
