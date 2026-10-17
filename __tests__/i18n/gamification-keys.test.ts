/**
 * The gamification domain is shown through keys built from ids (achievements, levels,
 * quests, goals, season rewards, categories). Every one of them must exist in both
 * languages, or a raw key would appear on screen.
 */
import en from '@/locales/en.json';
import tr from '@/locales/tr.json';
import { ACHIEVEMENTS, LEVELS } from '@/constants/gamification';
import { QUEST_TEMPLATES } from '@/constants/daily-quests';
import { WEEKLY_GOAL_TEMPLATES } from '@/constants/weekly-goals';
import { SEASON_REWARDS } from '@/services/gamification/season';
import { DEFAULT_CATEGORIES } from '@/types';
import { TODO_SORTS } from '@/utils/todo-list';

const has = (key: string) => key in en && key in tr;

it('every generated gamification key exists in en and tr', () => {
  const keys: string[] = [];
  for (const a of ACHIEVEMENTS) {
    keys.push(`achievements.${a.id}.name`, `achievements.${a.id}.desc`, `achievementCategory.${a.category}`, `gamification.rarity.${a.rarity}`);
  }
  for (const level of LEVELS) keys.push(`levels.${level.level}`);
  for (const tier of ['seedling', 'sapling', 'tree', 'forest', 'ancient']) keys.push(`gamification.tier.${tier}`);
  for (const quest of QUEST_TEMPLATES) keys.push(quest.nameKey, quest.descriptionKey);
  for (const goal of WEEKLY_GOAL_TEMPLATES) keys.push(goal.nameKey, goal.descriptionKey);
  for (const reward of SEASON_REWARDS) keys.push(reward.nameKey, reward.hintKey);
  for (const category of DEFAULT_CATEGORIES) keys.push(`categories.default.${category.name.toLowerCase()}`);
  for (const sort of TODO_SORTS) keys.push(`todos.sort.${sort}`);

  expect(keys.filter((key) => !has(key))).toEqual([]);
});

it('Turkish texts are not ASCII-only transliterations', () => {
  // The old daily summary showed "Gunun Ozeti"; Turkish strings must use Turkish letters.
  const suspicious = Object.entries(tr as Record<string, string>).filter(([, value]) =>
    /\b(Gunun|Ozeti|Gorev|gorev|Haftalik|Kazanilan|Dune gore|Kirildi)\b/.test(value)
  );
  expect(suspicious).toEqual([]);
});
