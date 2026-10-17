import { ACHIEVEMENTS, LEVELS, getAchievementById } from '@/constants/gamification';
import {
  getAchievementProgress,
  isAchievementEarned,
  longestRun,
  type AchievementContext,
} from '@/services/gamification/achievement-rules';
import { DEFAULT_CATEGORIES, INITIAL_USER_STATS, type Category, type DailyStats } from '@/types';
import { addDaysToKey } from '@/utils/date';

const TODAY = '2026-10-14'; // a Wednesday

function day(date: string, overrides: Partial<DailyStats> = {}): DailyStats {
  return {
    date,
    pomodorosCompleted: 1,
    focusTime: 1500,
    tasksCompleted: 0,
    xpEarned: 0,
    dailyQuestsCompleted: 0,
    summaryShownAt: null,
    ...overrides,
  };
}

function context(overrides: Partial<AchievementContext> = {}): AchievementContext {
  return {
    stats: { ...INITIAL_USER_STATS },
    sessionCombo: 0,
    dailyCombo: 0,
    prestigeCount: 0,
    dailyStats: [],
    dateKey: TODAY,
    todos: [],
    categories: [],
    ...overrides,
  };
}

const earned = (id: string, ctx: AchievementContext) => isAchievementEarned(getAchievementById(id)!, ctx);
const days = (from: string, count: number, overrides: Partial<DailyStats> = {}) =>
  Array.from({ length: count }, (_, i) => day(addDaysToKey(from, i), overrides));

const DEFAULTS: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({ ...c, id: `d${i}`, createdAt: '' }));
const own = (id: string, color: string): Category => ({
  id, name: id, color, icon: null, isDefault: false, order: 9, createdAt: '',
});

describe('achievements that could never unlock', () => {
  it('100 / 180 / 365 active days use the lifetime counter, not the 90-day window', () => {
    const ctx = context({ stats: { ...INITIAL_USER_STATS, activeDays: 365 }, dailyStats: days('2026-07-17', 90) });
    expect(earned('hundred_days', ctx)).toBe(true);
    expect(earned('half_year', ctx)).toBe(true);
    expect(earned('one_year', ctx)).toBe(true);
    expect(earned('one_year', context({ stats: { ...INITIAL_USER_STATS, activeDays: 364 } }))).toBe(false);
  });

  it('perfect quest days count perfect days, and 100 of them come from the lifetime counter', () => {
    expect(earned('quest_beginner', context({ dailyStats: [day(TODAY, { perfectQuestDay: true, dailyQuestsCompleted: 2 })] }))).toBe(true);
    expect(earned('quest_beginner', context({ dailyStats: [day(TODAY, { dailyQuestsCompleted: 2 })] }))).toBe(false);
    expect(earned('quest_master', context({ stats: { ...INITIAL_USER_STATS, perfectQuestDays: 100 } }))).toBe(true);
  });

  it('perfect week / month need consecutive perfect days', () => {
    const scattered = [0, 2, 4, 6, 8, 10, 12].map((n) => day(addDaysToKey('2026-09-01', n), { perfectQuestDay: true }));
    expect(earned('perfect_week', context({ dailyStats: scattered }))).toBe(false);
    expect(earned('perfect_week', context({ dailyStats: days('2026-10-01', 7, { perfectQuestDay: true }) }))).toBe(true);
  });

  it('speed_leveler looks at the levels gained in the last 7 days', () => {
    const xpFor = (level: number) => LEVELS[level - 1].xpRequired;
    const stats = { ...INITIAL_USER_STATS, totalXp: xpFor(15), level: 15 };
    // All of it earned this week: 1 → 15.
    const fast = context({ stats, dailyStats: [day(TODAY, { xpEarned: xpFor(15) })] });
    expect(earned('speed_leveler', fast)).toBe(true);
    // Earned over a month: only the last week counts.
    const slow = context({ stats, dailyStats: [day('2026-09-01', { xpEarned: xpFor(14) }), day(TODAY, { xpEarned: xpFor(15) - xpFor(14) })] });
    expect(getAchievementProgress(getAchievementById('speed_leveler')!, slow)!.current).toBe(1);
    expect(earned('speed_leveler', slow)).toBe(false);
  });

  it('zen_master needs 7 days in a row of breaks taken and none skipped', () => {
    expect(earned('zen_master', context({ dailyStats: days('2026-10-08', 7, { breaksCompleted: 2, breaksSkipped: 0 }) }))).toBe(true);
    const oneSkip = days('2026-10-08', 7, { breaksCompleted: 2 });
    oneSkip[3] = { ...oneSkip[3], breaksSkipped: 1 };
    expect(earned('zen_master', context({ dailyStats: oneSkip }))).toBe(false);
  });

  it('overachiever: all quests and a weekly goal on the same day', () => {
    expect(earned('overachiever', context({ dailyStats: [day(TODAY, { perfectQuestDay: true, weeklyGoalsCompleted: 1 })] }))).toBe(true);
    expect(earned('overachiever', context({ dailyStats: [day(TODAY, { perfectQuestDay: true })] }))).toBe(false);
  });

  it('event-based achievements are not evaluated from stats', () => {
    for (const id of ['speed_runner', 'last_minute', 'early_bird', 'night_owl']) {
      expect(getAchievementProgress(getAchievementById(id)!, context())).toBeNull();
    }
  });
});

