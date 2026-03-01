import { ACHIEVEMENTS, XP_VALUES, calculateLevel, getCurrentLevelXp, getXpForNextLevel } from '@/constants/gamification';
import type { Achievement, DailyStats, UserAchievement, UserStats } from '@/types';
import { INITIAL_USER_STATS } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface GamificationState {
  stats: UserStats;
  unlockedAchievements: UserAchievement[];
  dailyStats: DailyStats[];
  pendingNotifications: Achievement[];

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

        get().checkAchievements();
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

        get().addXp(XP_VALUES.POMODORO_COMPLETE);
        get().updateDailyStats({
          pomodorosCompleted: 1,
          focusTime,
        });
        get().updateStreak();

        const hour = completionDate.getHours();
        if (hour < 7) {
          get().unlockAchievement('early_bird');
        }
        if (hour >= 23) {
          get().unlockAchievement('night_owl');
        }
      },

      incrementTaskCompleted: () => {
        set((state) => ({
          stats: {
            ...state.stats,
            totalTasksCompleted: state.stats.totalTasksCompleted + 1,
          },
        }));

        get().addXp(XP_VALUES.TASK_COMPLETE);
        get().updateDailyStats({ tasksCompleted: 1 });
        get().updateStreak();
      },

      updateStreak: () => {
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone
        const { stats } = get();
        const lastActive = stats.lastActiveDate;

        if (lastActive === today) return;

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString('en-CA');

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
        if (get().unlockedAchievements.some((ua) => ua.achievementId === achievementId)) {
          return;
        }

        const achievement = ACHIEVEMENTS.find((a) => a.id === achievementId);
        if (!achievement) return;

        const newAchievement: UserAchievement = {
          achievementId: achievement.id,
          unlockedAt: new Date().toISOString(),
          notified: false,
        };

        set((state) => ({
          unlockedAchievements: [...state.unlockedAchievements, newAchievement],
          pendingNotifications: [...state.pendingNotifications, achievement],
        }));

        get().addXp(achievement.xpReward);
      },

      updateDailyStats: (updates) => {
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone
        const { dailyStats } = get();

        const existingIndex = dailyStats.findIndex((ds) => ds.date === today);

        if (existingIndex >= 0) {
          const existing = dailyStats[existingIndex];
          const updated: DailyStats = {
            date: today,
            pomodorosCompleted: existing.pomodorosCompleted + (updates.pomodorosCompleted ?? 0),
            focusTime: existing.focusTime + (updates.focusTime ?? 0),
            tasksCompleted: existing.tasksCompleted + (updates.tasksCompleted ?? 0),
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
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persistedState: unknown, version: number) => {
        return persistedState as GamificationState;
      },
    }
  )
);
