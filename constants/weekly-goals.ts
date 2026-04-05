export interface WeeklyGoalTemplate {
  metric: string;
  nameKey: string;
  descriptionKey: string;
  minValue: number;
  maxValue: number;
  baseXp: number;
}

export const WEEKLY_GOAL_TEMPLATES: WeeklyGoalTemplate[] = [
  { metric: 'pomodoros', nameKey: 'goals.pomodoros', descriptionKey: 'goals.pomodoros_desc', minValue: 10, maxValue: 30, baseXp: 100 },
  { metric: 'tasks', nameKey: 'goals.tasks', descriptionKey: 'goals.tasks_desc', minValue: 5, maxValue: 15, baseXp: 100 },
  { metric: 'streak_days', nameKey: 'goals.streak', descriptionKey: 'goals.streak_desc', minValue: 3, maxValue: 7, baseXp: 100 },
  { metric: 'focus_hours', nameKey: 'goals.focus_hours', descriptionKey: 'goals.focus_hours_desc', minValue: 3, maxValue: 10, baseXp: 100 },
  { metric: 'quest_days', nameKey: 'goals.quest_days', descriptionKey: 'goals.quest_days_desc', minValue: 3, maxValue: 7, baseXp: 100 },
];

export const SYSTEM_WEEKLY_GOAL_COUNT = 2;
export const WEEKLY_GOAL_ALL_COMPLETE_BONUS = 100;
export const PERSONAL_GOAL_XP = 150;

/**
 * Scale a weekly goal target based on user's recent 4-week average.
 */
export function scaleWeeklyTarget(template: WeeklyGoalTemplate, recentWeeklyAvg: number): number {
  const base = Math.round((template.minValue + template.maxValue) / 2);
  if (recentWeeklyAvg <= 0) return base;
  const scaled = Math.round(recentWeeklyAvg * 1.1);
  return Math.max(template.minValue, Math.min(template.maxValue, scaled));
}
