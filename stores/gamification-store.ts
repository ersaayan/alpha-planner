import { ACHIEVEMENTS, XP_VALUES, calculateLevel, getCurrentLevelXp, getXpForNextLevel } from '@/constants/gamification';
import { calculateComboXp } from '@/constants/combo';
import { DAILY_QUEST_ALL_COMPLETE_BONUS, type QuestEvent } from '@/constants/daily-quests';
import type { Achievement, ComboState, DailyStats, PrestigeRecord, PrestigeState, TodoPriority, UserAchievement, UserStats } from '@/types';
import { INITIAL_COMBO_STATE, INITIAL_PRESTIGE_STATE, INITIAL_USER_STATS } from '@/types';
import { getDateKey } from '@/utils/date';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { asRecord, asRecordArray, createPersistOptions } from './persist';
import { useSyncStore } from './sync-store';

interface GamificationState {
  stats: UserStats;
  unlockedAchievements: UserAchievement[];
  dailyStats: DailyStats[];
  pendingNotifications: Achievement[];
  combo: ComboState;
  prestige: PrestigeState;

  // XP & Level actions
  /** Adds XP, booked on the day of `at` (default: now). */
  addXp: (amount: number, at?: Date) => void;

  // Stat tracking
  /** A completed focus session: its length in seconds, its end and how it went. */
  incrementPomodoro: (focusTime: number, completedAt?: Date, details?: FocusDetails) => void;
  incrementTaskCompleted: (details?: TaskCompletionDetails) => void;
  /** A break that ran to its end, or one the user skipped. */
  recordBreak: (at: Date, skipped: boolean) => void;
  recordSubtaskCompleted: (at?: Date) => void;
  recordTaskCreated: (at?: Date) => void;
  /** A daily quest was completed; `perfectDay` when it was the last one of its day. */
  recordQuestCompleted: (at: Date, perfectDay: boolean) => void;
  updateStreak: () => void;

  // Achievement actions
  checkAchievements: () => void;
  dismissNotification: (achievementId: string) => void;
  unlockAchievement: (achievementId: string) => void;

  // Combo
  incrementSessionCombo: () => void;
  resetSessionCombo: () => void;
  checkDailyCombo: () => void;

  // Prestige
  checkPrestigeReset: () => void;

  // Daily stats
  /** Adds the counters in `updates` to the stats of the day of `at` (default: today). */
  updateDailyStats: (updates: Partial<Omit<DailyStats, 'date'>>, at?: Date) => void;

  // Utility
  getXpProgress: () => { current: number; required: number; percentage: number };
  isAchievementUnlocked: (achievementId: string) => boolean;
}

export interface FocusDetails {
  /** When the session started (its end minus its length and pauses, if omitted). */
  startedAt?: Date;
  /** Total time spent paused, in milliseconds. */
  pausedMs?: number;
}

export interface TaskCompletionDetails {
  priority?: TodoPriority;
  categoryId?: string | null;
  /** The task's due date (or time) had passed when it was completed. */
  wasOverdue?: boolean;
  at?: Date;
}

/** Counters summed by updateDailyStats. */
const DAILY_COUNTERS = [
  'pomodorosCompleted',
  'focusTime',
  'tasksCompleted',
  'xpEarned',
  'dailyQuestsCompleted',
  'subtasksCompleted',
  'tasksCreated',
  'breaksCompleted',
  'breaksSkipped',
  'weeklyGoalsCompleted',
] as const;

/** Days of daily stats kept. */
const DAILY_STATS_LIMIT = 90;

function emitQuestEvent(event: QuestEvent): void {
  try {
    const { useDailyQuestsStore } = require('./daily-quests-store') as typeof import('./daily-quests-store');
    useDailyQuestsStore.getState().recordQuestEvent(event);
  } catch (error) {
    console.warn('[gamification] Quest progress failed', error);
  }
}

