import { Text } from '@ui-kitten/components';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { BorderRadius, Colors, FontSize, GamificationColors, InterFonts, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ProgressRowProps {
  title: string;
  description: string;
  /** "2 / 5" */
  valueLabel: string;
  progress: number;
  done: boolean;
  /** "+20 XP" */
  rewardLabel?: string;
  testID?: string;
}

/** One quest or goal: check mark, text, a thin progress bar and its reward. */
export function ProgressRow({ title, description, valueLabel, progress, done, rewardLabel, testID }: ProgressRowProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const percent = `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` as const;

  return (
    <View style={styles.row} testID={testID} accessible accessibilityLabel={`${title}. ${description}. ${valueLabel}`}>
      <Icon
        name={done ? 'checkmark-circle-2' : 'radio-button-off'}
        fill={done ? colors.success : colors.textMuted}
        style={styles.icon}
      />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text }, done && styles.doneText]} numberOfLines={1}>
            {title}
          </Text>
          {rewardLabel ? (
            <Text style={[styles.reward, { color: GamificationColors.levelBadge }]}>{rewardLabel}</Text>
          ) : null}
        </View>
        <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>
        <View style={styles.barRow}>
          <View style={[styles.track, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={[styles.fill, { width: percent, backgroundColor: done ? colors.success : colors.primary }]} />
          </View>
          <Text style={[styles.value, { color: colors.textSecondary }]}>{valueLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  icon: {
    width: 20,
    height: 20,
    marginTop: 2,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    flex: 1,
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.sm,
  },
  doneText: {
    opacity: 0.7,
  },
  reward: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.xs,
  },
  description: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.xs,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 2,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  value: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.xs,
    minWidth: 48,
    textAlign: 'right',
  },
});
