import { Text } from '@ui-kitten/components';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AnimatedButton } from '@/components/animated/animated-button';
import { AnimatedCard } from '@/components/animated/animated-card';
import { PERSONAL_GOAL_XP, WEEKLY_GOAL_ALL_COMPLETE_BONUS, type WeeklyGoalMetric } from '@/constants/weekly-goals';
import { XP_VALUES } from '@/constants/gamification';
import { Colors, FontSize, InterFonts, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNow } from '@/hooks/use-now';
import { formatGoalValue, goalDescription, goalMetricOf, goalTitle } from '@/services/gamification/display';
import { useWeeklyGoalsStore } from '@/stores';
import { getWeekKey } from '@/utils/date';

import { PersonalGoalEditor } from './personal-goal-editor';
import { ProgressRow } from './progress-row';

/** This week's goals, and the personal goal the user can set. */
export function WeeklyGoalsCard() {
  const { t } = useTranslation();
  const colors = Colors[useColorScheme() ?? 'light'];
  const weekKey = getWeekKey(useNow());
  const goals = useWeeklyGoalsStore((state) => state.goals);
  const [editorVisible, setEditorVisible] = useState(false);

  const weekGoals = useMemo(() => goals.filter((goal) => goal.weekStart === weekKey), [goals, weekKey]);
  const personal = weekGoals.find((goal) => goal.goalType === 'personal');
  const allDone = weekGoals.length > 0 && weekGoals.every((goal) => goal.isCompleted);

  return (
    <AnimatedCard variant="default" style={styles.card} contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {t('goals.title')}
        </Text>
        <Text style={[styles.count, { color: allDone ? colors.success : colors.textSecondary }]}>
          {t('quests.progressCount', { completed: weekGoals.filter((g) => g.isCompleted).length, total: weekGoals.length })}
        </Text>
      </View>

      {weekGoals.map((goal) => {
        const metric = goalMetricOf(goal);
        const title = goal.goalType === 'personal' ? `${t('goals.personal')} · ${goalTitle(t, goal)}` : goalTitle(t, goal);
        return (
          <ProgressRow
            key={goal.id}
            testID={`goal-${goal.goalType}-${metric}`}
            title={title}
            description={goalDescription(t, goal)}
            valueLabel={`${formatGoalValue(metric, goal.currentValue)} / ${formatGoalValue(metric, goal.targetValue)}`}
            progress={goal.targetValue > 0 ? goal.currentValue / goal.targetValue : 0}
            done={goal.isCompleted}
            rewardLabel={t('gamification.xpEarned', {
              amount: goal.goalType === 'personal' ? PERSONAL_GOAL_XP : XP_VALUES.WEEKLY_GOAL_COMPLETE,
            })}
          />
        );
      })}

      <Text style={[styles.footer, { color: allDone ? colors.success : colors.textMuted }]}>
        {allDone ? t('goals.allComplete') : t('goals.bonusHint', { xp: WEEKLY_GOAL_ALL_COMPLETE_BONUS })}
      </Text>

      {!personal?.isCompleted && (
        <AnimatedButton
          title={personal ? t('goals.editPersonal') : t('goals.setPersonal')}
          icon={personal ? 'edit' : 'plus'}
          variant="outline"
          size="sm"
          onPress={() => setEditorVisible(true)}
          style={styles.button}
        />
      )}

      {editorVisible && (
        <PersonalGoalEditor
          visible
          initialMetric={personal ? (goalMetricOf(personal) as WeeklyGoalMetric) : undefined}
          initialTarget={personal?.targetValue}
          onClose={() => setEditorVisible(false)}
        />
      )}
    </AnimatedCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.lg,
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  title: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.md,
  },
  count: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.sm,
  },
  footer: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
  button: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
  },
});
