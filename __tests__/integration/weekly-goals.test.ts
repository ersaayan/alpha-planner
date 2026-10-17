/** Weekly goals with the real stores: every metric moves, and every goal can be reached. */
import { WEEKLY_GOAL_TEMPLATES, reachableWeeklyTarget } from '@/constants/weekly-goals';
import { useDailyQuestsStore } from '@/stores/daily-quests-store';
import { useGamificationStore } from '@/stores/gamification-store';
import { daysLeftInWeek, useWeeklyGoalsStore } from '@/stores/weekly-goals-store';
import { ACHIEVEMENTS } from '@/constants/gamification';
import { INITIAL_COMBO_STATE, INITIAL_PRESTIGE_STATE, INITIAL_USER_STATS, type WeeklyGoal } from '@/types';

const MONDAY = new Date(2026, 9, 12, 9, 0); // week of 2026-10-12
const WEEK = '2026-10-12';
const at = (dayOffset: number, hour = 10) => new Date(2026, 9, 12 + dayOffset, hour, 0);

function goal(metric: string, targetValue: number, overrides: Partial<WeeklyGoal> = {}): WeeklyGoal {
  return {
    id: metric,
    weekStart: WEEK,
    goalType: 'system',
    goalParams: { metric },
    targetValue,
    currentValue: 0,
    isCompleted: false,
    xpReward: 100,
    ...overrides,
  };
}
const byId = () => Object.fromEntries(useWeeklyGoalsStore.getState().goals.map((g) => [g.id, g]));

beforeEach(() => {
  jest.useFakeTimers({ now: MONDAY });
  useGamificationStore.setState({
    stats: { ...INITIAL_USER_STATS },
    unlockedAchievements: ACHIEVEMENTS.map((a) => ({ achievementId: a.id, unlockedAt: '', notified: true })),
    dailyStats: [],
    pendingNotifications: [],
    combo: { ...INITIAL_COMBO_STATE },
    prestige: { ...INITIAL_PRESTIGE_STATE },
  });
  useDailyQuestsStore.setState({ quests: [], lastGeneratedDate: null });
  useWeeklyGoalsStore.setState({ goals: [], lastGeneratedWeek: WEEK });
});
afterEach(() => jest.useRealTimers());

describe('every metric moves', () => {
  it('streak_days follows consecutive active days of the week', () => {
    useWeeklyGoalsStore.setState({ goals: [goal('streak_days', 3)] });
    for (const day of [0, 1]) useGamificationStore.getState().incrementPomodoro(1500, at(day));
    expect(byId().streak_days.currentValue).toBe(2);
    useGamificationStore.getState().incrementTaskCompleted({ at: at(2) });
    expect(byId().streak_days).toMatchObject({ currentValue: 3, isCompleted: true });
  });

  it('quest_days counts the perfect quest days of the week', () => {
    useWeeklyGoalsStore.setState({ goals: [goal('quest_days', 2)] });
    useGamificationStore.getState().recordQuestCompleted(at(0), true);
    useGamificationStore.getState().recordQuestCompleted(at(1), false);
    expect(byId().quest_days.currentValue).toBe(1);
    useGamificationStore.getState().recordQuestCompleted(at(3), true);
    expect(byId().quest_days).toMatchObject({ currentValue: 2, isCompleted: true });
  });

  it('completing a goal pays its XP and records the day for overachiever', () => {
    useWeeklyGoalsStore.setState({ goals: [goal('pomodoros', 1)] });
    const before = useGamificationStore.getState().stats.totalXp;
    useGamificationStore.getState().incrementPomodoro(1500, at(0));
    expect(byId().pomodoros.isCompleted).toBe(true);
    const day = useGamificationStore.getState().dailyStats.find((d) => d.date === WEEK)!;
    expect(day.weeklyGoalsCompleted).toBe(1);
    // pomodoro XP + goal XP + all-goals bonus
    expect(useGamificationStore.getState().stats.totalXp - before).toBe(15 + 100 + 100);
  });

  it('a session that ended on Sunday night counts for that week', () => {
    jest.setSystemTime(new Date(2026, 9, 19, 0, 10));
    useWeeklyGoalsStore.setState({ goals: [goal('pomodoros', 5), goal('pomodoros', 5, { id: 'next', weekStart: '2026-10-19' })] });
    useGamificationStore.getState().incrementPomodoro(1500, new Date(2026, 9, 18, 23, 50));
    expect(byId().pomodoros.currentValue).toBe(1);
    expect(byId().next.currentValue).toBe(0);
  });
});

