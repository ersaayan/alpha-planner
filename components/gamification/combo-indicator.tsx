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

  return (
    <View style={styles.container} testID="combo-indicator">
      <Icon name="flash" fill={GamificationColors.streak} style={styles.icon} />
      {chips.length === 0 ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>{t('combo.hint')}</Text>
      ) : (
        chips.map((chip) => (
          <View key={chip.key} style={[styles.chip, { backgroundColor: GamificationColors.streak + '20' }]}>
            <Text style={[styles.chipText, { color: GamificationColors.streak }]}>
              {chip.label} · {chip.detail}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  icon: {
    width: 18,
    height: 18,
  },
  hint: {
    flex: 1,
    fontFamily: InterFonts.regular,
    fontSize: FontSize.xs,
  },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  chipText: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.xs,
  },
});
