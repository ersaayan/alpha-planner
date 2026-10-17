import { Text } from '@ui-kitten/components';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AnimatedButton } from '@/components/animated/animated-button';
import { AnimatedCard } from '@/components/animated/animated-card';
import { SheetModal } from '@/components/common/sheet-modal';
import { Icon } from '@/components/icon';
import { BorderRadius, Colors, FontSize, GamificationColors, InterFonts, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNow } from '@/hooks/use-now';
import { SEASON_REWARDS, getSeasonEnd, summarizeSeason } from '@/services/gamification/season';
import { useGamificationStore } from '@/stores';
import { getMonthKey } from '@/utils/date';
import { formatLocalized, formatMonthKey } from '@/utils/locale';

/**
 * The current monthly season: when it ends, the prestige count, and the season rewards
 * with what each one asks for. Explains that the level starts again every month.
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
    <AnimatedCard variant="default" style={styles.card} contentStyle={styles.content} testID="season-card">
      <View style={styles.header}>
        <View style={[styles.iconBubble, { backgroundColor: GamificationColors.achievementGold + '25' }]}>
          <Icon name="award" fill={GamificationColors.levelBadge} style={styles.icon} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('season.current', { month: formatMonthKey(month, i18n.language) })}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('season.endsOn', { date: formatLocalized(lastDay, 'd MMMM', i18n.language) })}
          </Text>
        </View>
        {prestige.count > 0 && (
          <View style={[styles.badge, { backgroundColor: GamificationColors.xp + '30' }]}>
            <Text style={[styles.badgeText, { color: colors.xp }]}>
              {t('gamification.prestigeLevel', { count: prestige.count })}
            </Text>
          </View>
        )}
        <Pressable
          onPress={() => setInfoVisible(true)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('season.infoTitle')}
        >
          <Icon name="info-outline" fill={colors.textMuted} style={styles.infoIcon} />
        </Pressable>
      </View>

      <Text style={[styles.rewardsLine, { color: colors.textSecondary }]}>
        {t('season.rewardsProgress', { earned: earnedCount, total: rewards.length })}
      </Text>

      <SheetModal
        visible={infoVisible}
        title={t('season.infoTitle')}
        onClose={() => setInfoVisible(false)}
        footer={<AnimatedButton title={t('common.ok')} size="sm" onPress={() => setInfoVisible(false)} />}
      >
        <Text style={[styles.body, { color: colors.text }]}>{t('season.infoBody')}</Text>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('season.rewardsTitle')}</Text>
        {rewards.map(({ reward, earned }) => (
          <View key={reward.id} style={styles.rewardRow}>
            <Icon
              name={earned ? 'checkmark-circle-2' : 'radio-button-off'}
              fill={earned ? colors.success : colors.textMuted}
              style={styles.rewardIcon}
            />
            <Text style={[styles.rewardText, { color: colors.text }]}>{t(reward.hintKey)}</Text>
            <Text style={[styles.rewardXp, { color: colors.xp }]}>
              {t('gamification.xpEarned', { amount: reward.xp })}
            </Text>
          </View>
        ))}
      </SheetModal>
    </AnimatedCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.lg,
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 20,
    height: 20,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.md,
  },
  subtitle: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.xs,
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
  infoIcon: {
    width: 20,
    height: 20,
  },
  rewardsLine: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.sm,
  },
  body: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.5,
  },
  sectionLabel: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rewardIcon: {
    width: 18,
    height: 18,
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
});
