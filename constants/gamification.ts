import type { Achievement, LevelConfig } from '@/types';

export const XP_VALUES = {
  POMODORO_COMPLETE: 25,
  TASK_COMPLETE: 10,
  SUBTASK_COMPLETE: 3,
  DAILY_STREAK: 50,
  ACHIEVEMENT_UNLOCK: 100,
} as const;

export const LEVELS: LevelConfig[] = [
  { level: 1, xpRequired: 0, title: 'Seedling' },
  { level: 2, xpRequired: 100, title: 'Sprout' },
  { level: 3, xpRequired: 250, title: 'Sapling' },
  { level: 4, xpRequired: 500, title: 'Young Tree' },
  { level: 5, xpRequired: 850, title: 'Growing Tree' },
  { level: 6, xpRequired: 1300, title: 'Sturdy Tree' },
  { level: 7, xpRequired: 1900, title: 'Tall Tree' },
  { level: 8, xpRequired: 2650, title: 'Ancient Tree' },
  { level: 9, xpRequired: 3550, title: 'Forest Guardian' },
  { level: 10, xpRequired: 4600, title: 'Forest Master' },
];

export const ACHIEVEMENTS: Achievement[] = [
  // Pomodoro achievements
  {
    id: 'first_pomodoro',
    name: 'First Focus',
    description: 'Complete your first pomodoro session',
    category: 'pomodoro',
    icon: 'clock-outline',
    xpReward: 50,
    requirement: { type: 'pomodoro_count', value: 1 },
    isSecret: false,
  },
  {
    id: 'pomodoro_10',
    name: 'Getting Started',
    description: 'Complete 10 pomodoro sessions',
    category: 'pomodoro',
    icon: 'clock-outline',
    xpReward: 100,
    requirement: { type: 'pomodoro_count', value: 10 },
    isSecret: false,
  },
  {
    id: 'pomodoro_50',
    name: 'Focus Master',
    description: 'Complete 50 pomodoro sessions',
    category: 'pomodoro',
    icon: 'award-outline',
    xpReward: 250,
    requirement: { type: 'pomodoro_count', value: 50 },
    isSecret: false,
  },
  {
    id: 'pomodoro_100',
    name: 'Centurion',
    description: 'Complete 100 pomodoro sessions',
    category: 'pomodoro',
    icon: 'star-outline',
    xpReward: 500,
    requirement: { type: 'pomodoro_count', value: 100 },
    isSecret: false,
  },

  // Task achievements
  {
    id: 'first_task',
    name: 'First Step',
    description: 'Complete your first task',
    category: 'tasks',
    icon: 'checkmark-circle-outline',
    xpReward: 25,
    requirement: { type: 'task_count', value: 1 },
    isSecret: false,
  },
  {
    id: 'tasks_10',
    name: 'Task Tackler',
    description: 'Complete 10 tasks',
    category: 'tasks',
    icon: 'checkmark-circle-outline',
    xpReward: 75,
    requirement: { type: 'task_count', value: 10 },
    isSecret: false,
  },
  {
    id: 'tasks_50',
    name: 'Productivity Pro',
    description: 'Complete 50 tasks',
    category: 'tasks',
    icon: 'trophy-outline',
    xpReward: 200,
    requirement: { type: 'task_count', value: 50 },
    isSecret: false,
  },
  {
    id: 'tasks_100',
    name: 'Task Champion',
    description: 'Complete 100 tasks',
    category: 'tasks',
    icon: 'trophy-outline',
    xpReward: 400,
    requirement: { type: 'task_count', value: 100 },
    isSecret: false,
  },

  // Streak achievements
  {
    id: 'streak_3',
    name: 'Getting Consistent',
    description: 'Maintain a 3-day streak',
    category: 'streaks',
    icon: 'flash-outline',
    xpReward: 75,
    requirement: { type: 'streak_days', value: 3 },
    isSecret: false,
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Maintain a 7-day streak',
    category: 'streaks',
    icon: 'flash-outline',
    xpReward: 150,
    requirement: { type: 'streak_days', value: 7 },
    isSecret: false,
  },
  {
    id: 'streak_14',
    name: 'Two Week Champion',
    description: 'Maintain a 14-day streak',
    category: 'streaks',
    icon: 'flash-outline',
    xpReward: 300,
    requirement: { type: 'streak_days', value: 14 },
    isSecret: false,
  },
  {
    id: 'streak_30',
    name: 'Monthly Master',
    description: 'Maintain a 30-day streak',
    category: 'streaks',
    icon: 'flash-outline',
    xpReward: 500,
    requirement: { type: 'streak_days', value: 30 },
    isSecret: false,
  },

  // Milestone achievements
  {
    id: 'focus_hour',
    name: 'Hour of Power',
    description: 'Accumulate 1 hour of focus time',
    category: 'milestones',
    icon: 'hourglass-outline',
    xpReward: 50,
    requirement: { type: 'focus_time', value: 3600 },
    isSecret: false,
  },
  {
    id: 'focus_10_hours',
    name: 'Deep Work',
    description: 'Accumulate 10 hours of focus time',
    category: 'milestones',
    icon: 'hourglass-outline',
    xpReward: 200,
    requirement: { type: 'focus_time', value: 36000 },
    isSecret: false,
  },
  {
    id: 'focus_100_hours',
    name: 'Master of Focus',
    description: 'Accumulate 100 hours of focus time',
    category: 'milestones',
    icon: 'hourglass-outline',
    xpReward: 1000,
    requirement: { type: 'focus_time', value: 360000 },
    isSecret: false,
  },

  // Special achievements
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Complete a pomodoro before 7 AM',
    category: 'special',
    icon: 'sun-outline',
    xpReward: 100,
    requirement: { type: 'early_pomodoro', value: 1 },
    isSecret: true,
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Complete a pomodoro after 11 PM',
    category: 'special',
    icon: 'moon-outline',
    xpReward: 100,
    requirement: { type: 'late_pomodoro', value: 1 },
    isSecret: true,
  },
];

export function calculateLevel(totalXp: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVELS[i].xpRequired) {
      return LEVELS[i].level;
    }
  }
  return 1;
}

export function getLevelTitle(level: number): string {
  const levelConfig = LEVELS.find((l) => l.level === level);
  return levelConfig?.title ?? 'Seedling';
}

export function getXpForNextLevel(level: number): number {
  const nextLevel = LEVELS.find((l) => l.level === level + 1);
  if (!nextLevel) return Infinity; // Max level reached
  return nextLevel.xpRequired;
}

export function getCurrentLevelXp(level: number): number {
  const currentLevel = LEVELS.find((l) => l.level === level);
  return currentLevel?.xpRequired ?? 0;
}
