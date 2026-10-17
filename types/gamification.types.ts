export type AchievementCategory =
  | 'pomodoro'
  | 'tasks'
  | 'streaks'
  | 'focus_time'
  | 'combo'
  | 'daily_quest'
  | 'category'
  | 'milestones'
  | 'special';

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type AchievementRequirementType =
  | 'pomodoro_count'
  | 'task_count'
  | 'subtask_count'
  | 'streak_days'
  | 'focus_hours'
  | 'session_combo'
  | 'daily_combo'
  | 'quest_perfect_days'
  | 'category_count'
  | 'category_tasks'
  | 'prestige_count'
  | 'level'
  | 'total_xp'
  | 'days_used'
  | 'daily_pomodoros'
  | 'daily_focus_hours'
  | 'time_of_day'
  | 'urgent_task_count'
  | 'weekly_quest_and_goal'
  | 'break_streak'
  | 'all_pending_cleared'
  | 'subtask_perfectionist'
  | 'combo_double';

export interface AchievementRequirement {
  type: AchievementRequirementType;
  value: number;
  extra?: Record<string, unknown>;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  icon: string;
  xpReward: number;
  rarity: AchievementRarity;
  requirement: AchievementRequirement;
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
  xpEarned: number;
  /** Daily quests completed that day (a perfect day completes all of them). */
  dailyQuestsCompleted: number;
  summaryShownAt: string | null;
  subtasksCompleted?: number;
  tasksCreated?: number;
  breaksCompleted?: number;
  breaksSkipped?: number;
  weeklyGoalsCompleted?: number;
}

// --- Combo ---

export interface ComboState {
  sessionCombo: number;
  dailyComboStreak: number;
  lastDailyComboDate: string | null;
}

// --- Prestige ---

export interface PrestigeRecord {
  month: string;
  finalLevel: number;
  totalXp: number;
  rewards: string[];
}

export interface PrestigeState {
  count: number;
  currentSeasonStart: string;
  history: PrestigeRecord[];
}

// --- Daily Quests ---

export interface DailyQuest {
  id: string;
  date: string;
  questType: string;
  questParams: Record<string, unknown>;
  targetValue: number;
  currentValue: number;
  isCompleted: boolean;
  xpReward: number;
}

// --- Weekly Goals ---

export interface WeeklyGoal {
  id: string;
  weekStart: string;
  goalType: 'system' | 'personal';
  goalParams: Record<string, unknown>;
  targetValue: number;
  currentValue: number;
  isCompleted: boolean;
  xpReward: number;
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
  lastActiveDate: '',
};

export const INITIAL_COMBO_STATE: ComboState = {
  sessionCombo: 0,
  dailyComboStreak: 0,
  lastDailyComboDate: null,
};

export const INITIAL_PRESTIGE_STATE: PrestigeState = {
  count: 0,
  currentSeasonStart: new Date().toISOString().slice(0, 7),
  history: [],
};
