export interface QuestTemplate {
  type: string;
  nameKey: string;
  descriptionKey: string;
  minValue: number;
  maxValue: number;
  baseXp: number;
}

export const QUEST_TEMPLATES: QuestTemplate[] = [
  { type: 'complete_pomodoros', nameKey: 'quests.complete_pomodoros', descriptionKey: 'quests.complete_pomodoros_desc', minValue: 2, maxValue: 6, baseXp: 20 },
  { type: 'complete_tasks', nameKey: 'quests.complete_tasks', descriptionKey: 'quests.complete_tasks_desc', minValue: 1, maxValue: 5, baseXp: 20 },
  { type: 'complete_subtasks', nameKey: 'quests.complete_subtasks', descriptionKey: 'quests.complete_subtasks_desc', minValue: 2, maxValue: 8, baseXp: 20 },
  { type: 'focus_time', nameKey: 'quests.focus_time', descriptionKey: 'quests.focus_time_desc', minValue: 30, maxValue: 120, baseXp: 20 },
  { type: 'complete_urgent_task', nameKey: 'quests.complete_urgent', descriptionKey: 'quests.complete_urgent_desc', minValue: 1, maxValue: 2, baseXp: 20 },
  { type: 'complete_high_priority', nameKey: 'quests.complete_high', descriptionKey: 'quests.complete_high_desc', minValue: 1, maxValue: 3, baseXp: 20 },
  { type: 'uninterrupted_focus', nameKey: 'quests.uninterrupted', descriptionKey: 'quests.uninterrupted_desc', minValue: 25, maxValue: 60, baseXp: 20 },
  { type: 'complete_in_category', nameKey: 'quests.in_category', descriptionKey: 'quests.in_category_desc', minValue: 1, maxValue: 3, baseXp: 20 },
  { type: 'create_tasks', nameKey: 'quests.create_tasks', descriptionKey: 'quests.create_tasks_desc', minValue: 2, maxValue: 5, baseXp: 20 },
  { type: 'complete_before_noon', nameKey: 'quests.before_noon', descriptionKey: 'quests.before_noon_desc', minValue: 1, maxValue: 3, baseXp: 20 },
  { type: 'no_skip_break', nameKey: 'quests.no_skip_break', descriptionKey: 'quests.no_skip_break_desc', minValue: 3, maxValue: 5, baseXp: 20 },
  { type: 'start_early', nameKey: 'quests.start_early', descriptionKey: 'quests.start_early_desc', minValue: 7, maxValue: 9, baseXp: 20 },
  { type: 'evening_session', nameKey: 'quests.evening_session', descriptionKey: 'quests.evening_session_desc', minValue: 1, maxValue: 2, baseXp: 20 },
  { type: 'clear_overdue', nameKey: 'quests.clear_overdue', descriptionKey: 'quests.clear_overdue_desc', minValue: 1, maxValue: 3, baseXp: 20 },
  { type: 'long_focus', nameKey: 'quests.long_focus', descriptionKey: 'quests.long_focus_desc', minValue: 45, maxValue: 60, baseXp: 20 },
];

export const DAILY_QUEST_COUNT = 3;
export const DAILY_QUEST_ALL_COMPLETE_BONUS = 30;

/**
 * Generate a random target value for a quest, scaled by user's recent average.
 * recentAvg: user's 7-day average for this metric (0 if no data).
 */
export function scaleQuestTarget(template: QuestTemplate, recentAvg: number): number {
  const base = Math.round((template.minValue + template.maxValue) / 2);
  if (recentAvg <= 0) return base;
  // Scale between min and max based on how active the user is
  const scaled = Math.round(recentAvg * 1.2);
  return Math.max(template.minValue, Math.min(template.maxValue, scaled));
}
