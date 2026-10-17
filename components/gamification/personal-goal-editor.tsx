import { Text } from '@ui-kitten/components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AnimatedButton } from '@/components/animated/animated-button';
import { Chip } from '@/components/common/chip';
import { SheetModal } from '@/components/common/sheet-modal';
import { Icon } from '@/components/icon';
import { PERSONAL_GOAL_LIMITS, PERSONAL_GOAL_XP, getWeeklyGoalTemplate, type WeeklyGoalMetric } from '@/constants/weekly-goals';
import { BorderRadius, Colors, FontSize, InterFonts, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNow } from '@/hooks/use-now';
import { formatGoalValue } from '@/services/gamification/display';
import { useGamificationStore, useWeeklyGoalsStore } from '@/stores';
import { measureMetric } from '@/stores/weekly-goals-store';
import { getDateKey, getWeekKey } from '@/utils/date';

const METRICS: WeeklyGoalMetric[] = ['pomodoros', 'tasks', 'focus_hours', 'streak_days', 'quest_days'];

interface PersonalGoalEditorProps {
  visible: boolean;
  initialMetric?: WeeklyGoalMetric;
  initialTarget?: number;
  onClose: () => void;
}

/** Choose this week's personal goal: a metric and a target ahead of the week so far. */
export function PersonalGoalEditor({ visible, initialMetric = 'pomodoros', initialTarget, onClose }: PersonalGoalEditorProps) {
  const { t } = useTranslation();
  const colors = Colors[useColorScheme() ?? 'light'];
  const dailyStats = useGamificationStore((state) => state.dailyStats);
  const setPersonalGoal = useWeeklyGoalsStore((state) => state.setPersonalGoal);

  const [metric, setMetric] = useState<WeeklyGoalMetric>(initialMetric);
  const [target, setTarget] = useState<number>(initialTarget ?? PERSONAL_GOAL_LIMITS[initialMetric].min * 2);
  const [error, setError] = useState<string | null>(null);

  const now = useNow();
  const progress = measureMetric(metric, dailyStats, getWeekKey(now), getDateKey(now));
  const limits = PERSONAL_GOAL_LIMITS[metric];
  const lowest = Math.max(limits.min, Math.floor(progress) + 1);
  const clamped = Math.min(limits.max, Math.max(lowest, target));

  const chooseMetric = (next: WeeklyGoalMetric) => {
    setMetric(next);
    setTarget(PERSONAL_GOAL_LIMITS[next].min * 2);
    setError(null);
  };

  const save = () => {
    if (setPersonalGoal(metric, clamped)) {
      setError(null);
      onClose();
    } else {
      setError(t('goals.personalRejected', { min: lowest, max: limits.max }));
    }
  };

  return (
    <SheetModal
      visible={visible}
      title={t('goals.setPersonal')}
      icon="flag"
      onClose={onClose}
      footer={
        <>
          <AnimatedButton title={t('common.cancel')} variant="ghost" size="sm" onPress={onClose} />
          <AnimatedButton title={t('common.save')} size="sm" onPress={save} disabled={lowest > limits.max} />
        </>
      }
    >
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        {t('goals.personalHint', { xp: PERSONAL_GOAL_XP })}
      </Text>
      <View style={styles.metrics} accessibilityRole="radiogroup">
        {METRICS.map((m) => {
          const template = getWeeklyGoalTemplate(m);
          return (
            <Chip key={m} label={template ? t(template.nameKey) : m} selected={m === metric} onPress={() => chooseMetric(m)} />
          );
        })}
      </View>

      <View style={[styles.targetBox, { backgroundColor: colors.backgroundSecondary }]}>
        <Text style={[styles.soFar, { color: colors.textMuted }]}>
          {t('goals.soFarThisWeek', { value: formatGoalValue(metric, progress) })}
        </Text>
        <View style={styles.stepper}>
          <Pressable
            onPress={() => setTarget(Math.max(lowest, clamped - 1))}
            style={({ pressed }) => [styles.stepButton, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('goals.decrease')}
            accessibilityState={{ disabled: clamped <= lowest }}
            disabled={clamped <= lowest}
          >
            <Icon name="minus" fill={clamped <= lowest ? colors.textMuted : colors.primary} size={20} />
          </Pressable>
          <Text style={[styles.target, { color: colors.text }]} accessibilityLiveRegion="polite">
            {t(getWeeklyGoalTemplate(metric)?.descriptionKey ?? '', { value: clamped })}
          </Text>
          <Pressable
            onPress={() => setTarget(Math.min(limits.max, clamped + 1))}
            style={({ pressed }) => [styles.stepButton, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('goals.increase')}
            accessibilityState={{ disabled: clamped >= limits.max }}
            disabled={clamped >= limits.max}
          >
            <Icon name="plus" fill={clamped >= limits.max ? colors.textMuted : colors.primary} size={20} />
          </Pressable>
        </View>
      </View>
      {error ? (
        <Text style={[styles.error, { color: colors.error }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.45,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  targetBox: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  soFar: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.xs,
    textAlign: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  target: {
    flex: 1,
    textAlign: 'center',
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.md,
  },
  error: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.sm,
  },
});
