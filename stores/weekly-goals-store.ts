import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { WeeklyGoal } from '@/types';
import { WEEKLY_GOAL_TEMPLATES, SYSTEM_WEEKLY_GOAL_COUNT, WEEKLY_GOAL_ALL_COMPLETE_BONUS, PERSONAL_GOAL_XP, scaleWeeklyTarget } from '@/constants/weekly-goals';
import { XP_VALUES } from '@/constants/gamification';
import { generateId } from '@/utils/uuid';
import { getDateKey } from '@/utils/date';
import { startOfWeek, format } from 'date-fns';
import { useGamificationStore } from './gamification-store';
import { useSyncStore } from './sync-store';

interface WeeklyGoalsStore {
  goals: WeeklyGoal[];
  lastGeneratedWeek: string | null;

  // Actions
  ensureThisWeekGoals: () => void;
  setPersonalGoal: (metric: string, targetValue: number) => void;
  updateGoalProgress: (metric: string, delta: number) => void;
  getThisWeekGoals: () => WeeklyGoal[];
  getCompletedCount: () => number;
}

function getWeekKey(date?: Date): string {
  const d = date ?? new Date();
  const weekStart = startOfWeek(d, { weekStartsOn: 1 }); // Monday
  return format(weekStart, 'yyyy-MM-dd');
}

function pickSystemGoals(count: number, recentAvgs: Map<string, number>): WeeklyGoal[] {
  const weekKey = getWeekKey();
  const shuffled = [...WEEKLY_GOAL_TEMPLATES].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, count);

  return picked.map((template) => ({
    id: generateId(),
    weekStart: weekKey,
    goalType: 'system' as const,
    goalParams: { metric: template.metric },
    targetValue: scaleWeeklyTarget(template, recentAvgs.get(template.metric) ?? 0),
    currentValue: 0,
    isCompleted: false,
    xpReward: template.baseXp,
  }));
}

export const useWeeklyGoalsStore = create<WeeklyGoalsStore>()(
  persist(
    (set, get) => ({
      goals: [],
      lastGeneratedWeek: null,

      ensureThisWeekGoals: () => {
        const weekKey = getWeekKey();
        if (get().lastGeneratedWeek === weekKey) return;

        // Get 4-week averages for difficulty scaling
        const dailyStats = useGamificationStore.getState().dailyStats;
        const last28 = dailyStats.slice(-28);
        const recentAvgs = new Map<string, number>();
        if (last28.length > 0) {
          const weeks = Math.max(1, Math.ceil(last28.length / 7));
          recentAvgs.set('pomodoros', last28.reduce((s, d) => s + d.pomodorosCompleted, 0) / weeks);
          recentAvgs.set('tasks', last28.reduce((s, d) => s + d.tasksCompleted, 0) / weeks);
          recentAvgs.set('focus_hours', last28.reduce((s, d) => s + d.focusTime, 0) / weeks / 3600);
        }

        const systemGoals = pickSystemGoals(SYSTEM_WEEKLY_GOAL_COUNT, recentAvgs);

        set((state) => ({
          goals: [...state.goals.filter((g) => g.weekStart !== weekKey), ...systemGoals].slice(-40),
          lastGeneratedWeek: weekKey,
        }));

        // Sync
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
      },

      setPersonalGoal: (metric, targetValue) => {
        const weekKey = getWeekKey();
        const existing = get().goals.find(
          (g) => g.weekStart === weekKey && g.goalType === 'personal'
        );

        if (existing) {
          // Update existing personal goal
          set((state) => ({
            goals: state.goals.map((g) =>
              g.id === existing.id
                ? { ...g, goalParams: { metric }, targetValue, currentValue: 0, isCompleted: false }
                : g
            ),
          }));
          useSyncStore.getState().enqueue('weekly_goals', 'update', {
            id: existing.id,
            goal_params: { metric },
            target_value: targetValue,
            current_value: 0,
            is_completed: false,
          });
        } else {
          const newGoal: WeeklyGoal = {
            id: generateId(),
            weekStart: weekKey,
            goalType: 'personal',
            goalParams: { metric },
            targetValue,
            currentValue: 0,
            isCompleted: false,
            xpReward: PERSONAL_GOAL_XP,
          };
          set((state) => ({
            goals: [...state.goals, newGoal],
          }));
          useSyncStore.getState().enqueue('weekly_goals', 'insert', {
            id: newGoal.id,
            week_start: newGoal.weekStart,
            goal_type: newGoal.goalType,
            goal_params: newGoal.goalParams,
            target_value: newGoal.targetValue,
            current_value: newGoal.currentValue,
            is_completed: newGoal.isCompleted,
            xp_reward: newGoal.xpReward,
          });
        }
      },

      updateGoalProgress: (metric, delta) => {
        const weekKey = getWeekKey();
        let justCompleted: WeeklyGoal | null = null;

        const updated = get().goals.map((goal) => {
          if (goal.weekStart !== weekKey || goal.isCompleted) return goal;
          const goalMetric = (goal.goalParams as { metric?: string }).metric;
          if (goalMetric !== metric) return goal;

          const newValue = Math.min(goal.currentValue + delta, goal.targetValue);
          const nowCompleted = newValue >= goal.targetValue;

          const updatedGoal = { ...goal, currentValue: newValue, isCompleted: nowCompleted };
          if (nowCompleted && !goal.isCompleted) justCompleted = updatedGoal;
          return updatedGoal;
        });

        set({ goals: updated });

        const completed = justCompleted as WeeklyGoal | null;
        if (completed) {
          const xp = completed.goalType === 'personal' ? PERSONAL_GOAL_XP : XP_VALUES.WEEKLY_GOAL_COMPLETE;
          useGamificationStore.getState().addXp(xp);

          useSyncStore.getState().enqueue('weekly_goals', 'update', {
            id: completed.id,
            current_value: completed.currentValue,
            is_completed: true,
          });

          // Check all-complete bonus
          const weekGoals = updated.filter((g) => g.weekStart === weekKey);
          if (weekGoals.length > 0 && weekGoals.every((g) => g.isCompleted)) {
            useGamificationStore.getState().addXp(WEEKLY_GOAL_ALL_COMPLETE_BONUS);
          }
        }
      },

      getThisWeekGoals: () => {
        const weekKey = getWeekKey();
        return get().goals.filter((g) => g.weekStart === weekKey);
      },

      getCompletedCount: () => {
        const weekKey = getWeekKey();
        return get().goals.filter((g) => g.weekStart === weekKey && g.isCompleted).length;
      },
    }),
    {
      name: 'weekly-goals-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        goals: state.goals,
        lastGeneratedWeek: state.lastGeneratedWeek,
      }),
    }
  )
);
