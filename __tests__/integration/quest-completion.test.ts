/**
 * Integration tests: Daily Quests Store <-> Gamification Store
 *
 * Tests quest generation, progress tracking, completion rewards,
 * and the all-quests-completed bonus XP flow.
 *
 * Real stores are used; only external services are mocked (via jest.setup.ts).
 */

import { useDailyQuestsStore } from '@/stores/daily-quests-store';
import { useGamificationStore } from '@/stores/gamification-store';
import { useSyncStore } from '@/stores/sync-store';
import { setSyncConfigured } from '../helpers/sync';
import { INITIAL_COMBO_STATE, INITIAL_PRESTIGE_STATE, INITIAL_USER_STATS } from '@/types';
import { XP_VALUES } from '@/constants/gamification';
import { DAILY_QUEST_COUNT, DAILY_QUEST_ALL_COMPLETE_BONUS } from '@/constants/daily-quests';
import { getDateKey } from '@/utils/date';

// ---------------------------------------------------------------------------
// Reset helpers
// ---------------------------------------------------------------------------

const GAMIFICATION_INITIAL = {
  stats: { ...INITIAL_USER_STATS },
  unlockedAchievements: [],
  dailyStats: [],
  pendingNotifications: [],
  combo: { ...INITIAL_COMBO_STATE },
  prestige: { ...INITIAL_PRESTIGE_STATE },
};

const QUESTS_INITIAL = {
  quests: [],
  lastGeneratedDate: null,
};

// Sync configured with a signed-in user, so changes are queued (see __tests__/helpers/sync.ts)
const SYNC_INITIAL = {
  pendingOperations: [],
  lastSyncedAt: null,
  ownerId: 'user-1',
  isSyncing: false,
  lastError: null,
};

beforeAll(() => {
  setSyncConfigured(true);
});

afterAll(() => {
  setSyncConfigured(false);
});

beforeEach(() => {
  useGamificationStore.setState(GAMIFICATION_INITIAL);
  useDailyQuestsStore.setState(QUESTS_INITIAL);
  useSyncStore.setState(SYNC_INITIAL);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Quest -> Gamification integration', () => {
  it('ensureTodayQuests generates exactly 3 quests', () => {
    useDailyQuestsStore.getState().ensureTodayQuests();

    const todayQuests = useDailyQuestsStore.getState().getTodayQuests();
    expect(todayQuests).toHaveLength(DAILY_QUEST_COUNT);

    // Each quest should have a valid structure
    for (const quest of todayQuests) {
      expect(quest.id).toBeDefined();
      expect(quest.date).toBe(getDateKey());
      expect(quest.targetValue).toBeGreaterThan(0);
      expect(quest.currentValue).toBe(0);
      expect(quest.isCompleted).toBe(false);
    }
  });

  it('updateQuestProgress increments quest currentValue', () => {
    useDailyQuestsStore.getState().ensureTodayQuests();

    const questsBefore = useDailyQuestsStore.getState().getTodayQuests();
    const quest = questsBefore[0];

    useDailyQuestsStore.getState().updateQuestProgress(quest.questType, 1);

    const questsAfter = useDailyQuestsStore.getState().getTodayQuests();
    const updatedQuest = questsAfter.find((q) => q.id === quest.id);
    expect(updatedQuest!.currentValue).toBe(1);
  });

  it('completing a quest awards 20 XP', () => {
    useDailyQuestsStore.getState().ensureTodayQuests();
    const quest = useDailyQuestsStore.getState().getTodayQuests()[0];

    const xpBefore = useGamificationStore.getState().stats.totalXp;

    // Complete the quest by setting progress to target value
    useDailyQuestsStore.getState().updateQuestProgress(quest.questType, quest.targetValue);

    const xpAfter = useGamificationStore.getState().stats.totalXp;
    expect(xpAfter - xpBefore).toBe(XP_VALUES.DAILY_QUEST_COMPLETE);

    // Quest should be marked completed
    const updatedQuest = useDailyQuestsStore.getState().getTodayQuests().find((q) => q.id === quest.id);
    expect(updatedQuest!.isCompleted).toBe(true);
  });

  it('completing all 3 quests awards 30 XP bonus', () => {
    useDailyQuestsStore.getState().ensureTodayQuests();
    const quests = useDailyQuestsStore.getState().getTodayQuests();

    const xpBefore = useGamificationStore.getState().stats.totalXp;

    // Complete all 3 quests
    for (const quest of quests) {
      useDailyQuestsStore.getState().updateQuestProgress(quest.questType, quest.targetValue);
    }

    const xpAfter = useGamificationStore.getState().stats.totalXp;

    // Total XP should be: 3 * 20 (individual completions) + 30 (all complete bonus) = 90
    const expectedXp = DAILY_QUEST_COUNT * XP_VALUES.DAILY_QUEST_COMPLETE + DAILY_QUEST_ALL_COMPLETE_BONUS;
    expect(xpAfter - xpBefore).toBe(expectedXp);
  });

  it('quests are not regenerated if already generated today', () => {
    useDailyQuestsStore.getState().ensureTodayQuests();
    const firstGeneration = useDailyQuestsStore.getState().getTodayQuests().map((q) => q.id);

    // Call again - should not regenerate
    useDailyQuestsStore.getState().ensureTodayQuests();
    const secondGeneration = useDailyQuestsStore.getState().getTodayQuests().map((q) => q.id);

    expect(secondGeneration).toEqual(firstGeneration);
  });

  it('quest progress enqueues sync operation', () => {
    useDailyQuestsStore.getState().ensureTodayQuests();
    // Clear sync operations from quest generation
    useSyncStore.setState({ pendingOperations: [] });

    const quest = useDailyQuestsStore.getState().getTodayQuests()[0];
    useDailyQuestsStore.getState().updateQuestProgress(quest.questType, 1);

    const { pendingOperations } = useSyncStore.getState();
    const questSyncOps = pendingOperations.filter((op) => op.table === 'daily_quests');
    expect(questSyncOps.length).toBeGreaterThanOrEqual(1);
  });

  it('completing all quests updates dailyQuestsCompleted in gamification daily stats', () => {
    useDailyQuestsStore.getState().ensureTodayQuests();
    const quests = useDailyQuestsStore.getState().getTodayQuests();

    for (const quest of quests) {
      useDailyQuestsStore.getState().updateQuestProgress(quest.questType, quest.targetValue);
    }

    const today = getDateKey();
    const { dailyStats } = useGamificationStore.getState();
    const todayStat = dailyStats.find((ds) => ds.date === today);
    expect(todayStat).toBeDefined();
    expect(todayStat!.dailyQuestsCompleted).toBeGreaterThanOrEqual(1);
  });
});
