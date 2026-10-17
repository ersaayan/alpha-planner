import type { DailyStats, PrestigeRecord, UserStats } from '@/types';
import { getMonthKey, parseDateKey } from '@/utils/date';

/**
 * Monthly seasons ("prestige"). Every calendar month is a season: on the 1st the level
 * and season XP start again, the finished season is recorded with its rewards, and the
 * reward XP is a head start for the new season. Pure functions; the store applies them.
 */

/** What the user did in one season, read from that month's daily stats. */
export interface SeasonStats {
  month: string;
  pomodoros: number;
  tasks: number;
  activeDays: number;
  perfectQuestDays: number;
  daysInMonth: number;
  finalLevel: number;
  totalXp: number;
}

export interface SeasonReward {
  id: string;
  /** i18n key of the reward's name (takes {{month}}). */
  nameKey: string;
  /** i18n key of what the reward asks for. */
  hintKey: string;
  xp: number;
  isEarned: (season: SeasonStats) => boolean;
}

export const SEASON_REWARDS: SeasonReward[] = [
  { id: 'focus_champion', nameKey: 'prestige.focus_champion', hintKey: 'season.hint.focus_champion', xp: 500, isEarned: (s) => s.pomodoros >= 100 },
  { id: 'task_master', nameKey: 'prestige.task_master', hintKey: 'season.hint.task_master', xp: 300, isEarned: (s) => s.tasks >= 50 },
  { id: 'loyal_warrior', nameKey: 'prestige.loyal_warrior', hintKey: 'season.hint.loyal_warrior', xp: 400, isEarned: (s) => s.activeDays >= 20 },
  {
    id: 'perfect_month',
    nameKey: 'prestige.perfect_month',
    hintKey: 'season.hint.perfect_month',
    xp: 1000,
    isEarned: (s) => s.activeDays >= s.daysInMonth,
  },
  { id: 'fast_leveler', nameKey: 'prestige.fast_leveler', hintKey: 'season.hint.fast_leveler', xp: 250, isEarned: (s) => s.finalLevel >= 30 },
  {
    id: 'quest_hunter',
    nameKey: 'prestige.quest_hunter',
    hintKey: 'season.hint.quest_hunter',
    xp: 350,
    // At least 10 active days, with every quest done on 80% of them.
    isEarned: (s) => s.activeDays >= 10 && s.perfectQuestDays >= Math.ceil(s.activeDays * 0.8),
  },
];

export function getSeasonReward(id: string): SeasonReward | undefined {
  return SEASON_REWARDS.find((reward) => reward.id === id);
}

function daysInMonth(month: string): number {
  const first = parseDateKey(`${month}-01`);
  return new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
}

export function summarizeSeason(month: string, dailyStats: DailyStats[], stats: Pick<UserStats, 'level' | 'totalXp'>): SeasonStats {
  const days = dailyStats.filter((day) => day.date.startsWith(`${month}-`));
  return {
    month,
    pomodoros: days.reduce((sum, day) => sum + day.pomodorosCompleted, 0),
    tasks: days.reduce((sum, day) => sum + day.tasksCompleted, 0),
    activeDays: days.filter((day) => day.pomodorosCompleted > 0 || day.tasksCompleted > 0).length,
    perfectQuestDays: days.filter((day) => day.perfectQuestDay).length,
    daysInMonth: daysInMonth(month),
    finalLevel: stats.level,
    totalXp: stats.totalXp,
  };
}

export function evaluateSeasonRewards(season: SeasonStats): { rewards: string[]; totalXp: number } {
  const earned = SEASON_REWARDS.filter((reward) => reward.isEarned(season));
  return { rewards: earned.map((reward) => reward.id), totalXp: earned.reduce((sum, reward) => sum + reward.xp, 0) };
}

/** The record kept for a finished season. */
export function buildSeasonRecord(season: SeasonStats): PrestigeRecord {
  const { rewards, totalXp } = evaluateSeasonRewards(season);
  return {
    month: season.month,
    finalLevel: season.finalLevel,
    totalXp: season.totalXp,
    rewards,
    rewardXp: totalXp,
    pomodoros: season.pomodoros,
    tasks: season.tasks,
    activeDays: season.activeDays,
  };
}

/** When the current season ends: midnight at the start of next month (local time). */
export function getSeasonEnd(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

/** Calendar days left in the current season, today included. */
export function daysLeftInSeason(now: Date = new Date()): number {
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate() + 1;
}

export { getMonthKey };
