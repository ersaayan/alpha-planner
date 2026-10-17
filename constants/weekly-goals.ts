export type WeeklyGoalMetric = 'pomodoros' | 'tasks' | 'streak_days' | 'focus_hours' | 'quest_days';

export interface WeeklyGoalTemplate {
  metric: WeeklyGoalMetric;
  nameKey: string;
  descriptionKey: string;
  minValue: number;
  maxValue: number;
  baseXp: number;
  /** Most that can reasonably be done in one day (caps targets for a short week). */
  perDayCap: number;
  /**
   * Derived metrics are recomputed from the daily stats (a streak, perfect quest days)
   * instead of being added up event by event.
   */
  derived: boolean;
}

export const WEEKLY_GOAL_TEMPLATES: WeeklyGoalTemplate[] = [
  { metric: 'pomodoros', nameKey: 'goals.pomodoros', descriptionKey: 'goals.pomodoros_desc', minValue: 10, maxValue: 30, baseXp: 100, perDayCap: 12, derived: false },
  { metric: 'tasks', nameKey: 'goals.tasks', descriptionKey: 'goals.tasks_desc', minValue: 5, maxValue: 15, baseXp: 100, perDayCap: 10, derived: false },
  { metric: 'streak_days', nameKey: 'goals.streak', descriptionKey: 'goals.streak_desc', minValue: 3, maxValue: 7, baseXp: 100, perDayCap: 1, derived: true },
  { metric: 'focus_hours', nameKey: 'goals.focus_hours', descriptionKey: 'goals.focus_hours_desc', minValue: 3, maxValue: 10, baseXp: 100, perDayCap: 6, derived: false },
  { metric: 'quest_days', nameKey: 'goals.quest_days', descriptionKey: 'goals.quest_days_desc', minValue: 2, maxValue: 5, baseXp: 100, perDayCap: 1, derived: true },
];

export const SYSTEM_WEEKLY_GOAL_COUNT = 2;
export const WEEKLY_GOAL_ALL_COMPLETE_BONUS = 100;
export const PERSONAL_GOAL_XP = 150;

/** The metrics a personal goal can use, with the smallest and largest target allowed. */
export const PERSONAL_GOAL_LIMITS: Record<WeeklyGoalMetric, { min: number; max: number }> = {
  pomodoros: { min: 5, max: 100 },
  tasks: { min: 3, max: 100 },
  focus_hours: { min: 2, max: 60 },
  streak_days: { min: 3, max: 7 },
  quest_days: { min: 2, max: 7 },
};

export function getWeeklyGoalTemplate(metric: string): WeeklyGoalTemplate | undefined {
  return WEEKLY_GOAL_TEMPLATES.find((template) => template.metric === metric);
}

/**
 * Scale a weekly goal target based on user's recent 4-week average.
 */
export function scaleWeeklyTarget(template: Pick<WeeklyGoalTemplate, 'minValue' | 'maxValue'>, recentWeeklyAvg: number): number {
  const base = Math.round((template.minValue + template.maxValue) / 2);
  if (recentWeeklyAvg <= 0) return base;
  const scaled = Math.round(recentWeeklyAvg * 1.1);
  return Math.max(template.minValue, Math.min(template.maxValue, scaled));
}

/**
 * A target that can still be reached in the `daysLeft` days of the week (today
 * included): a whole-week target is shortened in proportion, and never more than
 * `perDayCap` a day. Null when the goal no longer makes sense this week.
 */
export function reachableWeeklyTarget(template: WeeklyGoalTemplate, wholeWeekTarget: number, daysLeft: number): number | null {
  const days = Math.max(0, Math.min(7, daysLeft));
  if (template.derived) {
    // A streak or a count of days needs days; one day is not a weekly goal.
    const target = Math.min(wholeWeekTarget, days);
    return target >= Math.min(template.minValue, 2) ? target : null;
  }
  const proportional = Math.round((wholeWeekTarget * days) / 7);
  const target = Math.min(Math.max(1, proportional), template.perDayCap * days);
  return target >= 1 ? target : null;
}
