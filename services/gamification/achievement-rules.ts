import { calculateLevel } from '@/constants/gamification';
import type { Achievement, Category, DailyStats, Todo, UserStats } from '@/types';
import { addDaysToKey, parseDateKey } from '@/utils/date';

/**
 * How far the user is towards each achievement. Pure: everything it needs is passed in,
 * so the store (to unlock) and the Stats screen (to show progress) agree.
 */

export interface AchievementContext {
  stats: UserStats;
  /** Combos that are still alive (an expired session combo or a lapsed daily combo is 0). */
  sessionCombo: number;
  dailyCombo: number;
  prestigeCount: number;
  /** Sorted by date. */
  dailyStats: DailyStats[];
  /** The day the check is about (the day of the event that triggered it). */
  dateKey: string;
  todos: Todo[];
  categories: Category[];
}

export interface AchievementProgress {
  current: number;
  target: number;
}

/** Days with a completed pomodoro or task. */
export function isActiveDay(day: DailyStats | undefined): boolean {
  return Boolean(day && (day.pomodorosCompleted > 0 || day.tasksCompleted > 0));
}

export function isPerfectQuestDay(day: DailyStats | undefined): boolean {
  return Boolean(day?.perfectQuestDay);
}

/** A day with at least one break taken to the end and none skipped. */
function isZenDay(day: DailyStats | undefined): boolean {
  return Boolean(day && (day.breaksCompleted ?? 0) > 0 && (day.breaksSkipped ?? 0) === 0);
}

/** The longest run of consecutive calendar days matching `predicate`. */
export function longestRun(dailyStats: DailyStats[], predicate: (day: DailyStats) => boolean): number {
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of dailyStats) {
    if (!predicate(day)) {
      run = 0;
    } else {
      run = previous !== null && addDaysToKey(previous, 1) === day.date && run > 0 ? run + 1 : 1;
      best = Math.max(best, run);
    }
    previous = day.date;
  }
  return best;
}

/** Ever completed: rewarded once (see todo-store), or completed before rewards were tracked. */
function wasCompleted(todo: Todo): boolean {
  return Boolean(todo.xpAwardedAt) || todo.status === 'completed';
}

/** Completed tasks per category: the larger of the lifetime counter and what the todos show. */
export function completedTasksByCategory(context: AchievementContext): Map<string, number> {
  const derived = new Map<string, number>();
  for (const todo of context.todos) {
    if (todo.categoryId && wasCompleted(todo)) derived.set(todo.categoryId, (derived.get(todo.categoryId) ?? 0) + 1);
  }
  const counts = new Map<string, number>(Object.entries(context.stats.categoryTaskCounts ?? {}));
  for (const [id, n] of derived) counts.set(id, Math.max(counts.get(id) ?? 0, n));
  return counts;
}

function levelsGainedThisWeek(context: AchievementContext): number {
  const since = addDaysToKey(context.dateKey, -6);
  const xpThisWeek = context.dailyStats
    .filter((day) => day.date >= since && day.date <= context.dateKey)
    .reduce((sum, day) => sum + Math.max(0, day.xpEarned ?? 0), 0);
  const { totalXp } = context.stats;
  return calculateLevel(totalXp) - calculateLevel(Math.max(0, totalXp - xpThisWeek));
}

/** Days of the best weekend (Saturday + Sunday) the user was active on: 0, 1 or 2. */
function bestWeekend(dailyStats: DailyStats[]): number {
  const byDate = new Map(dailyStats.map((day) => [day.date, day]));
  let best = 0;
  for (const day of dailyStats) {
    const weekday = parseDateKey(day.date).getDay();
    if (weekday !== 6 && weekday !== 0) continue;
    const saturday = weekday === 6 ? day.date : addDaysToKey(day.date, -1);
    const days = [saturday, addDaysToKey(saturday, 1)].filter((key) => isActiveDay(byDate.get(key))).length;
    best = Math.max(best, days);
  }
  return best;
}

/**
 * Progress towards `achievement`, or null for the ones unlocked by an event instead
 * (time of day, all quests before noon, last quest after 23:00).
 */
