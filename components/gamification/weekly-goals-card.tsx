import { Text } from '@ui-kitten/components';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { AnimatedButton } from '@/components/animated/animated-button';
import { CollapsibleCard } from '@/components/common/collapsible-card';
import { PERSONAL_GOAL_XP, WEEKLY_GOAL_ALL_COMPLETE_BONUS, type WeeklyGoalMetric } from '@/constants/weekly-goals';
import { XP_VALUES } from '@/constants/gamification';
import { Colors, FontSize, InterFonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNow } from '@/hooks/use-now';
import { formatGoalValue, goalDescription, goalMetricOf, goalTitle } from '@/services/gamification/display';
import { useWeeklyGoalsStore } from '@/stores';
import { getWeekKey } from '@/utils/date';

import { PersonalGoalEditor } from './personal-goal-editor';
import { ProgressRow } from './progress-row';

/** This week's goals, and the personal goal the user can set (folds to its header). */
export function WeeklyGoalsCard() {
  const { t } = useTranslation();
  const colors = Colors[useColorScheme() ?? 'light'];
  const weekKey = getWeekKey(useNow());
  const goals = useWeeklyGoalsStore((state) => state.goals);
  const [editorVisible, setEditorVisible] = useState(false);

  const weekGoals = useMemo(() => goals.filter((goal) => goal.weekStart === weekKey), [goals, weekKey]);
  const personal = weekGoals.find((goal) => goal.goalType === 'personal');
  const completed = weekGoals.filter((goal) => goal.isCompleted).length;
  const allDone = weekGoals.length > 0 && completed === weekGoals.length;

  return (
    <CollapsibleCard
      id="goals"
      icon="flag"
      accent={colors.secondary}
      title={t('goals.title')}
      summary={t('quests.progressCount', { completed, total: weekGoals.length })}
      summaryColor={allDone ? colors.success : undefined}
      testID="weekly-goals-card"
    >
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
    </CollapsibleCard>
  );
}

const styles = StyleSheet.create({
  footer: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.xs,
  },
  button: {
    alignSelf: 'flex-start',
  },
});
