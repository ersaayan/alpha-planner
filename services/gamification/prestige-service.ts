import { useGamificationStore } from '@/stores/gamification-store';
import type { PrestigeRecord } from '@/types';

export {
  SEASON_REWARDS,
  buildSeasonRecord,
  daysLeftInSeason,
  evaluateSeasonRewards,
  getSeasonEnd,
  getSeasonReward,
  summarizeSeason,
} from './season';

/**
 * Month change → prestige: the finished season is recorded with the rewards earned in
 * it (from that month's daily stats), level and season XP start again, and the reward
 * XP is a head start for the new season. The dashboard then shows a season summary.
 */
export function applyPrestigeWithRewards(now: Date = new Date()): PrestigeRecord | null {
  return useGamificationStore.getState().checkPrestigeReset(now);
}
