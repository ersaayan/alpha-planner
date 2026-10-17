import { ACHIEVEMENTS, XP_VALUES, calculateLevel, getCurrentLevelXp, getXpProgressFor, type XpProgress } from '@/constants/gamification';
import { calculateComboXp } from '@/constants/combo';
import { DAILY_QUEST_ALL_COMPLETE_BONUS, DAILY_QUEST_COUNT, type QuestEvent } from '@/constants/daily-quests';
import type { Achievement, ComboState, DailyStats, PrestigeRecord, PrestigeState, TodoPriority, UserAchievement, UserStats } from '@/types';
import { INITIAL_COMBO_STATE, INITIAL_PRESTIGE_STATE, INITIAL_USER_STATS } from '@/types';
import { getAchievementProgress, isActiveDay } from '@/services/gamification/achievement-rules';
import { addDaysToKey, getDateKey } from '@/utils/date';
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

  /** A weekly goal was completed (feeds the "quests and goal in one day" achievement). */
  recordWeeklyGoalCompleted: (at: Date) => void;

  // Achievement actions
  /** Unlocks every achievement now earned; `at` is the day daily achievements look at. */
  checkAchievements: (at?: Date) => void;
  dismissNotification: (achievementId: string) => void;
  unlockAchievement: (achievementId: string, at?: Date) => void;

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
  getXpProgress: () => XpProgress;
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

/**
 * The daily combo streak that still applies on `dateKey`. A combo day keeps its
 * multiplier until the end of the next day; after a day without one it lapses.
 */
