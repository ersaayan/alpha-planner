import { ACHIEVEMENTS, XP_VALUES, calculateLevel, getCurrentLevelXp, getXpForNextLevel } from '@/constants/gamification';
import { calculateComboXp } from '@/constants/combo';
import type { Achievement, ComboState, DailyStats, PrestigeRecord, PrestigeState, UserAchievement, UserStats } from '@/types';
import { INITIAL_COMBO_STATE, INITIAL_PRESTIGE_STATE, INITIAL_USER_STATS } from '@/types';
import { getDateKey } from '@/utils/date';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface GamificationState {
  stats: UserStats;
  unlockedAchievements: UserAchievement[];
  dailyStats: DailyStats[];
  pendingNotifications: Achievement[];
  combo: ComboState;
  prestige: PrestigeState;

  // XP & Level actions
  addXp: (amount: number) => void;

  // Stat tracking
  incrementPomodoro: (focusTime: number, completedAt?: Date) => void;
  incrementTaskCompleted: () => void;
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
  updateDailyStats: (updates: Partial<Omit<DailyStats, 'date'>>) => void;

  // Utility
  getXpProgress: () => { current: number; required: number; percentage: number };
  isAchievementUnlocked: (achievementId: string) => boolean;
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

      addXp: (amount) => {
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
        get().updateDailyStats({ xpEarned: amount });
      },

      incrementPomodoro: (focusTime, completedAt) => {
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

        get().checkAchievements();
      },

      incrementTaskCompleted: () => {
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
        const { stats, unlockedAchievements } = get();
        const unlockedIds = new Set(unlockedAchievements.map((ua) => ua.achievementId));
        const newlyUnlocked: Achievement[] = [];

        for (const achievement of ACHIEVEMENTS) {
          if (unlockedIds.has(achievement.id)) continue;

          let isUnlocked = false;

          switch (achievement.requirement.type) {
            case 'pomodoro_count':
              isUnlocked = stats.totalPomodoros >= achievement.requirement.value;
              break;
            case 'task_count':
              isUnlocked = stats.totalTasksCompleted >= achievement.requirement.value;
              break;
            case 'streak_days':
              isUnlocked = stats.currentStreak >= achievement.requirement.value;
              break;
            case 'focus_time':
              isUnlocked = stats.totalFocusTime >= achievement.requirement.value;
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

          // Accumulate XP and apply in a single set to break recursion
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

      updateDailyStats: (updates) => {
        const today = getDateKey();
        const { dailyStats } = get();

        const existingIndex = dailyStats.findIndex((ds) => ds.date === today);

        if (existingIndex >= 0) {
          const existing = dailyStats[existingIndex];
          const updated: DailyStats = {
            ...existing,
            pomodorosCompleted: existing.pomodorosCompleted + (updates.pomodorosCompleted ?? 0),
            focusTime: existing.focusTime + (updates.focusTime ?? 0),
            tasksCompleted: existing.tasksCompleted + (updates.tasksCompleted ?? 0),
            xpEarned: (existing.xpEarned ?? 0) + (updates.xpEarned ?? 0),
            dailyQuestsCompleted: (existing.dailyQuestsCompleted ?? 0) + (updates.dailyQuestsCompleted ?? 0),
            summaryShownAt: updates.summaryShownAt ?? existing.summaryShownAt ?? null,
          };

          set({
            dailyStats: [
              ...dailyStats.slice(0, existingIndex),
              updated,
              ...dailyStats.slice(existingIndex + 1),
            ].slice(-90),
          });
        } else {
          const newDailyStat: DailyStats = {
            date: today,
            pomodorosCompleted: updates.pomodorosCompleted ?? 0,
            focusTime: updates.focusTime ?? 0,
            tasksCompleted: updates.tasksCompleted ?? 0,
            xpEarned: updates.xpEarned ?? 0,
            dailyQuestsCompleted: updates.dailyQuestsCompleted ?? 0,
            summaryShownAt: updates.summaryShownAt ?? null,
          };

          set({
            dailyStats: [...dailyStats, newDailyStat].slice(-90), // Keep last 90 days
          });
        }
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
    {
      name: 'gamification-storage',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persistedState: unknown, _version: number) => {
        const state = persistedState as any;
        return {
          stats: { ...INITIAL_USER_STATS, ...(state?.stats || {}) },
          unlockedAchievements: state?.unlockedAchievements || [],
          dailyStats: state?.dailyStats || [],
          pendingNotifications: state?.pendingNotifications || [],
          combo: { ...INITIAL_COMBO_STATE, ...(state?.combo || {}) },
          prestige: { ...INITIAL_PRESTIGE_STATE, ...(state?.prestige || {}) },
        } as GamificationState;
      },
      partialize: (state) => ({
        stats: state.stats,
        unlockedAchievements: state.unlockedAchievements,
        dailyStats: state.dailyStats,
        pendingNotifications: state.pendingNotifications,
        combo: state.combo,
        prestige: state.prestige,
      }),
    }
  )
);
