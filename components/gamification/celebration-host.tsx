import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { achievementDescription, achievementName, levelTitle } from '@/services/gamification/display';
import { useGamificationStore, useSettingsStore } from '@/stores';

import { AchievementUnlock } from './achievement-unlock';
import { LevelUpModal } from './level-up-modal';
import { SeasonSummaryModal } from './season-summary-modal';
import { XPGainToast } from './xp-gain-toast';

/** XP gained within this window is shown as one toast. */
const XP_TOAST_GATHER_MS = 400;

/**
 * App-wide gamification moments, shown one at a time over any screen, in this order:
 * the summary of a season that just ended, unlocked achievements (oldest first), a level
 * up, then an XP toast. Mounted once in the root layout.
 */
export function CelebrationHost() {
  const { t } = useTranslation();
  const hasCompletedOnboarding = useSettingsStore((state) => state.settings.hasCompletedOnboarding);
  const history = useGamificationStore((state) => state.prestige.history);
  const acknowledgedMonth = useGamificationStore((state) => state.prestige.acknowledgedMonth);
  const acknowledgeSeason = useGamificationStore((state) => state.acknowledgeSeason);
  const pendingAchievements = useGamificationStore((state) => state.pendingNotifications);
  const dismissNotification = useGamificationStore((state) => state.dismissNotification);

  const [pendingLevel, setPendingLevel] = useState<number | null>(null);
  const [xpToast, setXpToast] = useState<{ amount: number; key: number } | null>(null);

  // Level-ups and XP are events, not stored state: watch the store while mounted.
  useEffect(() => {
    let gatheredXp = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = useGamificationStore.subscribe((state, previous) => {
      // A new season resets the level; its summary explains that instead.
      if (state.prestige.count !== previous.prestige.count) return;
      if (state.stats.level > previous.stats.level) {
        const level = state.stats.level;
        setPendingLevel((current) => Math.max(current ?? 0, level));
      }
      const gained = (state.stats.lifetimeXp ?? 0) - (previous.stats.lifetimeXp ?? 0);
      if (gained > 0) {
        gatheredXp += gained;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          const amount = gatheredXp;
          gatheredXp = 0;
          setXpToast({ amount, key: Date.now() });
        }, XP_TOAST_GATHER_MS);
      }
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!hasCompletedOnboarding) return null;

  // The season that just ended, until its summary has been seen.
  const lastSeason = history[history.length - 1];
  const pendingSeason = lastSeason && lastSeason.month !== acknowledgedMonth ? lastSeason : null;
  if (pendingSeason) {
    return <SeasonSummaryModal record={pendingSeason} onClose={() => acknowledgeSeason(pendingSeason.month)} />;
  }

  const achievement = pendingAchievements[0];
  if (achievement) {
    return (
      <AchievementUnlock
        key={achievement.id}
        visible
        icon={achievement.icon}
        title={achievementName(t, achievement)}
        description={achievementDescription(t, achievement)}
        xpReward={achievement.xpReward}
        rarity={achievement.rarity}
        onClose={() => dismissNotification(achievement.id)}
      />
    );
  }

  if (pendingLevel !== null) {
    return (
      <LevelUpModal
        visible
        newLevel={pendingLevel}
        levelTitle={levelTitle(t, pendingLevel)}
        onClose={() => setPendingLevel(null)}
      />
    );
  }

  if (xpToast) {
    return <XPGainToast key={xpToast.key} visible amount={xpToast.amount} onHide={() => setXpToast(null)} />;
  }

  return null;
}
