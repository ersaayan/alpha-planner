import { Text } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { BorderRadius, Colors, FontSize, GamificationColors, InterFonts, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNow } from '@/hooks/use-now';
import {
  effectiveDailyCombo,
  getDailyComboMultiplier,
  getSessionComboMultiplier,
  liveSessionCombo,
  sessionComboMaxGapMs,
} from '@/constants/combo';
import { useGamificationStore, useSettingsStore } from '@/stores';
import { getDateKey } from '@/utils/date';

/**
 * The combos that apply right now: consecutive focus sessions and consecutive days with
 * both a pomodoro and a task. Shows how to start one when none is active.
 */
export function ComboIndicator() {
  const { t } = useTranslation();
  const colors = Colors[useColorScheme() ?? 'light'];
  const now = useNow(30_000);
  const combo = useGamificationStore((state) => state.combo);
  const longBreak = useSettingsStore((state) => state.pomodoroSettings.longBreakDuration);
  const sessionCombo = liveSessionCombo(combo, now.getTime(), sessionComboMaxGapMs(longBreak));
  const dailyCombo = effectiveDailyCombo(combo, getDateKey(now));
  const status = {
    sessionCombo,
    sessionMultiplier: getSessionComboMultiplier(sessionCombo),
    dailyCombo,
    dailyMultiplier: getDailyComboMultiplier(dailyCombo),
  };

  const chips: { key: string; label: string; detail: string }[] = [];
  if (status.sessionCombo > 0) {
    chips.push({
      key: 'session',
      label: t('combo.session', { count: status.sessionCombo }),
      detail: t('combo.multiplier', { value: status.sessionMultiplier }),
    });
  }
  if (status.dailyCombo > 0) {
    chips.push({
      key: 'daily',
      label: t('combo.daily', { count: status.dailyCombo }),
      detail: t('combo.multiplier', { value: status.dailyMultiplier }),
    });
  }

  const active = chips.length > 0;

  return (
    <View
      style={[styles.container, { backgroundColor: active ? colors.streak + '14' : colors.card, borderColor: colors.cardBorder }]}
      testID="combo-indicator"
      accessible
      accessibilityLabel={active ? chips.map((chip) => `${chip.label}, ${chip.detail}`).join('. ') : t('combo.hint')}
    >
      <View style={[styles.iconBubble, { backgroundColor: GamificationColors.streak + '24' }]}>
        <Icon name="flash" fill={colors.streak} size={18} />
      </View>
      {active ? (
        <View style={styles.chips}>
          {chips.map((chip) => (
            <View key={chip.key} style={[styles.chip, { backgroundColor: colors.card }]}>
              <Text style={[styles.chipLabel, { color: colors.text }]}>{chip.label}</Text>
              <Text style={[styles.chipDetail, { color: colors.streak }]}>{chip.detail}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('combo.hint')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    paddingRight: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.lg,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    flex: 1,
    fontFamily: InterFonts.regular,
    fontSize: FontSize.xs,
    lineHeight: FontSize.xs * 1.45,
  },
  chips: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  chipLabel: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.xs,
  },
  chipDetail: {
    fontFamily: InterFonts.bold,
    fontSize: FontSize.xs,
  },
});
