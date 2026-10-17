import { Text } from '@ui-kitten/components';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { CollapsibleCard } from '@/components/common/collapsible-card';
import { DAILY_QUEST_ALL_COMPLETE_BONUS } from '@/constants/daily-quests';
import { Colors, FontSize, InterFonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNow } from '@/hooks/use-now';
import { questDescription, questTitle } from '@/services/gamification/display';
import { useCategoryStore, useDailyQuestsStore } from '@/stores';
import { getDateKey } from '@/utils/date';

import { ProgressRow } from './progress-row';

/** Today's daily quests with their progress (folds to "Daily quests · 1/3"). */
export function DailyQuestsCard() {
  const { t } = useTranslation();
  const colors = Colors[useColorScheme() ?? 'light'];
  const today = getDateKey(useNow());
  const quests = useDailyQuestsStore((state) => state.quests);
  const categories = useCategoryStore((state) => state.categories);

  const todayQuests = useMemo(() => quests.filter((quest) => quest.date === today), [quests, today]);
  if (todayQuests.length === 0) return null;
  const completed = todayQuests.filter((quest) => quest.isCompleted).length;
  const allDone = completed === todayQuests.length;

  return (
    <CollapsibleCard
      id="quests"
      icon="target"
      accent={colors.primary}
      title={t('quests.title')}
      summary={t('quests.progressCount', { completed, total: todayQuests.length })}
      summaryColor={allDone ? colors.success : undefined}
      testID="daily-quests-card"
    >
      {todayQuests.map((quest) => (
        <ProgressRow
          key={quest.id}
          testID={`quest-${quest.questType}`}
          title={questTitle(t, quest)}
          description={questDescription(t, quest, categories)}
          valueLabel={`${Math.floor(quest.currentValue)} / ${quest.targetValue}`}
          progress={quest.targetValue > 0 ? quest.currentValue / quest.targetValue : 0}
          done={quest.isCompleted}
          rewardLabel={t('gamification.xpEarned', { amount: quest.xpReward })}
        />
      ))}
      <Text style={[styles.footer, { color: allDone ? colors.success : colors.textMuted }]}>
        {allDone ? t('quests.allComplete') : t('quests.bonusHint', { xp: DAILY_QUEST_ALL_COMPLETE_BONUS })}
      </Text>
    </CollapsibleCard>
  );
}

const styles = StyleSheet.create({
  footer: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.xs,
  },
});
