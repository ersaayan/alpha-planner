import { effectiveDailyCombo, useGamificationStore } from '@/stores/gamification-store';
import { usePomodoroStore } from '@/stores/pomodoro-store';
import { useTodoStore } from '@/stores/todo-store';
import { useDailyQuestsStore } from '@/stores/daily-quests-store';
import { getWeekKey, useWeeklyGoalsStore } from '@/stores/weekly-goals-store';
import { addDaysToKey, getDateKey, parseDateKey } from '@/utils/date';
import i18n from '@/services/i18n/i18n-config';

export interface DailySummaryData {
  totalFocusTime: number; // seconds
  pomodorosCompleted: number;
  tasksCompleted: number;
  subtasksCompleted: number;
  topCategory: { name: string; time: number } | null;
  xpEarned: number;
  streakStatus: { days: number; isActive: boolean };
  comboMultiplier: number;
  dailyQuestsStatus: { completed: number; total: number };
  weeklyGoalProgress: { completed: number; total: number; percentage: number };
  deltaFromYesterday: { pomodoros: number; focusTime: number; tasks: number };
  motivationLevel: 'great' | 'normal' | 'low';
}

/** Summary of one day (`yyyy-MM-dd`, default today). */
export function getDailySummaryData(dateKey: string = getDateKey()): DailySummaryData {
  const gamStore = useGamificationStore.getState();
  const todoStore = useTodoStore.getState();
  const questStore = useDailyQuestsStore.getState();
  const goalStore = useWeeklyGoalsStore.getState();

  const previousKey = addDaysToKey(dateKey, -1);
  const dayStats = gamStore.dailyStats.find((ds) => ds.date === dateKey);
  const previousStats = gamStore.dailyStats.find((ds) => ds.date === previousKey);

  const pomodorosCompleted = dayStats?.pomodorosCompleted ?? 0;
  const totalFocusTime = dayStats?.focusTime ?? 0;
  const tasksCompleted = dayStats?.tasksCompleted ?? 0;
  const xpEarned = dayStats?.xpEarned ?? 0;
  // Counted when each subtask was first completed (whatever its todo's status now).
  const subtasksCompleted = dayStats?.subtasksCompleted ?? 0;

  // Top category by focus time that day (local date of the session's end).
  const sessions = usePomodoroStore.getState().sessions;
  const daySessions = sessions.filter(
    (s) => s.phase === 'focus' && s.wasCompleted && getDateKey(new Date(s.endedAt ?? s.startedAt)) === dateKey
  );
  const categoryTime = new Map<string, number>();
  for (const session of daySessions) {
    if (session.todoId) {
      const todo = todoStore.todos.find((t) => t.id === session.todoId);
      if (todo?.categoryId) {
        categoryTime.set(todo.categoryId, (categoryTime.get(todo.categoryId) ?? 0) + session.duration);
      }
    }
  }
  let topCategory: DailySummaryData['topCategory'] = null;
  if (categoryTime.size > 0) {
    const [catId, time] = [...categoryTime.entries()].sort((a, b) => b[1] - a[1])[0];
    try {
      const { useCategoryStore } = require('@/stores/category-store');
      const cat = useCategoryStore.getState().categories.find((c: { id: string; name: string }) => c.id === catId);
      topCategory = cat ? { name: cat.name, time } : null;
    } catch {
      topCategory = null;
    }
  }

  // Streak: alive on that day if the day itself was active.
  const streakStatus = {
    days: gamStore.stats.currentStreak,
    isActive: pomodorosCompleted > 0 || tasksCompleted > 0,
  };

  // Combo
  const { getDailyComboMultiplier } = require('@/constants/combo');
  const comboMultiplier = getDailyComboMultiplier(effectiveDailyCombo(gamStore.combo, dateKey));

  // Daily quests of that day
  const dayQuests = questStore.quests.filter((q) => q.date === dateKey);
  const dailyQuestsStatus = {
    completed: dayQuests.filter((q) => q.isCompleted).length,
    total: dayQuests.length,
  };

  // Weekly goals of that day's week
  const weekKey = getWeekKey(parseDateKey(dateKey));
  const weekGoals = goalStore.goals.filter((g) => g.weekStart === weekKey);
  const weeklyGoalProgress = {
    completed: weekGoals.filter((g) => g.isCompleted).length,
    total: weekGoals.length,
    percentage: weekGoals.length > 0
      ? Math.round((weekGoals.reduce((s, g) => s + Math.min(g.currentValue / g.targetValue, 1), 0) / weekGoals.length) * 100)
      : 0,
  };

  // Delta from the day before
  const deltaFromYesterday = {
    pomodoros: pomodorosCompleted - (previousStats?.pomodorosCompleted ?? 0),
    focusTime: totalFocusTime - (previousStats?.focusTime ?? 0),
    tasks: tasksCompleted - (previousStats?.tasksCompleted ?? 0),
  };

  // Motivation level based on the 7 calendar days before
  const weekBefore = gamStore.dailyStats.filter((d) => d.date >= addDaysToKey(dateKey, -7) && d.date < dateKey);
  const avgPomodoros = weekBefore.reduce((s, d) => s + d.pomodorosCompleted, 0) / 7;

  let motivationLevel: DailySummaryData['motivationLevel'] = 'normal';
  const allQuestsDone = dailyQuestsStatus.total > 0 && dailyQuestsStatus.completed === dailyQuestsStatus.total;
  if ((avgPomodoros > 0 && pomodorosCompleted >= avgPomodoros * 1.2) || allQuestsDone) {
    motivationLevel = 'great';
  } else if (pomodorosCompleted < avgPomodoros * 0.5 && pomodorosCompleted < 2) {
    motivationLevel = 'low';
  }

  return {
    totalFocusTime,
    pomodorosCompleted,
    tasksCompleted,
    subtasksCompleted,
    topCategory,
    xpEarned,
    streakStatus,
    comboMultiplier,
    dailyQuestsStatus,
    weeklyGoalProgress,
    deltaFromYesterday,
    motivationLevel,
  };
}

export function getMotivationalMessage(level: 'great' | 'normal' | 'low'): string {
  const messages = {
    great: [
      i18n.t('summary.motivation.great.0'),
      i18n.t('summary.motivation.great.1'),
      i18n.t('summary.motivation.great.2'),
    ],
    normal: [
      i18n.t('summary.motivation.normal.0'),
      i18n.t('summary.motivation.normal.1'),
      i18n.t('summary.motivation.normal.2'),
    ],
    low: [
      i18n.t('summary.motivation.low.0'),
      i18n.t('summary.motivation.low.1'),
      i18n.t('summary.motivation.low.2'),
    ],
  };
  const pool = messages[level];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function markSummaryShown(): void {
  useGamificationStore.getState().updateDailyStats({
    summaryShownAt: new Date().toISOString(),
  });
}

export function shouldShowSummary(): boolean {
  const today = getDateKey();
  const todayStats = useGamificationStore.getState().dailyStats.find((ds) => ds.date === today);

  // Show if today has activity but summary not yet shown
  if (!todayStats) return false;
  if (todayStats.summaryShownAt) return false;
  if (todayStats.pomodorosCompleted === 0 && todayStats.tasksCompleted === 0) return false;

  // Only show after 23:00 or next day
  const now = new Date();
  return now.getHours() >= 23;
}
