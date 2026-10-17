import type { DailyQuest, TodoPriority } from '@/types';

/**
 * Daily quests. Every template says when it can be completed today (`plan`, given the
 * time left in the day and the user's open tasks) and how an activity event moves it
 * forward (`progress`). Only quests that can still be finished today are generated.
 */

export type QuestType =
  | 'complete_pomodoros'
  | 'complete_tasks'
  | 'complete_subtasks'
  | 'focus_time'
  | 'complete_urgent_task'
  | 'complete_high_priority'
  | 'uninterrupted_focus'
  | 'complete_in_category'
  | 'create_tasks'
  | 'complete_before_noon'
  | 'no_skip_break'
  | 'start_early'
  | 'evening_session'
  | 'clear_overdue'
  | 'long_focus';

/** Something the user did. `at` decides which day's quests it counts for. */
export type QuestEvent =
  | { type: 'focus_completed'; at: Date; startedAt: Date; seconds: number; pausedMs: number }
  | { type: 'break_completed'; at: Date }
  | { type: 'break_skipped'; at: Date }
  | { type: 'task_completed'; at: Date; priority: TodoPriority; categoryId: string | null; wasOverdue: boolean }
  | { type: 'subtask_completed'; at: Date }
  | { type: 'task_created'; at: Date };

export interface OpenTaskInfo {
  priority: TodoPriority;
  categoryId: string | null;
  isOverdue: boolean;
  openSubtasks: number;
}

/** What quest generation knows about the user's day. */
export interface QuestContext {
  now: Date;
  focusMinutes: number;
  shortBreakMinutes: number;
  /** Pending and in-progress tasks. */
  openTasks: OpenTaskInfo[];
  /** Averages per calendar day over the last week (0 without history). */
  recent: { pomodoros: number; tasks: number; focusMinutes: number };
  random: () => number;
}

export interface QuestPlan {
  targetValue: number;
  params?: Record<string, unknown>;
}

export interface QuestTemplate {
  type: QuestType;
  nameKey: string;
  descriptionKey: string;
  minValue: number;
  maxValue: number;
  baseXp: number;
  /** The quest for today, or null when it could not be completed today. */
  plan: (context: QuestContext) => QuestPlan | null;
  /** How much an event adds to the quest; 'reset' starts it over. */
  progress: (quest: DailyQuest, event: QuestEvent) => number | 'reset';
}

export const DAILY_QUEST_COUNT = 3;
export const DAILY_QUEST_ALL_COMPLETE_BONUS = 30;
const DEFAULT_QUEST_XP = 20;

// ── Feasibility ─────────────────────────────────────────────────────────

/** Minutes from `now` until `hour`:00 today (24 = midnight). Negative once passed. */
export function minutesUntilHour(now: Date, hour: number): number {
  const target = new Date(now);
  target.setHours(hour, 0, 0, 0);
  return (target.getTime() - now.getTime()) / 60_000;
}

/** Focus sessions that can be completed within `minutes` (breaks between them). */
export function sessionsThatFit(minutes: number, context: QuestContext): number {
  const focus = Math.max(1, context.focusMinutes);
  if (minutes < focus) return 0;
  return 1 + Math.floor((minutes - focus) / (focus + Math.max(0, context.shortBreakMinutes)));
}

function sessionsLeftToday(context: QuestContext): number {
  return sessionsThatFit(minutesUntilHour(context.now, 24), context);
}

/**
 * A target between the template's min and max, scaled by the user's recent average.
 * recentAvg: user's 7-day average for this metric (0 if no data).
 */
export function scaleQuestTarget(template: Pick<QuestTemplate, 'minValue' | 'maxValue'>, recentAvg: number): number {
  const base = Math.round((template.minValue + template.maxValue) / 2);
  if (recentAvg <= 0) return base;
  // Scale between min and max based on how active the user is
  const scaled = Math.round(recentAvg * 1.2);
  return Math.max(template.minValue, Math.min(template.maxValue, scaled));
}

/** `wanted`, but never more than `cap`; null when not even one fits. */
function capped(wanted: number, cap: number): QuestPlan | null {
  const targetValue = Math.min(wanted, Math.floor(cap));
  return targetValue >= 1 ? { targetValue } : null;
}