describe('every generated goal is reachable', () => {
  it('targets shrink with the days left in the week', () => {
    for (let daysLeft = 1; daysLeft <= 7; daysLeft++) {
      for (const template of WEEKLY_GOAL_TEMPLATES) {
        const target = reachableWeeklyTarget(template, template.maxValue, daysLeft);
        if (target === null) continue;
        expect(target).toBeLessThanOrEqual(template.perDayCap * daysLeft);
        if (template.derived) expect(target).toBeLessThanOrEqual(daysLeft);
      }
    }
  });

  it('a week that starts on Saturday gets no 7-day streak', () => {
    const saturday = new Date(2026, 9, 17, 9, 0);
    expect(daysLeftInWeek(saturday)).toBe(2);
    for (let i = 0; i < 30; i++) {
      useWeeklyGoalsStore.setState({ goals: [], lastGeneratedWeek: null });
      useWeeklyGoalsStore.getState().ensureThisWeekGoals(saturday);
      for (const g of useWeeklyGoalsStore.getState().goals) {
        const metric = (g.goalParams as { metric: string }).metric;
        if (metric === 'streak_days' || metric === 'quest_days') expect(g.targetValue).toBeLessThanOrEqual(2);
        expect(g.goalParams).toMatchObject({ since: '2026-10-17' });
      }
    }
  });

  it('on Sunday only goals that fit in one day are generated', () => {
    const sunday = new Date(2026, 9, 18, 9, 0);
    for (let i = 0; i < 20; i++) {
      useWeeklyGoalsStore.setState({ goals: [], lastGeneratedWeek: null });
      useWeeklyGoalsStore.getState().ensureThisWeekGoals(sunday);
      const metrics = useWeeklyGoalsStore.getState().goals.map((g) => (g.goalParams as { metric: string }).metric);
      expect(metrics).not.toContain('streak_days');
      expect(metrics).not.toContain('quest_days');
    }
  });
});

describe('personal goal', () => {
  it('starts from this week so far and must be ahead of it', () => {
    for (const day of [0, 1]) useGamificationStore.getState().incrementPomodoro(1500, at(day));
    jest.setSystemTime(at(2));
    expect(useWeeklyGoalsStore.getState().setPersonalGoal('pomodoros', 2)).toBe(false);
    expect(useWeeklyGoalsStore.getState().setPersonalGoal('pomodoros', 6)).toBe(true);
    expect(byId()[useWeeklyGoalsStore.getState().goals[0].id]).toMatchObject({ currentValue: 2, targetValue: 6 });
  });

  it('pays once a week: a completed personal goal cannot be replaced', () => {
    expect(useWeeklyGoalsStore.getState().setPersonalGoal('tasks', 3)).toBe(true);
    for (let i = 0; i < 3; i++) useGamificationStore.getState().incrementTaskCompleted({ at: at(0) });
    expect(useWeeklyGoalsStore.getState().goals[0].isCompleted).toBe(true);
    expect(useWeeklyGoalsStore.getState().setPersonalGoal('tasks', 10)).toBe(false);
  });

  it('rejects unknown metrics and out-of-range targets', () => {
    expect(useWeeklyGoalsStore.getState().setPersonalGoal('naps', 5)).toBe(false);
    expect(useWeeklyGoalsStore.getState().setPersonalGoal('streak_days', 9)).toBe(false);
    expect(useWeeklyGoalsStore.getState().setPersonalGoal('tasks', 1)).toBe(false);
  });
});
