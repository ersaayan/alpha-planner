import type { Achievement, AchievementCategory, LevelConfig } from '@/types';

export const XP_VALUES = {
  POMODORO_COMPLETE: 15,
  TASK_COMPLETE: 8,
  SUBTASK_COMPLETE: 2,
  DAILY_STREAK: 30,
  ACHIEVEMENT_UNLOCK: 100,
  DAILY_QUEST_COMPLETE: 20,
  DAILY_QUEST_ALL_BONUS: 30,
  WEEKLY_GOAL_COMPLETE: 100,
  WEEKLY_GOAL_ALL_BONUS: 100,
  PERSONAL_GOAL_COMPLETE: 150,
} as const;

// 50 levels — xpRequired(level) = floor(50 * level^1.8)
// 5 tiers: Seedling (1-10), Sapling (11-20), Tree (21-30), Forest (31-40), Ancient (41-50)
const LEVEL_TITLES: string[] = [
  // Tier 1: Seedling (1-10)
  'Seed', 'Sprout', 'Tiny Bud', 'Green Shoot', 'Young Leaf',
  'Tender Stem', 'Growing Root', 'First Bloom', 'Small Vine', 'Seedling Crown',
  // Tier 2: Sapling (11-20)
  'Sapling Start', 'Bark Former', 'Branch Maker', 'Leaf Weaver', 'Sap Runner',
  'Ring Builder', 'Canopy Seeker', 'Root Spreader', 'Sapling Pride', 'Sapling Crown',
  // Tier 3: Tree (21-30)
  'Sturdy Trunk', 'Leafy Canopy', 'Deep Roots', 'Tall Timber', 'Wind Dancer',
  'Sun Catcher', 'Bird Shelter', 'Storm Holder', 'Tree Pride', 'Tree Crown',
  // Tier 4: Forest (31-40)
  'Forest Edge', 'Deep Woods', 'Path Finder', 'Grove Keeper', 'Moss Guardian',
  'Stream Watcher', 'Owl Friend', 'Forest Heart', 'Forest Pride', 'Forest Crown',
  // Tier 5: Ancient (41-50)
  'Elder Oak', 'Ancient Root', 'Wisdom Keeper', 'Time Witness', 'Star Gazer',
  'Earth Binder', 'Legend Bearer', 'Myth Walker', 'Eternal Grove', 'Forest Master',
];

export const LEVELS: LevelConfig[] = LEVEL_TITLES.map((title, i) => ({
  level: i + 1,
  xpRequired: i === 0 ? 0 : Math.floor(50 * Math.pow(i + 1, 1.8)),
  title,
}));

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
  // Binary search for efficiency with 50 levels
  let low = 0;
  let high = LEVELS.length - 1;
  let result = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (LEVELS[mid].xpRequired <= totalXp) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return LEVELS[result].level;
}

export function getLevelTitle(level: number): string {
  const idx = level - 1;
  return LEVELS[idx]?.title ?? 'Seed';
}

export function getLevelTier(level: number): string {
  if (level <= 10) return 'Seedling';
  if (level <= 20) return 'Sapling';
  if (level <= 30) return 'Tree';
  if (level <= 40) return 'Forest';
  return 'Ancient';
}

export function getXpForNextLevel(level: number): number {
  const nextIdx = level; // level is 1-based, so nextIdx = level for 0-based array
  if (nextIdx >= LEVELS.length) return Infinity;
  return LEVELS[nextIdx].xpRequired;
}

export function getCurrentLevelXp(level: number): number {
  const idx = level - 1;
  return LEVELS[idx]?.xpRequired ?? 0;
}

export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.category === category);
}

export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