export const useGamificationStore = create<GamificationState>()(
  persist(
    (set, get) => ({
      stats: INITIAL_USER_STATS,
      unlockedAchievements: [],
      dailyStats: [],
      pendingNotifications: [],
      combo: INITIAL_COMBO_STATE,
      prestige: INITIAL_PRESTIGE_STATE,

      addXp: (amount, at) => {
        set((state) => {
          const newTotalXp = state.stats.totalXp + amount;
          const newLevel = calculateLevel(newTotalXp);
          const currentLevelXp = getCurrentLevelXp(newLevel);
          return {
            stats: {
              ...state.stats,
              totalXp: newTotalXp,
              currentXp: newTotalXp - currentLevelXp,
              level: newLevel,
            },
          };
        });
        // Track XP in daily stats
        get().updateDailyStats({ xpEarned: amount }, at);
      },

      incrementPomodoro: (focusTime, completedAt, details) => {
        const completionDate = completedAt ?? new Date();

        set((state) => ({
          stats: {
            ...state.stats,
            totalPomodoros: state.stats.totalPomodoros + 1,
            totalFocusTime: state.stats.totalFocusTime + focusTime,
          },
        }));

        // Apply combo multiplier to pomodoro XP
        const { combo } = get();
        const xp = calculateComboXp(XP_VALUES.POMODORO_COMPLETE, combo.sessionCombo, combo.dailyComboStreak, true);
        get().addXp(xp);
        get().updateDailyStats({ pomodorosCompleted: 1, focusTime });
        get().updateStreak();
        get().incrementSessionCombo();
        get().checkDailyCombo();

        // Time-based achievements
        const hour = completionDate.getHours();
        if (hour < 7) get().unlockAchievement('early_bird');
        if (hour >= 23) get().unlockAchievement('night_owl');
        if (hour >= 0 && hour < 5) get().unlockAchievement('night_shift');
        if (hour === 0) get().unlockAchievement('midnight_oil');

        const pausedMs = Math.max(0, details?.pausedMs ?? 0);
        emitQuestEvent({
          type: 'focus_completed',
          at: completionDate,
          startedAt: details?.startedAt ?? new Date(completionDate.getTime() - focusTime * 1000 - pausedMs),
          seconds: focusTime,
          pausedMs,
        });

        // Update weekly goal progress
        try {
          const { useWeeklyGoalsStore } = require('./weekly-goals-store');
          useWeeklyGoalsStore.getState().updateGoalProgress('pomodoros', 1);
          useWeeklyGoalsStore.getState().updateGoalProgress('focus_hours', focusTime / 3600);
        } catch { /* store not yet initialized */ }

        get().checkAchievements();
      },

      incrementTaskCompleted: (details = {}) => {
        const at = details.at ?? new Date();
        set((state) => ({
          stats: {
            ...state.stats,
            totalTasksCompleted: state.stats.totalTasksCompleted + 1,
          },
        }));

        const { combo } = get();
        const xp = calculateComboXp(XP_VALUES.TASK_COMPLETE, 0, combo.dailyComboStreak, false);
        get().addXp(xp);
        get().updateDailyStats({ tasksCompleted: 1 });
        get().updateStreak();
        get().checkDailyCombo();

        emitQuestEvent({
          type: 'task_completed',
          at,
          priority: details.priority ?? 'medium',
          categoryId: details.categoryId ?? null,
          wasOverdue: details.wasOverdue ?? false,
        });

        // Update weekly goal progress
        try {
          const { useWeeklyGoalsStore } = require('./weekly-goals-store');
          useWeeklyGoalsStore.getState().updateGoalProgress('tasks', 1);
        } catch { /* store not yet initialized */ }

        get().checkAchievements();
      },

      recordBreak: (at, skipped) => {
        get().updateDailyStats(skipped ? { breaksSkipped: 1 } : { breaksCompleted: 1 }, at);
        emitQuestEvent({ type: skipped ? 'break_skipped' : 'break_completed', at });
      },

      recordSubtaskCompleted: (at = new Date()) => {
        get().updateDailyStats({ subtasksCompleted: 1 }, at);
        emitQuestEvent({ type: 'subtask_completed', at });
      },

      recordTaskCreated: (at = new Date()) => {
        get().updateDailyStats({ tasksCreated: 1 }, at);
        emitQuestEvent({ type: 'task_created', at });
      },

      recordQuestCompleted: (at, perfectDay) => {
        get().updateDailyStats({ dailyQuestsCompleted: 1 }, at);
        if (perfectDay) get().addXp(DAILY_QUEST_ALL_COMPLETE_BONUS, at);
        get().checkAchievements();
      },

      updateStreak: () => {
        const today = getDateKey();
        const { stats } = get();
        const lastActive = stats.lastActiveDate;

        if (lastActive === today) return;

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = getDateKey(yesterday);

        const isConsecutive = lastActive === yesterdayStr;
        const shouldAwardStreakXp = isConsecutive;

        set((state) => {
          const currentStreak = isConsecutive
            ? state.stats.currentStreak + 1
            : 1;
          return {
            stats: {
              ...state.stats,
              currentStreak,
              longestStreak: Math.max(state.stats.longestStreak, currentStreak),
              lastActiveDate: today,
            },
          };
        });

        if (shouldAwardStreakXp) {
          get().addXp(XP_VALUES.DAILY_STREAK);
        }

        get().checkAchievements();
      },

      checkAchievements: () => {
        const { stats, unlockedAchievements, combo, prestige, dailyStats } = get();
        const unlockedIds = new Set(unlockedAchievements.map((ua) => ua.achievementId));
        const newlyUnlocked: Achievement[] = [];

        // Access external stores lazily to avoid circular deps
        let _todoStore: any = null;
        let _categoryStore: any = null;
        const getTodoStore = () => {
          if (!_todoStore) _todoStore = require('./todo-store').useTodoStore.getState();
          return _todoStore;
        };
        const getCategoryStore = () => {
          if (!_categoryStore) _categoryStore = require('./category-store').useCategoryStore.getState();
          return _categoryStore;
        };

        const today = getDateKey();
        const todayStats = dailyStats.find((ds) => ds.date === today);

        for (const achievement of ACHIEVEMENTS) {
          if (unlockedIds.has(achievement.id)) continue;

          let isUnlocked = false;
          const req = achievement.requirement;

          switch (req.type) {
            case 'pomodoro_count':
              isUnlocked = stats.totalPomodoros >= req.value;
              break;
            case 'task_count':
              isUnlocked = stats.totalTasksCompleted >= req.value;
              break;
            case 'subtask_count': {
              // Count completed subtasks across all todos
              const todos = getTodoStore().todos;
              const completedSubtasks = todos.reduce((sum: number, t: any) =>
                sum + (t.subtasks?.filter((s: any) => s.isCompleted)?.length ?? 0), 0);
              isUnlocked = completedSubtasks >= req.value;
              break;
            }
            case 'streak_days':
              isUnlocked = stats.currentStreak >= req.value;
              break;
            case 'focus_hours':
              isUnlocked = (stats.totalFocusTime / 3600) >= req.value;
              break;
            case 'session_combo':
              isUnlocked = combo.sessionCombo >= req.value;
              break;
            case 'daily_combo':
              isUnlocked = combo.dailyComboStreak >= req.value;
              break;
            case 'quest_perfect_days': {
              // Count days where all 3 quests were completed
              const perfectDays = dailyStats.filter((ds) => ds.dailyQuestsCompleted >= 3).length;
              isUnlocked = perfectDays >= req.value;
              break;
            }
            case 'category_count': {
              if (req.extra?.created) {
                // Count created categories
                const cats = getCategoryStore().categories;
                isUnlocked = cats.length >= req.value;
              } else if (req.extra?.uniqueColors) {
                const cats = getCategoryStore().categories;
                const uniqueColors = new Set(cats.map((c: any) => c.color));
                isUnlocked = uniqueColors.size >= req.value;
              } else if (req.extra?.allCategories) {
                // 10+ tasks in EVERY category
                const cats = getCategoryStore().categories;
                const todos = getTodoStore().todos;
                if (cats.length === 0) break;
                const allHave10 = cats.every((cat: any) => {
                  const count = todos.filter((t: any) => t.categoryId === cat.id && t.status === 'completed').length;
                  return count >= req.value;
                });
                isUnlocked = allHave10;
              } else {
                // Categories with at least 1 completed task
                const todos = getTodoStore().todos;
                const categoriesUsed = new Set(todos.filter((t: any) => t.status === 'completed' && t.categoryId).map((t: any) => t.categoryId));
                isUnlocked = categoriesUsed.size >= req.value;
              }
              break;
            }
            case 'category_tasks': {
              // Max completed tasks in any single category
              const todos = getTodoStore().todos;
              const countByCategory = new Map<string, number>();
              for (const t of todos) {
                if (t.status === 'completed' && t.categoryId) {
                  countByCategory.set(t.categoryId, (countByCategory.get(t.categoryId) ?? 0) + 1);
                }
              }
              const maxInCategory = Math.max(0, ...countByCategory.values());
              isUnlocked = maxInCategory >= req.value;
              break;
            }
            case 'prestige_count':
              isUnlocked = prestige.count >= req.value;
              break;
            case 'level':
              if (req.extra?.withinWeek) {
                // Speed leveler: gained 10+ levels this week (approximate check)
                // This is a simplified check — just check if current level >= value
                isUnlocked = stats.level >= req.value;
              } else {
                isUnlocked = stats.level >= req.value;
              }
              break;
            case 'total_xp':
              isUnlocked = stats.totalXp >= req.value;
              break;
            case 'days_used': {
              if (req.extra?.weekend) {
                // Check if user was active on both Sat and Sun this week
                const now = new Date();
                const dayOfWeek = now.getDay();
                // Find last Saturday and Sunday
                const satOffset = dayOfWeek >= 6 ? dayOfWeek - 6 : dayOfWeek + 1;
                const sunOffset = dayOfWeek >= 0 ? dayOfWeek : 7;
                const sat = new Date(now);
                sat.setDate(now.getDate() - satOffset);
                const sun = new Date(now);
                sun.setDate(now.getDate() - sunOffset);
                const satKey = getDateKey(sat);
                const sunKey = getDateKey(sun);
                const hasSat = dailyStats.some((ds) => ds.date === satKey && ds.pomodorosCompleted > 0);
                const hasSun = dailyStats.some((ds) => ds.date === sunKey && ds.pomodorosCompleted > 0);
                isUnlocked = hasSat && hasSun;
              } else {
                // Total unique active days
                const activeDays = dailyStats.filter((ds) => ds.pomodorosCompleted > 0 || ds.tasksCompleted > 0).length;
                isUnlocked = activeDays >= req.value;
              }
              break;
            }
            case 'daily_pomodoros':
              isUnlocked = (todayStats?.pomodorosCompleted ?? 0) >= req.value;
              break;
            case 'daily_focus_hours':
              isUnlocked = ((todayStats?.focusTime ?? 0) / 3600) >= req.value;
              break;
            case 'time_of_day':
              // Time-based achievements are unlocked via unlockAchievement() calls
              // in incrementPomodoro, not here. Skip.
              break;
            case 'urgent_task_count': {
              const todos = getTodoStore().todos;
              const urgentDone = todos.filter((t: any) => t.status === 'completed' && t.priority === 'urgent').length;
              isUnlocked = urgentDone >= req.value;
              break;
            }
            case 'weekly_quest_and_goal':
              // Checked elsewhere when both conditions met in a single day
              break;
            case 'break_streak':
              // Tracked separately by pomodoro store
              break;
            case 'all_pending_cleared': {
              const todos = getTodoStore().todos;
              const pendingCount = todos.filter((t: any) => t.status === 'pending').length;
              isUnlocked = pendingCount === 0 && stats.totalTasksCompleted > 0;
              break;
            }
            case 'subtask_perfectionist': {
              const todos = getTodoStore().todos;
              isUnlocked = todos.some((t: any) => {
                const subtasks = t.subtasks ?? [];
                return subtasks.length >= req.value && subtasks.every((s: any) => s.isCompleted);
              });
              break;
            }
            case 'combo_double':
              isUnlocked = combo.sessionCombo >= 2 && combo.dailyComboStreak >= 3;
              break;
          }

          if (isUnlocked) {
            newlyUnlocked.push(achievement);
          }
        }

        if (newlyUnlocked.length > 0) {
          const newAchievements: UserAchievement[] = newlyUnlocked.map((a) => ({
            achievementId: a.id,
            unlockedAt: new Date().toISOString(),
            notified: false,
          }));

          const totalAchievementXp = newlyUnlocked.reduce((sum, a) => sum + a.xpReward, 0);

          set((state) => {
            const newTotalXp = state.stats.totalXp + totalAchievementXp;
            const newLevel = calculateLevel(newTotalXp);
            const currentLevelXp = getCurrentLevelXp(newLevel);
            return {
              unlockedAchievements: [...state.unlockedAchievements, ...newAchievements],
              pendingNotifications: [...state.pendingNotifications, ...newlyUnlocked],
              stats: {
                ...state.stats,
                totalXp: newTotalXp,
                currentXp: newTotalXp - currentLevelXp,
                level: newLevel,
              },
            };
          });

          // Sync achievements to Supabase
          for (const ua of newAchievements) {
            useSyncStore.getState().enqueue('achievements', 'insert', {
              achievement_id: ua.achievementId,
              unlocked_at: ua.unlockedAt,
              notified: ua.notified,
            });
          }
        }
      },

      dismissNotification: (achievementId) => {
        set((state) => ({
          pendingNotifications: state.pendingNotifications.filter((a) => a.id !== achievementId),
          unlockedAchievements: state.unlockedAchievements.map((ua) =>
            ua.achievementId === achievementId ? { ...ua, notified: true } : ua
          ),
        }));
      },

      unlockAchievement: (achievementId) => {
        if (get().unlockedAchievements.some((ua) => ua.achievementId === achievementId)) return;
        const achievement = ACHIEVEMENTS.find((a) => a.id === achievementId);
        if (!achievement) return;

        const newAchievement: UserAchievement = {
          achievementId: achievement.id,
          unlockedAt: new Date().toISOString(),
          notified: false,
        };

        // Apply achievement XP directly (no combo multiplier on achievement XP)
        set((state) => {
          const newTotalXp = state.stats.totalXp + achievement.xpReward;
          const newLevel = calculateLevel(newTotalXp);
          const currentLevelXp = getCurrentLevelXp(newLevel);
          return {
            unlockedAchievements: [...state.unlockedAchievements, newAchievement],
            pendingNotifications: [...state.pendingNotifications, achievement],
            stats: {
              ...state.stats,
              totalXp: newTotalXp,
              currentXp: newTotalXp - currentLevelXp,
              level: newLevel,
            },
          };
        });

        // Sync to Supabase
        useSyncStore.getState().enqueue('achievements', 'insert', {
          achievement_id: newAchievement.achievementId,
          unlocked_at: newAchievement.unlockedAt,
          notified: newAchievement.notified,
        });
      },

      // Combo actions
      incrementSessionCombo: () => {
        set((state) => ({
          combo: {
            ...state.combo,
            sessionCombo: state.combo.sessionCombo + 1,
          },
        }));
      },

      resetSessionCombo: () => {
        set((state) => ({
          combo: {
            ...state.combo,
            sessionCombo: 0,
          },
        }));
      },

      checkDailyCombo: () => {
        const today = getDateKey();
        const { combo, dailyStats } = get();

        // Check if today has both a pomodoro and a task
        const todayStats = dailyStats.find((ds) => ds.date === today);
        if (!todayStats || todayStats.pomodorosCompleted < 1 || todayStats.tasksCompleted < 1) return;

        // Already counted today
        if (combo.lastDailyComboDate === today) return;

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = getDateKey(yesterday);

        const isConsecutive = combo.lastDailyComboDate === yesterdayStr;

        set((state) => ({
          combo: {
            ...state.combo,
            dailyComboStreak: isConsecutive ? state.combo.dailyComboStreak + 1 : 1,
            lastDailyComboDate: today,
          },
        }));
      },

      // Prestige
      checkPrestigeReset: () => {
        const { prestige, stats } = get();
        const currentMonth = new Date().toISOString().slice(0, 7); // "2026-04"

        if (prestige.currentSeasonStart === currentMonth) return; // Already in current season

        // New month — record history and reset
        const record: PrestigeRecord = {
          month: prestige.currentSeasonStart,
          finalLevel: stats.level,
          totalXp: stats.totalXp,
          rewards: [], // Will be filled by prestige service in Phase 5
        };

        set((state) => ({
          prestige: {
            count: state.prestige.count + 1,
            currentSeasonStart: currentMonth,
            history: [...state.prestige.history, record],
          },
          stats: {
            ...state.stats,
            level: 1,
            currentXp: 0,
            totalXp: 0,
            // Keep: totalPomodoros, totalFocusTime, totalTasksCompleted, streak, longestStreak, lastActiveDate
          },
          combo: {
            sessionCombo: 0,
            dailyComboStreak: 0,
            lastDailyComboDate: null,
          },
        }));
      },

      updateDailyStats: (updates, at) => {
        const date = getDateKey(at);
        const { dailyStats } = get();
        const existing = dailyStats.find((ds) => ds.date === date);
        const updated: DailyStats = {
          date,
          pomodorosCompleted: 0,
          focusTime: 0,
          tasksCompleted: 0,
          xpEarned: 0,
          dailyQuestsCompleted: 0,
          ...existing,
          summaryShownAt: updates.summaryShownAt ?? existing?.summaryShownAt ?? null,
        };
        for (const field of DAILY_COUNTERS) {
          const delta = updates[field] ?? 0;
          if (delta !== 0 || updated[field] !== undefined) updated[field] = (updated[field] ?? 0) + delta;
        }

        // Kept in date order, so trimming drops the oldest days.
        const next = [...dailyStats.filter((ds) => ds.date !== date), updated]
          .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
          .slice(-DAILY_STATS_LIMIT);
        set({ dailyStats: next });

        // Sync daily stats (upsert)
        useSyncStore.getState().enqueue('daily_stats', 'insert', {
          date,
          pomodoros_completed: updated.pomodorosCompleted,
          focus_time: updated.focusTime,
          tasks_completed: updated.tasksCompleted,
          xp_earned: updated.xpEarned,
          daily_quests_completed: updated.dailyQuestsCompleted,
          summary_shown_at: updated.summaryShownAt,
        });
      },

      getXpProgress: () => {
        const { stats } = get();
        const currentLevelXp = getCurrentLevelXp(stats.level);
        const nextLevelXp = getXpForNextLevel(stats.level);
        const xpInCurrentLevel = stats.totalXp - currentLevelXp;
        const xpRequiredForNextLevel = nextLevelXp - currentLevelXp;

        return {
          current: xpInCurrentLevel,
          required: xpRequiredForNextLevel,
          percentage: xpRequiredForNextLevel > 0 ? (xpInCurrentLevel / xpRequiredForNextLevel) * 100 : 100,
        };
      },

      isAchievementUnlocked: (achievementId) => {
        return get().unlockedAchievements.some((ua) => ua.achievementId === achievementId);
      },
    }),
    createPersistOptions<GamificationState, PersistedGamificationState>({
      name: 'gamification-storage',
      // v1 had no combo/prestige; v2 added them. Already at 2 in shipped builds, so it stays 2.
      version: 2,
      partialize: (state) => ({
        stats: state.stats,
        unlockedAchievements: state.unlockedAchievements,
        dailyStats: state.dailyStats,
        pendingNotifications: state.pendingNotifications,
        combo: state.combo,
        prestige: state.prestige,
      }),
      migrate: migrateGamificationState,
    })
  )
);

type PersistedGamificationState = Pick<
  GamificationState,
  'stats' | 'unlockedAchievements' | 'dailyStats' | 'pendingNotifications' | 'combo' | 'prestige'
>;

/** v0/v1 → v2. Missing combo/prestige objects are filled from defaults by the deep merge. */
export function migrateGamificationState(persisted: unknown, _fromVersion: number) {
  const state = asRecord(persisted);
  return {
    stats: asRecord(state.stats),
    unlockedAchievements: asRecordArray(state.unlockedAchievements),
    dailyStats: asRecordArray(state.dailyStats),
    pendingNotifications: asRecordArray(state.pendingNotifications),
    combo: asRecord(state.combo),
    prestige: asRecord(state.prestige),
  };
}
