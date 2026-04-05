import { useGamificationStore } from '@/stores/gamification-store';
import { usePomodoroStore } from '@/stores/pomodoro-store';
import { useTodoStore } from '@/stores/todo-store';
import { useDailyQuestsStore } from '@/stores/daily-quests-store';
import { useWeeklyGoalsStore } from '@/stores/weekly-goals-store';
import { getDateKey } from '@/utils/date';

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

export function getDailySummaryData(): DailySummaryData {
  const gamStore = useGamificationStore.getState();
  const todoStore = useTodoStore.getState();
  const questStore = useDailyQuestsStore.getState();
  const goalStore = useWeeklyGoalsStore.getState();

  const today = getDateKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getDateKey(yesterday);

  const todayStats = gamStore.dailyStats.find((ds) => ds.date === today);
  const yesterdayStats = gamStore.dailyStats.find((ds) => ds.date === yesterdayKey);

  const pomodorosCompleted = todayStats?.pomodorosCompleted ?? 0;
  const totalFocusTime = todayStats?.focusTime ?? 0;
  const tasksCompleted = todayStats?.tasksCompleted ?? 0;
  const xpEarned = todayStats?.xpEarned ?? 0;

  // Count today's subtasks
  const todayCompletedTodos = todoStore.todos.filter(
    (t) => t.status === 'completed' && t.updatedAt?.startsWith(today)
  );
  const subtasksCompleted = todayCompletedTodos.reduce(
    (sum, t) => sum + (t.subtasks?.filter((s) => s.isCompleted)?.length ?? 0),
    0
  );

  // Top category by pomodoro sessions today
  const sessions = usePomodoroStore.getState().sessions;
  const todaySessions = sessions.filter(
    (s) => s.startedAt.startsWith(today) && s.phase === 'focus' && s.wasCompleted
  );
  const categoryTime = new Map<string, number>();
  for (const session of todaySessions) {
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

  // Streak
  const streakStatus = {
    days: gamStore.stats.currentStreak,
    isActive: gamStore.stats.lastActiveDate === today,
  };

  // Combo
  const { getDailyComboMultiplier } = require('@/constants/combo');
  const comboMultiplier = getDailyComboMultiplier(gamStore.combo.dailyComboStreak);

  // Daily quests
  const todayQuests = questStore.getTodayQuests();
  const dailyQuestsStatus = {
    completed: todayQuests.filter((q) => q.isCompleted).length,
    total: todayQuests.length,
  };

  // Weekly goals
  const weekGoals = goalStore.getThisWeekGoals();
  const weeklyGoalProgress = {
    completed: weekGoals.filter((g) => g.isCompleted).length,
    total: weekGoals.length,
    percentage: weekGoals.length > 0
      ? Math.round((weekGoals.reduce((s, g) => s + Math.min(g.currentValue / g.targetValue, 1), 0) / weekGoals.length) * 100)
      : 0,
  };

  // Delta from yesterday
  const deltaFromYesterday = {
    pomodoros: pomodorosCompleted - (yesterdayStats?.pomodorosCompleted ?? 0),
    focusTime: totalFocusTime - (yesterdayStats?.focusTime ?? 0),
    tasks: tasksCompleted - (yesterdayStats?.tasksCompleted ?? 0),
  };

  // Motivation level based on 7-day average
  const last7 = gamStore.dailyStats.slice(-7);
  const avgPomodoros = last7.length > 0
    ? last7.reduce((s, d) => s + d.pomodorosCompleted, 0) / last7.length
    : 0;

  let motivationLevel: DailySummaryData['motivationLevel'] = 'normal';
  if (pomodorosCompleted >= avgPomodoros * 1.2 || dailyQuestsStatus.completed === dailyQuestsStatus.total) {
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
      'Bugün harika bir iş çıkardın!',
      'Müthiş bir gün oldu, tebrikler!',
      'Odak seviyesi maksimum, bravo!',
    ],
    normal: [
      'İyi bir gün oldu, devam et!',
      'Güzel ilerleme, yarın daha da iyi!',
      'Kararlılığını koru, iyi gidiyorsun!',
    ],
    low: [
      'Her gün aynı olmaz, yarın daha güçlü!',
      'Küçük adımlar da ilerlemedir.',
      'Dinlenmek de verimlilik için önemli.',
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
