import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DailyStats, WeeklyGoal } from '@/types';
import {
  PERSONAL_GOAL_LIMITS,
  PERSONAL_GOAL_XP,
  SYSTEM_WEEKLY_GOAL_COUNT,
  WEEKLY_GOAL_ALL_COMPLETE_BONUS,
  WEEKLY_GOAL_TEMPLATES,
  getWeeklyGoalTemplate,
  reachableWeeklyTarget,
  scaleWeeklyTarget,
  type WeeklyGoalMetric,
} from '@/constants/weekly-goals';
import { XP_VALUES } from '@/constants/gamification';
import { generateId } from '@/utils/uuid';
import { addDaysToKey, getDateKey } from '@/utils/date';
import { startOfWeek, format } from 'date-fns';
import { useGamificationStore } from './gamification-store';
import { asRecord, asRecordArray, createPersistOptions } from './persist';
import { useSyncStore } from './sync-store';

interface WeeklyGoalsStore {
  goals: WeeklyGoal[];
  lastGeneratedWeek: string | null;

  // Actions
  ensureThisWeekGoals: (now?: Date) => void;
  /**
   * Sets this week's personal goal. Returns false when the target is out of range, already
   * reached, or this week's personal goal was already completed.
   */
  setPersonalGoal: (metric: string, targetValue: number, now?: Date) => boolean;
  /** Adds `delta` to the goals with this metric in the week of `at` (default: now). */
  updateGoalProgress: (metric: string, delta: number, at?: Date) => void;
  /** Recomputes the streak and perfect-quest-day goals of the week of `at` from the daily stats. */
  refreshDerivedGoals: (at?: Date) => void;
  getThisWeekGoals: () => WeeklyGoal[];
  getCompletedCount: () => number;
}

/** Weeks start on Monday (the goal week does not follow the calendar setting). */
export function getWeekKey(date?: Date): string {
  const d = date ?? new Date();
  const weekStart = startOfWeek(d, { weekStartsOn: 1 }); // Monday
  return format(weekStart, 'yyyy-MM-dd');
}

/** Days left in the week of `now`, today included (7 on Monday, 1 on Sunday). */
export function daysLeftInWeek(now: Date): number {
  const day = now.getDay(); // 0 = Sunday
  return day === 0 ? 1 : 8 - day;
}

function goalMetric(goal: WeeklyGoal): string | undefined {
  return (goal.goalParams as { metric?: string }).metric;
}

/** The first day a goal counts (system goals made mid-week only count from then on). */
function goalSince(goal: WeeklyGoal): string {
  const since = (goal.goalParams as { since?: unknown }).since;
  return typeof since === 'string' ? since : goal.weekStart;
}

/**
 * Progress on `metric` between `from` and `to` (date keys, inclusive), read from the daily
 * stats. Used for derived goals and to start a personal goal from this week's activity.
 */
export function measureMetric(metric: string, dailyStats: DailyStats[], from: string, to: string): number {
  const days = dailyStats.filter((day) => day.date >= from && day.date <= to);
  switch (metric) {
    case 'pomodoros':
      return days.reduce((sum, day) => sum + day.pomodorosCompleted, 0);
    case 'tasks':
      return days.reduce((sum, day) => sum + day.tasksCompleted, 0);
    case 'focus_hours':
      return days.reduce((sum, day) => sum + day.focusTime, 0) / 3600;
    case 'quest_days':
      return days.filter((day) => day.perfectQuestDay).length;
    case 'streak_days': {
      // The longest run of active days in the range.
      const active = new Set(days.filter((d) => d.pomodorosCompleted > 0 || d.tasksCompleted > 0).map((d) => d.date));
      let best = 0;
      let run = 0;
      for (let key = from; key <= to; key = addDaysToKey(key, 1)) {
        run = active.has(key) ? run + 1 : 0;
        best = Math.max(best, run);
      }
      return best;
    }
    default:
      return 0;
  }
}

function syncGoal(goal: WeeklyGoal): void {
  useSyncStore.getState().enqueue('weekly_goals', 'update', {
    id: goal.id,
    goal_params: goal.goalParams,
    target_value: goal.targetValue,
    current_value: goal.currentValue,
    is_completed: goal.isCompleted,
  });
}

