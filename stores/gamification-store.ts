import { ACHIEVEMENTS, XP_VALUES, calculateLevel, getCurrentLevelXp, getXpProgressFor, type XpProgress } from '@/constants/gamification';
import {
  calculateComboXp,
  effectiveDailyCombo,
  getDailyComboMultiplier,
  getSessionComboMultiplier,
  liveSessionCombo,
  sessionComboMaxGapMs,
} from '@/constants/combo';
import { DAILY_QUEST_ALL_COMPLETE_BONUS, DAILY_QUEST_COUNT, type QuestEvent } from '@/constants/daily-quests';
import type { Achievement, ComboState, DailyStats, PrestigeRecord, PrestigeState, TodoPriority, UserAchievement, UserStats } from '@/types';
import { INITIAL_COMBO_STATE, INITIAL_PRESTIGE_STATE, INITIAL_USER_STATS } from '@/types';
import { getAchievementProgress, isActiveDay } from '@/services/gamification/achievement-rules';
import { buildSeasonRecord, summarizeSeason } from '@/services/gamification/season';
import { addDaysToKey, getDateKey, getMonthKey } from '@/utils/date';
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
  /** Counts the day of `at` (default: now) for the streak. */
  updateStreak: (at?: Date) => void;
  /**
   * Brings date-dependent state up to `now`: a streak that was not continued yesterday is
   * shown as 0. Run on hydration, on resume and when the day changes.
   */
  refreshDayState: (now?: Date) => void;

  /** A weekly goal was completed (feeds the "quests and goal in one day" achievement). */
  recordWeeklyGoalCompleted: (at: Date) => void;

  // Achievement actions
  /** Unlocks every achievement now earned; `at` is the day daily achievements look at. */
  checkAchievements: (at?: Date) => void;
  dismissNotification: (achievementId: string) => void;
  unlockAchievement: (achievementId: string, at?: Date) => void;

  // Combo
  incrementSessionCombo: (at?: Date) => void;
  resetSessionCombo: () => void;
  checkDailyCombo: (at?: Date) => void;
  /** The combos that still apply at `now`, with their multipliers. */
  getComboStatus: (now?: Date) => ComboStatus;

  // Prestige
  /**
   * Starts a new season when the month has changed: records the finished one with its
   * rewards, resets the level and season XP, and gives the reward XP as a head start.
   * Returns the finished season's record, or null when nothing changed.
   */
  checkPrestigeReset: (now?: Date) => PrestigeRecord | null;
  /** The user has seen the summary of the season that ended in `month`. */
  acknowledgeSeason: (month: string) => void;

  // Daily stats
  /** Adds the counters in `updates` to the stats of the day of `at` (default: today). */
  updateDailyStats: (updates: Partial<Omit<DailyStats, 'date'>>, at?: Date) => void;

  // Utility
  getXpProgress: () => XpProgress;
  isAchievementUnlocked: (achievementId: string) => boolean;
}

export interface ComboStatus {
  sessionCombo: number;
  sessionMultiplier: number;
  dailyCombo: number;
  dailyMultiplier: number;
}

