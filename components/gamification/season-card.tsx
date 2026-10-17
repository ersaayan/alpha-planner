import { Text } from '@ui-kitten/components';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AnimatedButton } from '@/components/animated/animated-button';
import { CollapsibleCard } from '@/components/common/collapsible-card';
import { SheetModal } from '@/components/common/sheet-modal';
import { Icon } from '@/components/icon';
import { BorderRadius, Colors, FontSize, InterFonts, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNow } from '@/hooks/use-now';
import { SEASON_REWARDS, getSeasonEnd, summarizeSeason } from '@/services/gamification/season';
import { useGamificationStore } from '@/stores';
import { getMonthKey } from '@/utils/date';
import { formatLocalized, formatMonthKey } from '@/utils/locale';

/**
 * The current monthly season: when it ends, the prestige count, and the season rewards
 * with what each one asks for. The info button explains that the level starts again
 * every month. Folded by default (see DEFAULT_APP_SETTINGS).
 */
export function SeasonCard() {
  const { t, i18n } = useTranslation();
  const colors = Colors[useColorScheme() ?? 'light'];
  const now = useNow();
  const [infoVisible, setInfoVisible] = useState(false);

  const prestige = useGamificationStore((state) => state.prestige);
  const dailyStats = useGamificationStore((state) => state.dailyStats);
  const stats = useGamificationStore((state) => state.stats);

  const month = getMonthKey(now);
  const rewards = useMemo(() => {
    const season = summarizeSeason(month, dailyStats, stats);
    return SEASON_REWARDS.map((reward) => ({ reward, earned: reward.isEarned(season) }));
  }, [month, dailyStats, stats]);
  const earnedCount = rewards.filter((r) => r.earned).length;
  // The day before the next season starts.
  const lastDay = new Date(getSeasonEnd(now).getTime() - 1);

  return (
    <CollapsibleCard
      id="season"
      icon="award"
      accent={colors.xp}
      title={t('season.current', { month: formatMonthKey(month, i18n.language) })}
      subtitle={t('season.endsOn', { date: formatLocalized(lastDay, 'd MMMM', i18n.language) })}
      summary={`${earnedCount}/${rewards.length}`}
      testID="season-card"
      accessory={
        <Pressable
          onPress={() => setInfoVisible(true)}
          style={styles.infoButton}
          accessibilityRole="button"
          accessibilityLabel={t('season.infoTitle')}
        >
          <Icon name="info-outline" fill={colors.textMuted} size={20} />
        </Pressable>
      }
    >
      <View style={styles.statusRow}>
        <Text style={[styles.rewardsLine, { color: colors.textSecondary }]}>
          {t('season.rewardsProgress', { earned: earnedCount, total: rewards.length })}
        </Text>
        {prestige.count > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.xp + '20' }]}>
            <Text style={[styles.badgeText, { color: colors.xp }]}>
              {t('gamification.prestigeLevel', { count: prestige.count })}
            </Text>
          </View>
        )}
      </View>

      {rewards.map(({ reward, earned }) => (
        <View
          key={reward.id}
          style={styles.rewardRow}
          accessible
          accessibilityLabel={[earned ? t('common.completed') : null, t(reward.hintKey), t('gamification.xpEarned', { amount: reward.xp })]
            .filter(Boolean)
            .join('. ')}
        >
          <Icon
            name={earned ? 'checkmark-circle-2' : 'radio-button-off'}
            fill={earned ? colors.success : colors.textMuted}
            size={18}
          />
          <Text style={[styles.rewardText, { color: colors.text }]}>{t(reward.hintKey)}</Text>
          <Text style={[styles.rewardXp, { color: colors.xp }]}>{t('gamification.xpEarned', { amount: reward.xp })}</Text>
        </View>
      ))}

      <SheetModal
        visible={infoVisible}
        title={t('season.infoTitle')}
        onClose={() => setInfoVisible(false)}
        footer={<AnimatedButton title={t('common.ok')} size="sm" onPress={() => setInfoVisible(false)} />}
      >
        <Text style={[styles.body, { color: colors.text }]}>{t('season.infoBody')}</Text>
      </SheetModal>
    </CollapsibleCard>
  );
}

const styles = StyleSheet.create({
  infoButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  rewardsLine: {
    flex: 1,
    fontFamily: InterFonts.regular,
    fontSize: FontSize.sm,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.xs,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rewardText: {
    flex: 1,
    fontFamily: InterFonts.regular,
    fontSize: FontSize.sm,
  },
  rewardXp: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.xs,
  },
  body: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.5,
  },
});
