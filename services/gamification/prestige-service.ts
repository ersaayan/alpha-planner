import { useGamificationStore } from '@/stores/gamification-store';
import type { PrestigeRecord } from '@/types';

/**
 * Month-end rewards based on previous month's performance.
 * Called BEFORE prestige reset — XP goes to the ending season.
 */
interface PrestigeReward {
  id: string;
  nameKey: string; // i18n key, e.g. "prestige.focus_champion"
  condition: (stats: { totalPomodoros: number; totalTasksCompleted: number; activeDays: number; currentStreak: number; level: number; questPerfectDays: number }) => boolean;
  xp: number;
}

const MONTHLY_REWARDS: PrestigeReward[] = [
  {
    id: 'focus_champion',
    nameKey: 'prestige.focus_champion',
    condition: (s) => s.totalPomodoros >= 100,
    xp: 500,
  },
  {
    id: 'task_master',
    nameKey: 'prestige.task_master',
    condition: (s) => s.totalTasksCompleted >= 50,
    xp: 300,
  },
  {
    id: 'loyal_warrior',
    nameKey: 'prestige.loyal_warrior',
    condition: (s) => s.activeDays >= 20,
    xp: 400,
  },
  {
    id: 'perfect_month',
    nameKey: 'prestige.perfect_month',
    condition: (s) => s.currentStreak >= 30,
    xp: 1000,
  },
  {
    id: 'fast_leveler',
    nameKey: 'prestige.fast_leveler',
    condition: (s) => s.level >= 30,
    xp: 250,
  },
  {
    id: 'quest_hunter',
    nameKey: 'prestige.quest_hunter',
    condition: (s) => s.questPerfectDays >= Math.floor(s.activeDays * 0.8),
    xp: 350,
  },
];

/**
 * Evaluate month-end rewards based on current stats.
 * Returns earned reward IDs and total XP.
 */
export function evaluateMonthlyRewards(): { rewards: string[]; totalXp: number } {
  const store = useGamificationStore.getState();
  const { stats, dailyStats } = store;

  // Calculate active days and quest perfect days from current season's daily stats
  const currentMonth = store.prestige.currentSeasonStart;
  const monthStats = dailyStats.filter((ds) => ds.date.startsWith(currentMonth));
  const activeDays = monthStats.filter((ds) => ds.pomodorosCompleted > 0 || ds.tasksCompleted > 0).length;
  const questPerfectDays = monthStats.filter((ds) => ds.dailyQuestsCompleted >= 3).length;

  const evalStats = {
    totalPomodoros: stats.totalPomodoros,
    totalTasksCompleted: stats.totalTasksCompleted,
    activeDays,
    currentStreak: stats.currentStreak,
    level: stats.level,
    questPerfectDays,
  };

  const earned: string[] = [];
  let totalXp = 0;

  for (const reward of MONTHLY_REWARDS) {
    if (reward.condition(evalStats)) {
      earned.push(reward.id);
      totalXp += reward.xp;
    }
  }

  return { rewards: earned, totalXp };
}

/**
 * Full prestige cycle:
 * 1. Evaluate month-end rewards
 * 2. Award reward XP (to ending season)
 * 3. Trigger prestige reset (level/XP → 0, keep achievements/streak/totals)
 */
export function applyPrestigeWithRewards(): PrestigeRecord | null {
  const store = useGamificationStore.getState();
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Already in current season
  if (store.prestige.currentSeasonStart === currentMonth) return null;

  // 1. Evaluate rewards
  const { rewards, totalXp } = evaluateMonthlyRewards();

  // 2. Award reward XP before reset
  if (totalXp > 0) {
    store.addXp(totalXp);
  }

  // 3. Get final stats before reset
  const finalLevel = useGamificationStore.getState().stats.level;
  const finalXp = useGamificationStore.getState().stats.totalXp;

  // 4. Trigger reset (this updates prestige.history internally)
  store.checkPrestigeReset();

  // Return the record for display
  return {
    month: store.prestige.history[store.prestige.history.length - 1]?.month ?? currentMonth,
    finalLevel,
    totalXp: finalXp,
    rewards,
  };
}