export function getAchievementProgress(achievement: Achievement, context: AchievementContext): AchievementProgress | null {
  const { stats, dailyStats } = context;
  const req = achievement.requirement;
  const target = req.value;
  const day = dailyStats.find((d) => d.date === context.dateKey);
  const progress = (current: number, of = target): AchievementProgress => ({ current, target: of });

  switch (req.type) {
    case 'pomodoro_count':
      return progress(stats.totalPomodoros);
    case 'task_count':
      return progress(stats.totalTasksCompleted);
    case 'subtask_count': {
      const derived = context.todos.reduce(
        (sum, todo) => sum + todo.subtasks.filter((s) => s.isCompleted || s.xpAwardedAt).length,
        0
      );
      return progress(Math.max(stats.totalSubtasksCompleted ?? 0, derived));
    }
    case 'streak_days': {
      if (req.extra?.afterBreak) return progress((stats.streakBreaks ?? 0) > 0 ? stats.currentStreak : 0);
      if (req.extra?.neverBroken) return progress((stats.streakBreaks ?? 0) === 0 ? stats.currentStreak : 0);
      return progress(stats.currentStreak);
    }
    case 'focus_hours':
      return progress(Math.floor(stats.totalFocusTime / 3600));
    case 'session_combo':
      return progress(context.sessionCombo);
    case 'daily_combo':
      return progress(context.dailyCombo);
    case 'quest_perfect_days':
      return req.extra?.consecutive
        ? progress(longestRun(dailyStats, isPerfectQuestDay))
        : progress(Math.max(stats.perfectQuestDays ?? 0, dailyStats.filter(isPerfectQuestDay).length));
    case 'category_count': {
      // Only categories the user made count; the defaults come for free.
      const own = context.categories.filter((category) => !category.isDefault);
      if (req.extra?.created) return progress(own.length);
      if (req.extra?.uniqueColors) return progress(new Set(own.map((c) => c.color.toLowerCase())).size);
      const counts = completedTasksByCategory(context);
      if (req.extra?.allCategories) {
        if (context.categories.length === 0) return progress(0);
        return progress(Math.min(...context.categories.map((c) => counts.get(c.id) ?? 0)));
      }
      return progress([...counts.values()].filter((n) => n > 0).length);
    }
    case 'category_tasks':
      return progress(Math.max(0, ...completedTasksByCategory(context).values()));
    case 'prestige_count':
      return progress(context.prestigeCount);
    case 'level':
      return req.extra?.withinWeek ? progress(levelsGainedThisWeek(context)) : progress(stats.level);
    case 'total_xp':
      return progress(Math.max(stats.lifetimeXp ?? 0, stats.totalXp));
    case 'days_used':
      return req.extra?.weekend ? progress(bestWeekend(dailyStats), 2) : progress(stats.activeDays ?? 0);
    case 'daily_pomodoros':
      return progress(day?.pomodorosCompleted ?? 0);
    case 'daily_focus_hours':
      return progress(Math.floor((day?.focusTime ?? 0) / 3600));
    case 'urgent_task_count': {
      const derived = context.todos.filter((t) => t.priority === 'urgent' && wasCompleted(t)).length;
      return progress(Math.max(stats.urgentTasksCompleted ?? 0, derived));
    }
    case 'weekly_quest_and_goal':
      return progress(isPerfectQuestDay(day) && (day?.weeklyGoalsCompleted ?? 0) > 0 ? 1 : 0, 1);
    case 'break_streak':
      return progress(longestRun(dailyStats, isZenDay));
    case 'all_pending_cleared': {
      // Finished at least 3 tasks that day and nothing is left open.
      const open = context.todos.filter((t) => t.status === 'pending' || t.status === 'in_progress').length;
      return progress(open === 0 && (day?.tasksCompleted ?? 0) >= 3 ? 1 : 0, 1);
    }
    case 'subtask_perfectionist': {
      const best = context.todos.reduce(
        (max, t) => (t.subtasks.length > 0 && t.subtasks.every((s) => s.isCompleted) ? Math.max(max, t.subtasks.length) : max),
        0
      );
      return progress(best);
    }
    case 'combo_double':
      return progress(context.sessionCombo >= 2 && context.dailyCombo >= 3 ? 1 : 0, 1);
    case 'time_of_day':
      return null;
    default:
      return null;
  }
}

export function isAchievementEarned(achievement: Achievement, context: AchievementContext): boolean {
  const progress = getAchievementProgress(achievement, context);
  return progress !== null && progress.current >= progress.target;
}
