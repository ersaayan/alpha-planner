import { useGamificationStore, useSettingsStore } from '@/stores';

import { SeasonSummaryModal } from './season-summary-modal';

/**
 * App-wide gamification moments, shown one at a time over any screen. Mounted once in
 * the root layout.
 */
export function CelebrationHost() {
  const hasCompletedOnboarding = useSettingsStore((state) => state.settings.hasCompletedOnboarding);
  const history = useGamificationStore((state) => state.prestige.history);
  const acknowledgedMonth = useGamificationStore((state) => state.prestige.acknowledgedMonth);
  const acknowledgeSeason = useGamificationStore((state) => state.acknowledgeSeason);

  if (!hasCompletedOnboarding) return null;

  // The season that just ended, until its summary has been seen.
  const lastSeason = history[history.length - 1];
  const pendingSeason = lastSeason && lastSeason.month !== acknowledgedMonth ? lastSeason : null;

  return <SeasonSummaryModal record={pendingSeason} onClose={() => pendingSeason && acknowledgeSeason(pendingSeason.month)} />;
}
