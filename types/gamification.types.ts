export type AchievementCategory = 'pomodoro' | 'tasks' | 'streaks' | 'milestones' | 'special';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  icon: string;
  xpReward: number;
  requirement: {
    type: string;
    value: number;
  };
  isSecret: boolean;
}

export interface UserAchievement {
  achievementId: string;
  unlockedAt: string;
  notified: boolean;
}

export interface UserStats {
  totalPomodoros: number;
  totalFocusTime: number;
  totalTasksCompleted: number;
  currentStreak: number;
  longestStreak: number;
  level: number;
  currentXp: number;
  totalXp: number;
  lastActiveDate: string;
}

export interface LevelConfig {
  level: number;
  xpRequired: number;
  title: string;
}

export interface DailyStats {
  date: string;
  pomodorosCompleted: number;
  focusTime: number;
  tasksCompleted: number;
}

export const INITIAL_USER_STATS: UserStats = {
  totalPomodoros: 0,
  totalFocusTime: 0,
  totalTasksCompleted: 0,
  currentStreak: 0,
  longestStreak: 0,
  level: 1,
  currentXp: 0,
  totalXp: 0,
  lastActiveDate: new Date().toISOString().split('T')[0],
};