describe('achievements that unlocked for free', () => {
  it('organizer and color_collector ignore the default categories', () => {
    expect(earned('organizer', context({ categories: DEFAULTS }))).toBe(false);
    expect(earned('color_collector', context({ categories: DEFAULTS }))).toBe(false);
    const mine = ['#111111', '#222222', '#333333', '#444444', '#555555'].map((c, i) => own(`c${i}`, c));
    expect(earned('organizer', context({ categories: [...DEFAULTS, ...mine] }))).toBe(true);
    expect(earned('color_collector', context({ categories: [...DEFAULTS, ...mine] }))).toBe(true);
  });

  it('comeback needs a broken streak first; unbreakable needs one never broken', () => {
    const streak7 = { ...INITIAL_USER_STATS, currentStreak: 7 };
    expect(earned('comeback', context({ stats: streak7 }))).toBe(false);
    expect(earned('comeback', context({ stats: { ...streak7, streakBreaks: 1 } }))).toBe(true);
    const streak30 = { ...INITIAL_USER_STATS, currentStreak: 30 };
    expect(earned('unbreakable', context({ stats: streak30 }))).toBe(true);
    expect(earned('unbreakable', context({ stats: { ...streak30, streakBreaks: 2 } }))).toBe(false);
  });

  it('weekend_warrior pairs a Saturday with the following Sunday', () => {
    // Sunday 11 Oct and Saturday 17 Oct are not one weekend.
    expect(earned('weekend_warrior', context({ dailyStats: [day('2026-10-11'), day('2026-10-17')] }))).toBe(false);
    expect(earned('weekend_warrior', context({ dailyStats: [day('2026-10-10'), day('2026-10-11')] }))).toBe(true);
  });

  it('clean_slate needs three tasks finished that day and nothing left open', () => {
    expect(earned('clean_slate', context({ dailyStats: [day(TODAY, { tasksCompleted: 1 })] }))).toBe(false);
    expect(earned('clean_slate', context({ dailyStats: [day(TODAY, { tasksCompleted: 3 })] }))).toBe(true);
  });

  it('category and urgent counts survive archiving and deleting through the lifetime counters', () => {
    const stats = { ...INITIAL_USER_STATS, urgentTasksCompleted: 10, categoryTaskCounts: { a: 50 } };
    expect(earned('urgent_handler', context({ stats }))).toBe(true);
    expect(earned('category_specialist', context({ stats }))).toBe(true);
  });
});

describe('longestRun', () => {
  it('breaks a run on a calendar gap', () => {
    const run = [day('2026-10-01'), day('2026-10-02'), day('2026-10-04'), day('2026-10-05'), day('2026-10-06')];
    expect(longestRun(run, () => true)).toBe(3);
  });
});

it('every achievement has a requirement the rules understand', () => {
  const eventBased = new Set(['time_of_day']);
  for (const achievement of ACHIEVEMENTS) {
    const progress = getAchievementProgress(achievement, context());
    if (!eventBased.has(achievement.requirement.type)) expect(progress).not.toBeNull();
  }
});