export const useWeeklyGoalsStore = create<WeeklyGoalsStore>()(
  persist(
    (set, get) => {
      /**
       * Replaces the goals of one week with `next(goal)` and pays for the ones it completes
       * (and the bonus when that completes the week).
       */
      const apply = (weekKey: string, at: Date, next: (goal: WeeklyGoal) => WeeklyGoal) => {
        const completed: WeeklyGoal[] = [];
        const changed: WeeklyGoal[] = [];
        const goals = get().goals.map((goal) => {
          if (goal.weekStart !== weekKey || goal.isCompleted) return goal;
          const updated = next(goal);
          if (updated === goal) return goal;
          changed.push(updated);
          if (updated.isCompleted) completed.push(updated);
          return updated;
        });
        if (changed.length === 0) return;
        set({ goals });
        changed.forEach(syncGoal);

        const gamification = useGamificationStore.getState();
        for (const goal of completed) {
          gamification.addXp(goal.goalType === 'personal' ? PERSONAL_GOAL_XP : XP_VALUES.WEEKLY_GOAL_COMPLETE, at);
          gamification.recordWeeklyGoalCompleted(at);
        }
        if (completed.length > 0) {
          const weekGoals = goals.filter((g) => g.weekStart === weekKey);
          if (weekGoals.length > 0 && weekGoals.every((g) => g.isCompleted)) {
            gamification.addXp(WEEKLY_GOAL_ALL_COMPLETE_BONUS, at);
          }
        }
      };

      const withValue = (goal: WeeklyGoal, value: number): WeeklyGoal => {
        const currentValue = Math.min(Math.max(0, value), goal.targetValue);
        if (currentValue === goal.currentValue) return goal;
        return { ...goal, currentValue, isCompleted: currentValue >= goal.targetValue };
      };

      return {
        goals: [],
        lastGeneratedWeek: null,

        ensureThisWeekGoals: (now = new Date()) => {
          const weekKey = getWeekKey(now);
          if (get().lastGeneratedWeek === weekKey) return;
          if (get().goals.some((g) => g.weekStart === weekKey && g.goalType === 'system')) {
            set({ lastGeneratedWeek: weekKey });
            return;
          }

          // Weekly averages over the last 4 weeks, for difficulty scaling.
          const dailyStats = useGamificationStore.getState().dailyStats;
          const fourWeeksAgo = addDaysToKey(weekKey, -28);
          const recentAvgs = new Map<string, number>();
          if (dailyStats.some((d) => d.date >= fourWeeksAgo && d.date < weekKey)) {
            const before = addDaysToKey(weekKey, -1);
            for (const metric of ['pomodoros', 'tasks', 'focus_hours', 'streak_days', 'quest_days']) {
              const total = metric === 'streak_days'
                ? measureMetric(metric, dailyStats, addDaysToKey(weekKey, -7), before)
                : measureMetric(metric, dailyStats, fourWeeksAgo, before) / 4;
              recentAvgs.set(metric, total);
            }
          }

          // Only goals that can still be reached in the days left this week.
          const today = getDateKey(now);
          const daysLeft = daysLeftInWeek(now);
          const candidates = WEEKLY_GOAL_TEMPLATES.flatMap((template) => {
            const target = reachableWeeklyTarget(template, scaleWeeklyTarget(template, recentAvgs.get(template.metric) ?? 0), daysLeft);
            return target === null ? [] : [{ template, target }];
          }).sort(() => Math.random() - 0.5);

          const systemGoals: WeeklyGoal[] = candidates.slice(0, SYSTEM_WEEKLY_GOAL_COUNT).map(({ template, target }) => ({
            id: generateId(),
            weekStart: weekKey,
            goalType: 'system' as const,
            goalParams: { metric: template.metric, since: today },
            targetValue: target,
            currentValue: 0,
            isCompleted: false,
            xpReward: template.baseXp,
          }));

          set((state) => ({
            goals: [...state.goals.filter((g) => g.weekStart !== weekKey || g.goalType === 'personal'), ...systemGoals].slice(-40),
            lastGeneratedWeek: weekKey,
          }));

          for (const goal of systemGoals) {
            useSyncStore.getState().enqueue('weekly_goals', 'insert', {
              id: goal.id,
              week_start: goal.weekStart,
              goal_type: goal.goalType,
              goal_params: goal.goalParams,
              target_value: goal.targetValue,
              current_value: goal.currentValue,
              is_completed: goal.isCompleted,
              xp_reward: goal.xpReward,
            });
          }
          // A day that already counts (e.g. today's streak) shows right away.
          get().refreshDerivedGoals(now);
        },

        setPersonalGoal: (metric, targetValue, now = new Date()) => {
          const limits = PERSONAL_GOAL_LIMITS[metric as WeeklyGoalMetric];
          if (!limits || !Number.isFinite(targetValue)) return false;
          const target = Math.round(targetValue);
          const weekKey = getWeekKey(now);
          const existing = get().goals.find((g) => g.weekStart === weekKey && g.goalType === 'personal');
          // One personal reward a week.
          if (existing?.isCompleted) return false;

          // A personal goal counts the whole week so far, so it must be ahead of that.
          const progress = measureMetric(metric, useGamificationStore.getState().dailyStats, weekKey, getDateKey(now));
          if (target < limits.min || target > limits.max || target <= progress) return false;

          const goal: WeeklyGoal = {
            id: existing?.id ?? generateId(),
            weekStart: weekKey,
            goalType: 'personal',
            goalParams: { metric },
            targetValue: target,
            currentValue: progress,
            isCompleted: false,
            xpReward: PERSONAL_GOAL_XP,
          };
          set((state) => ({
            goals: existing ? state.goals.map((g) => (g.id === existing.id ? goal : g)) : [...state.goals, goal],
          }));
          useSyncStore.getState().enqueue('weekly_goals', existing ? 'update' : 'insert', {
            id: goal.id,
            week_start: goal.weekStart,
            goal_type: goal.goalType,
            goal_params: goal.goalParams,
            target_value: goal.targetValue,
            current_value: goal.currentValue,
            is_completed: goal.isCompleted,
            xp_reward: goal.xpReward,
          });
          return true;
        },

        updateGoalProgress: (metric, delta, at = new Date()) => {
          if (!(delta > 0)) return;
          if (getWeeklyGoalTemplate(metric)?.derived) return;
          apply(getWeekKey(at), at, (goal) =>
            goalMetric(goal) === metric ? withValue(goal, goal.currentValue + delta) : goal
          );
        },

        refreshDerivedGoals: (at = new Date()) => {
          const weekKey = getWeekKey(at);
          const end = addDaysToKey(weekKey, 6);
          const { dailyStats } = useGamificationStore.getState();
          apply(weekKey, at, (goal) => {
            const metric = goalMetric(goal);
            if (!metric || !getWeeklyGoalTemplate(metric)?.derived) return goal;
            const from = goal.goalType === 'personal' ? weekKey : goalSince(goal);
            return withValue(goal, measureMetric(metric, dailyStats, from, end));
          });
        },

        getThisWeekGoals: () => {
          const weekKey = getWeekKey();
          return get().goals.filter((g) => g.weekStart === weekKey);
        },

        getCompletedCount: () => {
          const weekKey = getWeekKey();
          return get().goals.filter((g) => g.weekStart === weekKey && g.isCompleted).length;
        },
      };
    },
    createPersistOptions<WeeklyGoalsStore, Pick<WeeklyGoalsStore, 'goals' | 'lastGeneratedWeek'>>({
      name: 'weekly-goals-store',
      version: 1,
      partialize: (state) => ({
        goals: state.goals,
        lastGeneratedWeek: state.lastGeneratedWeek,
      }),
      migrate: migrateWeeklyGoalsState,
    })
  )
);

/** v0 (unversioned) → v1: same shape, with malformed entries dropped. */
export function migrateWeeklyGoalsState(persisted: unknown, _fromVersion: number) {
  const state = asRecord(persisted);
  return {
    goals: asRecordArray(state.goals).filter((item) => typeof item.id === 'string'),
    lastGeneratedWeek: typeof state.lastGeneratedWeek === 'string' ? state.lastGeneratedWeek : null,
  };
}
