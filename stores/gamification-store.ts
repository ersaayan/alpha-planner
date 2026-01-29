import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserStats, UserAchievement, Achievement, DailyStats } from '@/types';
import { INITIAL_USER_STATS } from '@/types';
import { ACHIEVEMENTS, XP_VALUES, calculateLevel, getXpForNextLevel, getCurrentLevelXp } from '@/constants/gamification';

interface GamificationState {
  stats: UserStats;
  unlockedAchievements: UserAchievement[];
  dailyStats: DailyStats[];
  pendingNotifications: Achievement[];

  // XP & Level actions
  addXp: (amount: number) => void;

  // Stat tracking
  incrementPomodoro: (focusTime: number) => void;
  incrementTaskCompleted: () => void;
  updateStreak: () => void;

  // Achievement actions
  checkAchievements: () => void;
  dismissNotification: (achievementId: string) => void;

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
        const { stats } = get();
        const newTotalXp = stats.totalXp + amount;
        const newLevel = calculateLevel(newTotalXp);
        const currentLevelXp = getCurrentLevelXp(newLevel);

        set({
          stats: {
            ...stats,
            totalXp: newTotalXp,
            currentXp: newTotalXp - currentLevelXp,
            level: newLevel,
          },
        });

        get().checkAchievements();
      },

      incrementPomodoro: (focusTime) => {
        const { stats } = get();

        set({
          stats: {
            ...stats,
            totalPomodoros: stats.totalPomodoros + 1,
            totalFocusTime: stats.totalFocusTime + focusTime,
          },
        });

        get().addXp(XP_VALUES.POMODORO_COMPLETE);
        get().updateDailyStats({
          pomodorosCompleted: 1,
          focusTime,
        });
        get().updateStreak();
      },

      incrementTaskCompleted: () => {
        const { stats } = get();

        set({
          stats: {
            ...stats,
            totalTasksCompleted: stats.totalTasksCompleted + 1,
          },
        });

        get().addXp(XP_VALUES.TASK_COMPLETE);
        get().updateDailyStats({ tasksCompleted: 1 });
        get().updateStreak();
      },

      updateStreak: () => {
        const { stats } = get();
        const today = new Date().toISOString().split('T')[0];
        const lastActive = stats.lastActiveDate;

        if (lastActive === today) return;

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        let newStreak = stats.currentStreak;

        if (lastActive === yesterdayStr) {
          // Consecutive day
          newStreak += 1;
          get().addXp(XP_VALUES.DAILY_STREAK);
        } else if (lastActive !== today) {
          // Streak broken
          newStreak = 1;
        }

        set({
          stats: {
            ...stats,
            currentStreak: newStreak,
            longestStreak: Math.max(stats.longestStreak, newStreak),
            lastActiveDate: today,
          },
        });

        get().checkAchievements();
      },

      checkAchievements: () => {
        const { stats, unlockedAchievements } = get();
        const newlyUnlocked: Achievement[] = [];

        for (const achievement of ACHIEVEMENTS) {
          if (get().isAchievementUnlocked(achievement.id)) continue;

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

          set({
            unlockedAchievements: [...unlockedAchievements, ...newAchievements],
            pendingNotifications: [...get().pendingNotifications, ...newlyUnlocked],
          });

          // Add XP for achievements
          for (const achievement of newlyUnlocked) {
            get().addXp(achievement.xpReward);
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

      updateDailyStats: (updates) => {
        const today = new Date().toISOString().split('T')[0];
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
            ],
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
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
