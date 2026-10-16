import { applyPrestigeWithRewards } from '@/services/gamification/prestige-service';
import { useCategoryStore } from '@/stores/category-store';
import { useDailyQuestsStore } from '@/stores/daily-quests-store';
import { useWeeklyGoalsStore } from '@/stores/weekly-goals-store';

/**
 * Work that writes default or generated data. Must only run after the stores it
 * touches have hydrated (see stores/hydration.ts), or it could overwrite stored data.
 */

/** Tasks that depend on the current date: run at launch, on resume and when the day changes. */
export function runDateDependentTasks(): void {
  // Month change → prestige reset with rewards
  try {
    applyPrestigeWithRewards();
  } catch (error) {
    console.warn('[startup] Prestige check failed', error);
  }
  // Today's quests and this week's goals (no-ops when already generated)
  try {
    useDailyQuestsStore.getState().ensureTodayQuests();
  } catch (error) {
    console.warn('[startup] Daily quest generation failed', error);
  }
  try {
    useWeeklyGoalsStore.getState().ensureThisWeekGoals();
  } catch (error) {
    console.warn('[startup] Weekly goal generation failed', error);
  }
}

/** First-launch defaults plus the date-dependent tasks. */
export function runStartupTasks(): void {
  useCategoryStore.getState().initializeCategories();
  runDateDependentTasks();
}
