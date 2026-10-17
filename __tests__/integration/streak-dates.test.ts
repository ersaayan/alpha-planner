/**
 * Credits are booked on the day they happened, and the streak survives midnight,
 * late catch-up credits and daylight-saving changes.
 */
// jest.config.js runs the tests in America/New_York, a zone with DST.
import { ACHIEVEMENTS, XP_VALUES } from '@/constants/gamification';
import { useDailyQuestsStore } from '@/stores/daily-quests-store';
import { useGamificationStore } from '@/stores/gamification-store';
import { useWeeklyGoalsStore } from '@/stores/weekly-goals-store';
import { INITIAL_COMBO_STATE, INITIAL_PRESTIGE_STATE, INITIAL_USER_STATS, type DailyStats } from '@/types';
import { addDaysToKey, getDateKey } from '@/utils/date';

const store = () => useGamificationStore.getState();
const stats = () => store().stats;
const day = (key: string) => store().dailyStats.find((d) => d.date === key);

function activeDay(date: string): DailyStats {
  return { date, pomodorosCompleted: 1, focusTime: 1500, tasksCompleted: 0, xpEarned: 15, dailyQuestsCompleted: 0, summaryShownAt: null };
}

beforeEach(() => {
  useGamificationStore.setState({
    stats: { ...INITIAL_USER_STATS },
    // Keep achievement XP out of the numbers.
    unlockedAchievements: ACHIEVEMENTS.map((a) => ({ achievementId: a.id, unlockedAt: '', notified: true })),
    dailyStats: [],
    pendingNotifications: [],
    combo: { ...INITIAL_COMBO_STATE },
    prestige: { ...INITIAL_PRESTIGE_STATE },
  });
  useDailyQuestsStore.setState({ quests: [], lastGeneratedDate: null });
  useWeeklyGoalsStore.setState({ goals: [], lastGeneratedWeek: null });
});
afterEach(() => jest.useRealTimers());

it('a session that ended at 23:50 and is credited at 00:10 counts for the day it ended', () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 15, 0, 10) });
  useGamificationStore.setState({ stats: { ...INITIAL_USER_STATS, streakLength: 2, currentStreak: 2, lastActiveDate: '2026-10-13' } });

  store().incrementPomodoro(1500, new Date(2026, 9, 14, 23, 50));

  expect(day('2026-10-14')).toMatchObject({ pomodorosCompleted: 1, focusTime: 1500 });
  expect(day('2026-10-15')).toBeUndefined();
  expect(stats()).toMatchObject({ lastActiveDate: '2026-10-14', streakLength: 3, currentStreak: 3 });
});

it('a missed day shows the streak as 0, and the next activity starts a new one', () => {
  useGamificationStore.setState({ stats: { ...INITIAL_USER_STATS, streakLength: 6, currentStreak: 6, longestStreak: 6, lastActiveDate: '2026-10-12' } });

  store().refreshDayState(new Date(2026, 9, 13, 9));
  expect(stats().currentStreak).toBe(6); // yesterday was active: still alive today

  store().refreshDayState(new Date(2026, 9, 14, 9));
  expect(stats()).toMatchObject({ currentStreak: 0, streakLength: 6, longestStreak: 6 });

  store().incrementTaskCompleted({ at: new Date(2026, 9, 14, 10) });
  expect(stats()).toMatchObject({ currentStreak: 1, streakLength: 1, streakBreaks: 1, longestStreak: 6 });
});

it('a launch-time refresh before the late catch-up does not lose the streak', () => {
  useGamificationStore.setState({ stats: { ...INITIAL_USER_STATS, streakLength: 5, currentStreak: 5, lastActiveDate: '2026-10-13' } });
  // 00:10 on the 15th: the 14th has no activity yet, so the streak looks broken...
  store().refreshDayState(new Date(2026, 9, 15, 0, 10));
  expect(stats().currentStreak).toBe(0);
  // ...until the session that ended at 23:50 on the 14th is credited.
  store().incrementPomodoro(1500, new Date(2026, 9, 14, 23, 50));
  expect(stats()).toMatchObject({ currentStreak: 6, streakLength: 6, streakBreaks: 0 });
});

it('a late credit for yesterday joins the runs when today was already counted', () => {
  const dailyStats = ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'].map(activeDay);
  useGamificationStore.setState({
    dailyStats,
    stats: { ...INITIAL_USER_STATS, streakLength: 4, currentStreak: 4, longestStreak: 4, lastActiveDate: '2026-10-13' },
  });
  store().incrementTaskCompleted({ at: new Date(2026, 9, 15, 0, 5) }); // counted as a new streak of 1
  expect(stats()).toMatchObject({ streakLength: 1, streakBreaks: 1 });

  store().incrementPomodoro(1500, new Date(2026, 9, 14, 23, 50));
  expect(stats()).toMatchObject({ streakLength: 6, currentStreak: 6, longestStreak: 6, streakBreaks: 0 });
});

it('a combo day is counted on its own date', () => {
  store().incrementTaskCompleted({ at: new Date(2026, 9, 14, 20) });
  store().incrementPomodoro(1500, new Date(2026, 9, 14, 23, 50));
  expect(store().combo).toMatchObject({ dailyComboStreak: 1, lastDailyComboDate: '2026-10-14' });
});

describe('daylight saving time (America/New_York)', () => {
  it('the zone really changes offset in these tests', () => {
    expect(new Date(2026, 10, 1, 0, 30).getTimezoneOffset()).not.toBe(new Date(2026, 10, 2, 0, 30).getTimezoneOffset());
  });

  it('day keys step one calendar day across both changes', () => {
    expect(addDaysToKey('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysToKey('2026-11-01', 1)).toBe('2026-11-02');
    expect(addDaysToKey('2026-03-08', -1)).toBe('2026-03-07');
    expect(addDaysToKey('2026-03-07', 2)).toBe('2026-03-09');
    expect(getDateKey(new Date(2026, 10, 1, 23, 59))).toBe('2026-11-01');
  });

  it('a streak continues through the night the clocks go back', () => {
    for (const date of [new Date(2026, 9, 31, 23, 30), new Date(2026, 10, 1, 23, 30), new Date(2026, 10, 2, 0, 30)]) {
      store().incrementPomodoro(1500, date);
    }
    expect(stats()).toMatchObject({ streakLength: 3, currentStreak: 3, lastActiveDate: '2026-11-02' });
    // Two consecutive-day bonuses.
    const bonuses = store().dailyStats.reduce((sum, d) => sum + d.xpEarned, 0) - 3 * XP_VALUES.POMODORO_COMPLETE;
    expect(bonuses).toBeGreaterThanOrEqual(2 * XP_VALUES.DAILY_STREAK);
  });

  it('a streak continues through the night the clocks go forward', () => {
    for (const date of [new Date(2026, 2, 7, 22), new Date(2026, 2, 8, 3, 30), new Date(2026, 2, 9, 8)]) {
      store().incrementTaskCompleted({ at: date });
    }
    expect(stats()).toMatchObject({ streakLength: 3, lastActiveDate: '2026-03-09' });
    store().refreshDayState(new Date(2026, 2, 10, 23, 59));
    expect(stats().currentStreak).toBe(3);
  });
});