/** The session combo gap allowed with the current long-break setting. */
function comboGapMs(): number {
  try {
    const { useSettingsStore } = require('./settings-store') as typeof import('./settings-store');
    return sessionComboMaxGapMs(useSettingsStore.getState().pomodoroSettings.longBreakDuration);
  } catch {
    return sessionComboMaxGapMs();
  }
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

export { effectiveDailyCombo };

/**
 * Adds to the weekly goals of the week of `at`, then recomputes the streak and
 * perfect-quest-day goals from the daily stats.
 */
function updateWeeklyGoals(at: Date, deltas: [string, number][]): void {
  try {
    const { useWeeklyGoalsStore } = require('./weekly-goals-store') as typeof import('./weekly-goals-store');
    const goals = useWeeklyGoalsStore.getState();
    for (const [metric, delta] of deltas) goals.updateGoalProgress(metric, delta, at);
    goals.refreshDerivedGoals(at);
  } catch (error) {
    console.warn('[gamification] Weekly goal progress failed', error);
  }
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

          const pausedMs = Math.max(0, details?.pausedMs ?? 0);
          const startedAt = details?.startedAt ?? new Date(completionDate.getTime() - focusTime * 1000 - pausedMs);

          // A session that started too long after the previous one starts a new combo.
          if (liveSessionCombo(get().combo, startedAt.getTime(), comboGapMs()) === 0 && get().combo.sessionCombo !== 0) {
            get().resetSessionCombo();
          }

          // Apply combo multiplier to pomodoro XP
          const { combo } = get();
          const dailyCombo = effectiveDailyCombo(combo, getDateKey(completionDate));
          const xp = calculateComboXp(XP_VALUES.POMODORO_COMPLETE, combo.sessionCombo, dailyCombo, true);
          get().addXp(xp, completionDate);
          get().updateDailyStats({ pomodorosCompleted: 1, focusTime }, completionDate);
          get().updateStreak(completionDate);
          get().incrementSessionCombo(completionDate);
          get().checkDailyCombo(completionDate);

          // Time-based achievements
          const hour = completionDate.getHours();
          if (hour < 7) get().unlockAchievement('early_bird', completionDate);
          if (hour >= 23) get().unlockAchievement('night_owl', completionDate);
          if (hour >= 0 && hour < 5) get().unlockAchievement('night_shift', completionDate);
          if (hour === 0) get().unlockAchievement('midnight_oil', completionDate);

          emitQuestEvent({
            type: 'focus_completed',
            at: completionDate,
            startedAt,
            seconds: focusTime,
            pausedMs,
          });

          updateWeeklyGoals(completionDate, [
            ['pomodoros', 1],
            ['focus_hours', focusTime / 3600],
          ]);

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
          get().updateStreak(at);
          get().checkDailyCombo(at);

          emitQuestEvent({
            type: 'task_completed',
            at,
            priority: details.priority ?? 'medium',
            categoryId: details.categoryId ?? null,
            wasOverdue: details.wasOverdue ?? false,
          });

          updateWeeklyGoals(at, [['tasks', 1]]);

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
            updateWeeklyGoals(at, []);
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

        updateStreak: (at = new Date()) => {
          const day = getDateKey(at);
          const { stats, dailyStats } = get();
          const lastActive = stats.lastActiveDate;
          const length = stats.streakLength ?? stats.currentStreak;
          if (lastActive === day) return;

          if (lastActive && day < lastActive) {
            // A late credit for an earlier day (e.g. a session that ended before midnight,
            // credited after a task today) may join two runs.
            const active = new Set(dailyStats.filter(isActiveDay).map((ds) => ds.date));
            let run = 0;
            for (let key = lastActive; active.has(key); key = addDaysToKey(key, -1)) run++;
            if (run > length) {
              set((state) => ({
                stats: {
                  ...state.stats,
                  streakLength: run,
                  currentStreak: run,
                  longestStreak: Math.max(state.stats.longestStreak, run),
                  // The gap that was counted as a break is filled now.
                  streakBreaks: Math.max(0, (state.stats.streakBreaks ?? 0) - 1),
                },
              }));
            }
            return;
          }

          const isConsecutive = lastActive === addDaysToKey(day, -1);
          const isBreak = !isConsecutive && Boolean(lastActive) && length > 0;
          const streakLength = isConsecutive ? length + 1 : 1;
          set((state) => ({
            stats: {
              ...state.stats,
              streakLength,
              currentStreak: streakLength,
              longestStreak: Math.max(state.stats.longestStreak, streakLength),
              lastActiveDate: day,
              streakBreaks: (state.stats.streakBreaks ?? 0) + (isBreak ? 1 : 0),
            },
          }));

          if (isConsecutive) {
            get().addXp(XP_VALUES.DAILY_STREAK, at);
          }

          get().checkAchievements(at);
        },

        refreshDayState: (now = new Date()) => {
          const { stats } = get();
          const alive = Boolean(stats.lastActiveDate) && stats.lastActiveDate >= addDaysToKey(getDateKey(now), -1);
          const currentStreak = alive ? (stats.streakLength ?? stats.currentStreak) : 0;
          if (currentStreak !== stats.currentStreak) {
            set((state) => ({ stats: { ...state.stats, currentStreak } }));
          }
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
            sessionCombo: liveSessionCombo(combo, at.getTime(), comboGapMs()),
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
        incrementSessionCombo: (at = new Date()) => {
          set((state) => ({
            combo: {
              ...state.combo,
              sessionCombo: state.combo.sessionCombo + 1,
              lastSessionAt: at.toISOString(),
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

        checkDailyCombo: (at = new Date()) => {
          const day = getDateKey(at);
          const { combo, dailyStats } = get();

          // A combo day has both a pomodoro and a task.
          const dayStats = dailyStats.find((ds) => ds.date === day);
          if (!dayStats || dayStats.pomodorosCompleted < 1 || dayStats.tasksCompleted < 1) return;

          // Already counted, or a later day was already counted.
          if (combo.lastDailyComboDate && combo.lastDailyComboDate >= day) return;

          const isConsecutive = combo.lastDailyComboDate === addDaysToKey(day, -1);

          set((state) => ({
            combo: {
              ...state.combo,
              dailyComboStreak: isConsecutive ? state.combo.dailyComboStreak + 1 : 1,
              lastDailyComboDate: day,
            },
          }));
        },

        getComboStatus: (now = new Date()) => {
          const { combo } = get();
          const sessionCombo = liveSessionCombo(combo, now.getTime(), comboGapMs());
          const dailyCombo = effectiveDailyCombo(combo, getDateKey(now));
          return {
            sessionCombo,
            sessionMultiplier: getSessionComboMultiplier(sessionCombo),
            dailyCombo,
            dailyMultiplier: getDailyComboMultiplier(dailyCombo),
          };
        },

        // Prestige
        checkPrestigeReset: (now = new Date()) => {
          const { prestige, stats, dailyStats } = get();
          const season = prestige.currentSeasonStart;
          const currentMonth = getMonthKey(now);
          // Same season, or the clock was moved back: nothing to do.
          if (!season || season >= currentMonth) return null;

          const summary = summarizeSeason(season, dailyStats, stats);
          if (stats.totalXp === 0 && summary.activeDays === 0) {
            // An empty season (e.g. the app was not used): just move on, no prestige.
            set((state) => ({ prestige: { ...state.prestige, currentSeasonStart: currentMonth } }));
            return null;
          }

          const record = buildSeasonRecord(summary);
          set((state) => ({
            prestige: {
              ...state.prestige,
              count: state.prestige.count + 1,
              currentSeasonStart: currentMonth,
              history: [...state.prestige.history, record].slice(-36),
            },
            stats: {
              ...state.stats,
              level: 1,
              currentXp: 0,
              totalXp: 0,
              // Kept: totals, lifetime XP, streaks, achievements and combos.
            },
          }));
          // Season rewards are a head start for the new season.
          if (record.rewardXp) get().addXp(record.rewardXp, now);
          get().checkAchievements(now);
          return record;
        },

        acknowledgeSeason: (month) => {
          set((state) => ({ prestige: { ...state.prestige, acknowledgedMonth: month } }));
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
    const history = asRecordArray(prestige.history);
    // Seasons that ended before summaries existed are not shown again.
    prestige.acknowledgedMonth = typeof history[history.length - 1]?.month === 'string' ? history[history.length - 1].month : null;
    Object.assign(stats, {
      streakLength: Number(stats.currentStreak) || 0,
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