const count = (matches: (event: QuestEvent) => boolean) => (_quest: DailyQuest, event: QuestEvent) =>
  matches(event) ? 1 : 0;

function isHighPriority(priority: TodoPriority): boolean {
  return priority === 'high' || priority === 'urgent';
}

/** The fields every template shares. */
const meta = (type: QuestType, key: string, minValue: number, maxValue: number) => ({
  type,
  nameKey: `quests.${key}`,
  descriptionKey: `quests.${key}_desc`,
  minValue,
  maxValue,
  baseXp: DEFAULT_QUEST_XP,
});

export const QUEST_TEMPLATES: QuestTemplate[] = [
  {
    ...meta('complete_pomodoros', 'complete_pomodoros', 2, 6),
    plan(context) {
      return capped(scaleQuestTarget(this, context.recent.pomodoros), sessionsLeftToday(context));
    },
    progress: count((event) => event.type === 'focus_completed'),
  },
  {
    ...meta('complete_tasks', 'complete_tasks', 1, 5),
    plan(context) {
      // Never more than the open tasks (but one is fine with none: create it, finish it).
      return capped(scaleQuestTarget(this, context.recent.tasks), Math.max(1, context.openTasks.length));
    },
    progress: count((event) => event.type === 'task_completed'),
  },
  {
    ...meta('complete_subtasks', 'complete_subtasks', 2, 5),
    plan(context) {
      const open = context.openTasks.reduce((sum, task) => sum + task.openSubtasks, 0);
      return capped(scaleQuestTarget(this, 0), open);
    },
    progress: count((event) => event.type === 'subtask_completed'),
  },
  {
    ...meta('focus_time', 'focus_time', 30, 120),
    plan(context) {
      // A whole number of sessions, so the quest completes at the end of one.
      const focus = Math.max(1, context.focusMinutes);
      const wanted = scaleQuestTarget(this, context.recent.focusMinutes);
      const sessions = Math.min(Math.max(1, Math.round(wanted / focus)), sessionsLeftToday(context));
      return sessions >= 1 ? { targetValue: sessions * focus } : null;
    },
    progress: (_quest, event) => (event.type === 'focus_completed' ? Math.floor(event.seconds / 60) : 0),
  },
  {
    ...meta('complete_urgent_task', 'complete_urgent', 1, 2),
    plan(context) {
      const open = context.openTasks.filter((task) => task.priority === 'urgent').length;
      return capped(scaleQuestTarget(this, 0), open);
    },
    progress: count((event) => event.type === 'task_completed' && event.priority === 'urgent'),
  },
  {
    ...meta('complete_high_priority', 'complete_high', 1, 3),
    plan(context) {
      const open = context.openTasks.filter((task) => isHighPriority(task.priority)).length;
      return capped(scaleQuestTarget(this, 0), open);
    },
    progress: count((event) => event.type === 'task_completed' && isHighPriority(event.priority)),
  },
  {
    ...meta('uninterrupted_focus', 'uninterrupted', 1, 3),
    plan(context) {
      return capped(scaleQuestTarget(this, 0), sessionsLeftToday(context));
    },
    // A pause of under a second is a double tap, not an interruption.
    progress: count((event) => event.type === 'focus_completed' && event.pausedMs < 1000),
  },
  {
    ...meta('complete_in_category', 'in_category', 1, 3),
    plan(context) {
      const openByCategory = new Map<string, number>();
      for (const task of context.openTasks) {
        if (task.categoryId) openByCategory.set(task.categoryId, (openByCategory.get(task.categoryId) ?? 0) + 1);
      }
      const categoryIds = [...openByCategory.keys()].sort();
      if (categoryIds.length === 0) return null;
      const categoryId = categoryIds[Math.floor(context.random() * categoryIds.length)] ?? categoryIds[0];
      const plan = capped(scaleQuestTarget(this, 0), openByCategory.get(categoryId) ?? 0);
      return plan ? { ...plan, params: { categoryId } } : null;
    },
    // Quests made before categories were picked count any category.
    progress: (quest, event) =>
      event.type === 'task_completed' &&
      event.categoryId !== null &&
      (quest.questParams.categoryId === undefined || event.categoryId === quest.questParams.categoryId)
        ? 1
        : 0,
  },
  {
    ...meta('create_tasks', 'create_tasks', 1, 3),
    plan() {
      return { targetValue: scaleQuestTarget(this, 0) };
    },
    progress: count((event) => event.type === 'task_created'),
  },
  {
    ...meta('complete_before_noon', 'before_noon', 1, 3),
    plan(context) {
      return capped(scaleQuestTarget(this, 0), sessionsThatFit(minutesUntilHour(context.now, 12), context));
    },
    progress: count((event) => event.type === 'focus_completed' && event.at.getHours() < 12),
  },
  {
    ...meta('no_skip_break', 'no_skip_break', 2, 4),
    plan(context) {
      // Each break follows a focus session.
      const cycle = Math.max(1, context.focusMinutes + context.shortBreakMinutes);
      return capped(scaleQuestTarget(this, 0), Math.floor(minutesUntilHour(context.now, 24) / cycle));
    },
    progress: (_quest, event) =>
      event.type === 'break_completed' ? 1 : event.type === 'break_skipped' ? 'reset' : 0,
  },
  {
    ...meta('start_early', 'start_early', 1, 1),
    plan(context) {
      // The earliest of 7, 8 or 9 o'clock that still leaves half an hour to start.
      const beforeHour = [7, 8, 9].find((hour) => minutesUntilHour(context.now, hour) >= 30);
      return beforeHour === undefined ? null : { targetValue: 1, params: { beforeHour } };
    },
    progress: (quest, event) => {
      const beforeHour = Number(quest.questParams.beforeHour);
      return event.type === 'focus_completed' &&
        Number.isFinite(beforeHour) &&
        event.startedAt.getHours() < beforeHour
        ? 1
        : 0;
    },
  },
  {
    ...meta('evening_session', 'evening_session', 1, 2),
    plan(context) {
      const eveningMinutes = minutesUntilHour(context.now, 24) - Math.max(0, minutesUntilHour(context.now, 18));
      return capped(scaleQuestTarget(this, 0), sessionsThatFit(eveningMinutes, context));
    },
    progress: count((event) => event.type === 'focus_completed' && event.at.getHours() >= 18),
  },
  {
    ...meta('clear_overdue', 'clear_overdue', 1, 3),
    plan(context) {
      return capped(scaleQuestTarget(this, 0), context.openTasks.filter((task) => task.isOverdue).length);
    },
    progress: count((event) => event.type === 'task_completed' && event.wasOverdue),
  },
  {
    ...meta('long_focus', 'long_focus', 1, 1),
    plan(context) {
      // Only for users whose sessions are long enough already.
      if (context.focusMinutes < 40 || sessionsLeftToday(context) < 1) return null;
      const minutes = Math.min(60, Math.floor(context.focusMinutes / 5) * 5);
      return { targetValue: 1, params: { minutes } };
    },
    progress: (quest, event) =>
      event.type === 'focus_completed' && event.seconds >= Number(quest.questParams.minutes) * 60 ? 1 : 0,
  },
];

export function getQuestTemplate(type: string): QuestTemplate | undefined {
  return QUEST_TEMPLATES.find((template) => template.type === type);
}

/** The quests that can be generated today, with their targets. */
export function planQuests(context: QuestContext): { template: QuestTemplate; plan: QuestPlan }[] {
  const plans: { template: QuestTemplate; plan: QuestPlan }[] = [];
  for (const template of QUEST_TEMPLATES) {
    const plan = template.plan(context);
    if (plan && plan.targetValue >= 1) plans.push({ template, plan });
  }
  return plans;
}

/** Picks `count` different quests at random from those that can be completed today. */
export function pickQuests(
  context: QuestContext,
  questCount = DAILY_QUEST_COUNT
): { template: QuestTemplate; plan: QuestPlan }[] {
  const available = planQuests(context);
  // Fisher–Yates with the injected random source.
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(context.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, questCount);
}
