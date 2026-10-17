import { Text } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AnimatedButton } from '@/components/animated/animated-button';
import { SheetModal } from '@/components/common/sheet-modal';
import { Icon } from '@/components/icon';
import { BorderRadius, Colors, FontSize, InterFonts, Spacing } from '@/constants/theme';
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
      icon="award"
      iconColor={colors.xp}
      onClose={onClose}
      testID="season-summary"
      footer={<AnimatedButton title={t('seasonSummary.continue')} size="sm" onPress={onClose} />}
    >
      <View style={[styles.statsBox, { backgroundColor: colors.backgroundSecondary }]}>
        {rows.map(([label, value], index) => (
          <View
            key={label}
            style={[styles.row, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}
            accessible
            accessibilityLabel={`${label}: ${value}`}
          >
            <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
            <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.section, { color: colors.text }]} accessibilityRole="header">
        {t('seasonSummary.rewards')}
      </Text>
      {record.rewards.length === 0 ? (
        <Text style={[styles.label, { color: colors.textMuted }]}>{t('seasonSummary.noRewards')}</Text>
      ) : (
        record.rewards.map((id) => {
          const reward = getSeasonReward(id);
          return (
            <View key={id} style={styles.rewardRow}>
              <Icon name="checkmark-circle-2" fill={colors.success} size={18} />
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
        <View style={[styles.headStart, { backgroundColor: colors.success + '20' }]}>
          <Icon name="trending-up" fill={colors.success} size={18} />
          <Text style={[styles.headStartText, { color: colors.success }]}>
            {t('seasonSummary.headStart', { xp: record.rewardXp })}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.note, { color: colors.textMuted }]}>{t('seasonSummary.newSeason')}</Text>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  statsBox: {
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  label: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.sm,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.sm,
  },
  section: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.md,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
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
  headStart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  headStartText: {
    flex: 1,
    fontFamily: InterFonts.medium,
    fontSize: FontSize.sm,
  },
  note: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.xs,
    lineHeight: FontSize.xs * 1.5,
  },
});
