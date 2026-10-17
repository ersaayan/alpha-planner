import type { TFunction } from 'i18next';
import { getLevelTierId, getLevelTitle } from '@/constants/gamification';
import { getQuestTemplate } from '@/constants/daily-quests';
import { getWeeklyGoalTemplate } from '@/constants/weekly-goals';
import type { Achievement, Category, DailyQuest, WeeklyGoal } from '@/types';

/**
 * Translated labels for the gamification domain. The constants keep English names for
 * tests and logs; screens show these.
 */

export function levelTitle(t: TFunction, level: number): string {
  return t(`levels.${level}`, { defaultValue: getLevelTitle(level) });
}

export function levelTierName(t: TFunction, level: number): string {
  return t(`gamification.tier.${getLevelTierId(level)}`);
}

export function achievementName(t: TFunction, achievement: Pick<Achievement, 'id' | 'name'>): string {
  return t(`achievements.${achievement.id}.name`, { defaultValue: achievement.name });
}

export function achievementDescription(t: TFunction, achievement: Pick<Achievement, 'id' | 'description'>): string {
  return t(`achievements.${achievement.id}.desc`, { defaultValue: achievement.description });
}

export function rarityName(t: TFunction, rarity: Achievement['rarity']): string {
  return t(`gamification.rarity.${rarity}`);
}

/**
 * Display name of a category: the translated name for an unchanged default category,
 * otherwise the user's own name.
 */
export function categoryName(t: TFunction, category: Pick<Category, 'name' | 'isDefault'> | null | undefined): string {
  if (!category) return '';
  if (category.isDefault) {
    const key = `categories.default.${category.name.toLowerCase()}`;
    const translated = t(key, { defaultValue: '' });
    if (translated) return translated;
  }
  return category.name;
}

export function questTitle(t: TFunction, quest: DailyQuest): string {
  const template = getQuestTemplate(quest.questType);
  return template ? t(template.nameKey) : quest.questType;
}

/** The quest's goal in words, e.g. "Complete 3 tasks in Work". */
export function questDescription(t: TFunction, quest: DailyQuest, categories: Category[] = []): string {
  const template = getQuestTemplate(quest.questType);
  if (!template) return '';
  const params = quest.questParams ?? {};
  switch (quest.questType) {
    case 'start_early':
      return t(template.descriptionKey, { time: `${String(params.beforeHour ?? 9).padStart(2, '0')}:00` });
    case 'long_focus':
      return t(template.descriptionKey, { value: params.minutes ?? quest.targetValue });
    case 'complete_in_category': {
      const category = categories.find((c) => c.id === params.categoryId);
      if (!category) return t('quests.in_category_any_desc', { value: quest.targetValue });
      return t(template.descriptionKey, { value: quest.targetValue, category: categoryName(t, category) });
    }
    default:
      return t(template.descriptionKey, { value: quest.targetValue });
  }
}

export function goalMetricOf(goal: WeeklyGoal): string {
  return String((goal.goalParams as { metric?: unknown }).metric ?? '');
}

export function goalTitle(t: TFunction, goal: WeeklyGoal): string {
  const template = getWeeklyGoalTemplate(goalMetricOf(goal));
  return template ? t(template.nameKey) : goalMetricOf(goal);
}

/** Hours with one decimal, other metrics as whole numbers. */
export function formatGoalValue(metric: string, value: number): string {
  if (metric === 'focus_hours') return String(Math.round(value * 10) / 10);
  return String(Math.floor(value));
}

export function goalDescription(t: TFunction, goal: WeeklyGoal): string {
  const metric = goalMetricOf(goal);
  const template = getWeeklyGoalTemplate(metric);
  return template ? t(template.descriptionKey, { value: formatGoalValue(metric, goal.targetValue) }) : '';
}
