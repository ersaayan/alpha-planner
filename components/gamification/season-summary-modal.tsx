import { Text } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AnimatedButton } from '@/components/animated/animated-button';
import { SheetModal } from '@/components/common/sheet-modal';
import { Icon } from '@/components/icon';
import { Colors, FontSize, GamificationColors, InterFonts, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { levelTitle } from '@/services/gamification/display';
import { getSeasonReward } from '@/services/gamification/season';
import type { PrestigeRecord } from '@/types';
import { formatMonthKey } from '@/utils/locale';

interface SeasonSummaryModalProps {
  record: PrestigeRecord | null;
  onClose: () => void;
}

/** Shown once after a new season starts: how the last one went and what it earned. */
export function SeasonSummaryModal({ record, onClose }: SeasonSummaryModalProps) {
  const { t, i18n } = useTranslation();
  const colors = Colors[useColorScheme() ?? 'light'];
  if (!record) return null;

  const month = formatMonthKey(record.month, i18n.language);
  const rows: [string, string][] = [
    [t('seasonSummary.finalLevel'), `${record.finalLevel} · ${levelTitle(t, record.finalLevel)}`],
    [t('seasonSummary.seasonXp'), t('stats.totalXpValue', { xp: record.totalXp })],
    ...(record.pomodoros !== undefined ? [[t('stats.pomodoros'), String(record.pomodoros)] as [string, string]] : []),
    ...(record.tasks !== undefined ? [[t('stats.tasksDone'), String(record.tasks)] as [string, string]] : []),
    ...(record.activeDays !== undefined ? [[t('seasonSummary.activeDays'), String(record.activeDays)] as [string, string]] : []),
  ];

  return (
    <SheetModal
      visible
      title={t('seasonSummary.title', { month })}
      onClose={onClose}
      testID="season-summary"
      footer={<AnimatedButton title={t('seasonSummary.continue')} size="sm" onPress={onClose} />}
    >
      {rows.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
          <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
        </View>
      ))}

      <Text style={[styles.section, { color: colors.text }]}>{t('seasonSummary.rewards')}</Text>
      {record.rewards.length === 0 ? (
        <Text style={[styles.label, { color: colors.textMuted }]}>{t('seasonSummary.noRewards')}</Text>
      ) : (
        record.rewards.map((id) => {
          const reward = getSeasonReward(id);
          return (
            <View key={id} style={styles.row}>
              <Icon name="award" fill={GamificationColors.levelBadge} style={styles.icon} />
              <Text style={[styles.rewardName, { color: colors.text }]}>
                {reward ? t(reward.nameKey, { month }) : id}
              </Text>
              {reward ? (
                <Text style={[styles.xp, { color: colors.xp }]}>
                  {t('gamification.xpEarned', { amount: reward.xp })}
                </Text>
              ) : null}
            </View>
          );
        })
      )}
      {record.rewardXp ? (
        <Text style={[styles.label, { color: colors.success }]}>
          {t('seasonSummary.headStart', { xp: record.rewardXp })}
        </Text>
      ) : null}

      <Text style={[styles.note, { color: colors.textMuted }]}>{t('seasonSummary.newSeason')}</Text>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  label: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.sm,
  },
  value: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.sm,
  },
  section: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.md,
    marginTop: Spacing.sm,
  },
  icon: {
    width: 18,
    height: 18,
  },
  rewardName: {
    flex: 1,
    fontFamily: InterFonts.medium,
    fontSize: FontSize.sm,
  },
  xp: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.xs,
  },
  note: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.xs,
    lineHeight: FontSize.xs * 1.5,
    marginTop: Spacing.sm,
  },
});