export function effectiveDailyCombo(combo: ComboState, dateKey: string): number {
  const last = combo.lastDailyComboDate;
  if (!last || last < addDaysToKey(dateKey, -1)) return 0;
  return combo.dailyComboStreak;
}

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
    (set, get) => {
      /** Records unlocked achievements, queues their celebration and pays their XP (no multiplier). */
      const grantAchievements = (achievements: Achievement[], at: Date) => {
        const unlockedAt = at.toISOString();
        const records: UserAchievement[] = achievements.map((a) => ({
          achievementId: a.id,
          unlockedAt,
          notified: false,
        }));
        set((state) => ({
          unlockedAchievements: [...state.unlockedAchievements, ...records],
          pendingNotifications: [...state.pendingNotifications, ...achievements],
        }));
        const xp = achievements.reduce((sum, a) => sum + a.xpReward, 0);
        if (xp > 0) get().addXp(xp, at);

        // Sync achievements to Supabase
        for (const ua of records) {
          useSyncStore.getState().enqueue('achievements', 'insert', {
            achievement_id: ua.achievementId,
            unlocked_at: ua.unlockedAt,
            notified: ua.notified,
          });
        }
      };

      return {
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
                lifetimeXp: (state.stats.lifetimeXp ?? 0) + amount,
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
          const dailyCombo = effectiveDailyCombo(combo, getDateKey(completionDate));
          const xp = calculateComboXp(XP_VALUES.POMODORO_COMPLETE, combo.sessionCombo, dailyCombo, true);
          get().addXp(xp, completionDate);
          get().updateDailyStats({ pomodorosCompleted: 1, focusTime }, completionDate);
          get().updateStreak();
          get().incrementSessionCombo();
          get().checkDailyCombo();

          // Time-based achievements
          const hour = completionDate.getHours();
          if (hour < 7) get().unlockAchievement('early_bird', completionDate);
          if (hour >= 23) get().unlockAchievement('night_owl', completionDate);
          if (hour >= 0 && hour < 5) get().unlockAchievement('night_shift', completionDate);
          if (hour === 0) get().unlockAchievement('midnight_oil', completionDate);

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

          get().checkAchievements(completionDate);
        },

        incrementTaskCompleted: (details = {}) => {
          const at = details.at ?? new Date();
          set((state) => {
            const categoryTaskCounts = { ...(state.stats.categoryTaskCounts ?? {}) };
            if (details.categoryId) categoryTaskCounts[details.categoryId] = (categoryTaskCounts[details.categoryId] ?? 0) + 1;
            return {
              stats: {
                ...state.stats,
                totalTasksCompleted: state.stats.totalTasksCompleted + 1,
                urgentTasksCompleted: (state.stats.urgentTasksCompleted ?? 0) + (details.priority === 'urgent' ? 1 : 0),
                categoryTaskCounts,
              },
            };
          });

          const dailyCombo = effectiveDailyCombo(get().combo, getDateKey(at));
          const xp = calculateComboXp(XP_VALUES.TASK_COMPLETE, 0, dailyCombo, false);
          get().addXp(xp, at);
          get().updateDailyStats({ tasksCompleted: 1 }, at);
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

          get().checkAchievements(at);
        },

        recordBreak: (at, skipped) => {
          get().updateDailyStats(skipped ? { breaksSkipped: 1 } : { breaksCompleted: 1 }, at);
          emitQuestEvent({ type: skipped ? 'break_skipped' : 'break_completed', at });
          get().checkAchievements(at);
        },

        recordSubtaskCompleted: (at = new Date()) => {
          const dailyCombo = effectiveDailyCombo(get().combo, getDateKey(at));
          get().addXp(calculateComboXp(XP_VALUES.SUBTASK_COMPLETE, 0, dailyCombo, false), at);
          set((state) => ({
            stats: { ...state.stats, totalSubtasksCompleted: (state.stats.totalSubtasksCompleted ?? 0) + 1 },
          }));
          get().updateDailyStats({ subtasksCompleted: 1 }, at);
          emitQuestEvent({ type: 'subtask_completed', at });
          get().checkAchievements(at);
        },

        recordTaskCreated: (at = new Date()) => {
          get().updateDailyStats({ tasksCreated: 1 }, at);
          emitQuestEvent({ type: 'task_created', at });
        },

        recordQuestCompleted: (at, perfectDay) => {
          get().updateDailyStats({ dailyQuestsCompleted: 1, ...(perfectDay ? { perfectQuestDay: true } : {}) }, at);
          if (perfectDay) {
            set((state) => ({
              stats: { ...state.stats, perfectQuestDays: (state.stats.perfectQuestDays ?? 0) + 1 },
            }));
            get().addXp(DAILY_QUEST_ALL_COMPLETE_BONUS, at);
            // All of the day's quests before noon / the last one after 23:00.
            if (at.getHours() < 12) get().unlockAchievement('speed_runner', at);
            if (at.getHours() >= 23) get().unlockAchievement('last_minute', at);
          }
          get().checkAchievements(at);
        },

        recordWeeklyGoalCompleted: (at) => {
          get().updateDailyStats({ weeklyGoalsCompleted: 1 }, at);
          get().checkAchievements(at);
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

        checkAchievements: (at = new Date()) => {
          const { stats, unlockedAchievements, combo, prestige, dailyStats } = get();
          const unlockedIds = new Set(unlockedAchievements.map((ua) => ua.achievementId));
          const dateKey = getDateKey(at);

          // Other stores are read lazily to avoid circular imports.
          const { useTodoStore } = require('./todo-store') as typeof import('./todo-store');
          const { useCategoryStore } = require('./category-store') as typeof import('./category-store');
          const context = {
            stats,
            sessionCombo: combo.sessionCombo,
            dailyCombo: effectiveDailyCombo(combo, dateKey),
            prestigeCount: prestige.count,
            dailyStats,
            dateKey,
            todos: useTodoStore.getState().todos,
            categories: useCategoryStore.getState().categories,
          };

          const newlyUnlocked = ACHIEVEMENTS.filter((achievement) => {
            if (unlockedIds.has(achievement.id)) return false;
            const progress = getAchievementProgress(achievement, context);
            return progress !== null && progress.current >= progress.target;
          });
          if (newlyUnlocked.length === 0) return;
          grantAchievements(newlyUnlocked, at);
          // Their XP may complete another one (levels, total XP).
          get().checkAchievements(at);
        },

        dismissNotification: (achievementId) => {
          set((state) => ({
            pendingNotifications: state.pendingNotifications.filter((a) => a.id !== achievementId),
            unlockedAchievements: state.unlockedAchievements.map((ua) =>
              ua.achievementId === achievementId ? { ...ua, notified: true } : ua
            ),
          }));
        },

        unlockAchievement: (achievementId, at = new Date()) => {
          if (get().unlockedAchievements.some((ua) => ua.achievementId === achievementId)) return;
          const achievement = ACHIEVEMENTS.find((a) => a.id === achievementId);
          if (!achievement) return;
          grantAchievements([achievement], at);
          get().checkAchievements(at);
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
          if (updates.perfectQuestDay) updated.perfectQuestDay = true;

          // Kept in date order, so trimming drops the oldest days.
          const next = [...dailyStats.filter((ds) => ds.date !== date), updated]
            .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
            .slice(-DAILY_STATS_LIMIT);
          // Lifetime active days: counted when a day gets its first pomodoro or task.
          const becameActive = !isActiveDay(existing) && isActiveDay(updated);
          set((state) => ({
            dailyStats: next,
            ...(becameActive ? { stats: { ...state.stats, activeDays: (state.stats.activeDays ?? 0) + 1 } } : {}),
          }));

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
          return getXpProgressFor(stats.totalXp, stats.level);
        },

        isAchievementUnlocked: (achievementId) => {
          return get().unlockedAchievements.some((ua) => ua.achievementId === achievementId);
        },
      };
    },
    createPersistOptions<GamificationState, PersistedGamificationState>({
      name: 'gamification-storage',
      // v1 had no combo/prestige; v2 added them. v3: lifetime counters and perfect quest days.
      version: 3,
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

/**
 * v0/v1 → v2: missing combo/prestige objects are filled from defaults by the deep merge.
 * v2 → v3: a perfect quest day was stored as `dailyQuestsCompleted: 1`; lifetime counters
 * start from what the stored data shows.
 */
export function migrateGamificationState(persisted: unknown, fromVersion: number) {
  const state = asRecord(persisted);
  const stats = asRecord(state.stats);
  let dailyStats = asRecordArray(state.dailyStats);
  const prestige = asRecord(state.prestige);

  if (fromVersion < 3) {
    dailyStats = dailyStats
      .filter((day) => typeof day.date === 'string')
      .map((day) =>
        Number(day.dailyQuestsCompleted) >= 1
          ? { ...day, dailyQuestsCompleted: DAILY_QUEST_COUNT, perfectQuestDay: true }
          : day
      )
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const pastSeasonsXp = asRecordArray(prestige.history).reduce((sum, record) => sum + (Number(record.totalXp) || 0), 0);
    Object.assign(stats, {
      activeDays: dailyStats.filter((day) => Number(day.pomodorosCompleted) > 0 || Number(day.tasksCompleted) > 0).length,
      perfectQuestDays: dailyStats.filter((day) => day.perfectQuestDay === true).length,
      lifetimeXp: (Number(stats.totalXp) || 0) + pastSeasonsXp,
    });
  }

  return {
    stats,
    unlockedAchievements: asRecordArray(state.unlockedAchievements),
    dailyStats,
    pendingNotifications: asRecordArray(state.pendingNotifications),
    combo: asRecord(state.combo),
    prestige,
  };
}
