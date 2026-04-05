import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { DailyQuest } from '@/types';
import { QUEST_TEMPLATES, DAILY_QUEST_COUNT, DAILY_QUEST_ALL_COMPLETE_BONUS, scaleQuestTarget } from '@/constants/daily-quests';
import { XP_VALUES } from '@/constants/gamification';
import { generateId } from '@/utils/uuid';
import { getDateKey } from '@/utils/date';
import { useGamificationStore } from './gamification-store';
import { useSyncStore } from './sync-store';

interface DailyQuestsStore {
  quests: DailyQuest[];
  lastGeneratedDate: string | null;

  // Actions
  ensureTodayQuests: () => void;
  updateQuestProgress: (questType: string, delta: number) => void;
  getTodayQuests: () => DailyQuest[];
  getCompletedCount: () => number;
}

function pickRandomQuests(count: number, recentAvgs: Map<string, number>): DailyQuest[] {
  const today = getDateKey();
  const shuffled = [...QUEST_TEMPLATES].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, count);

  return picked.map((template) => ({
    id: generateId(),
    date: today,
    questType: template.type,
    questParams: {},
    targetValue: scaleQuestTarget(template, recentAvgs.get(template.type) ?? 0),
    currentValue: 0,
    isCompleted: false,
    xpReward: template.baseXp,
  }));
}

export const useDailyQuestsStore = create<DailyQuestsStore>()(
  persist(
    (set, get) => ({
      quests: [],
      lastGeneratedDate: null,

      ensureTodayQuests: () => {
        const today = getDateKey();
        if (get().lastGeneratedDate === today) return;

        // Generate new quests for today
        // Get recent averages from gamification daily stats for difficulty scaling
        const dailyStats = useGamificationStore.getState().dailyStats;
        const last7 = dailyStats.slice(-7);
        const recentAvgs = new Map<string, number>();
        if (last7.length > 0) {
          recentAvgs.set('complete_pomodoros', last7.reduce((s, d) => s + d.pomodorosCompleted, 0) / last7.length);
          recentAvgs.set('complete_tasks', last7.reduce((s, d) => s + d.tasksCompleted, 0) / last7.length);
          recentAvgs.set('focus_time', last7.reduce((s, d) => s + d.focusTime, 0) / last7.length / 60); // minutes
        }

        const newQuests = pickRandomQuests(DAILY_QUEST_COUNT, recentAvgs);

        // Keep old quests for history, add new ones
        set((state) => ({
          quests: [...state.quests.filter((q) => q.date !== today), ...newQuests].slice(-90), // 30 days * 3 quests
          lastGeneratedDate: today,
        }));

        // Sync new quests
        for (const quest of newQuests) {
          useSyncStore.getState().enqueue('daily_quests', 'insert', {
            id: quest.id,
            date: quest.date,
            quest_type: quest.questType,
            quest_params: quest.questParams,
            target_value: quest.targetValue,
            current_value: quest.currentValue,
            is_completed: quest.isCompleted,
            xp_reward: quest.xpReward,
          });
        }
      },

      updateQuestProgress: (questType, delta) => {
        const today = getDateKey();
        const { quests } = get();
        let justCompleted: DailyQuest | null = null;
        let allCompleted = false;

        const updated = quests.map((quest) => {
          if (quest.date !== today || quest.questType !== questType || quest.isCompleted) return quest;

          const newValue = Math.min(quest.currentValue + delta, quest.targetValue);
          const nowCompleted = newValue >= quest.targetValue;

          const updatedQuest = {
            ...quest,
            currentValue: newValue,
            isCompleted: nowCompleted,
          };

          if (nowCompleted && !quest.isCompleted) {
            justCompleted = updatedQuest;
          }

          return updatedQuest;
        });

        set({ quests: updated });

        // Award XP for completion
        const completed = justCompleted as DailyQuest | null;
        if (completed) {
          useGamificationStore.getState().addXp(XP_VALUES.DAILY_QUEST_COMPLETE);

          // Sync quest update
          useSyncStore.getState().enqueue('daily_quests', 'update', {
            id: completed.id,
            current_value: completed.currentValue,
            is_completed: true,
          });

          // Check if all 3 quests are now complete
          const todayQuests = updated.filter((q) => q.date === today);
          allCompleted = todayQuests.length >= DAILY_QUEST_COUNT &&
            todayQuests.every((q) => q.isCompleted);

          if (allCompleted) {
            useGamificationStore.getState().addXp(DAILY_QUEST_ALL_COMPLETE_BONUS);
            useGamificationStore.getState().updateDailyStats({ dailyQuestsCompleted: 1 });
          }
        } else {
          // Sync progress update for non-completed quest
          const questToSync = updated.find((q) => q.date === today && q.questType === questType);
          if (questToSync) {
            useSyncStore.getState().enqueue('daily_quests', 'update', {
              id: questToSync.id,
              current_value: questToSync.currentValue,
            });
          }
        }
      },

      getTodayQuests: () => {
        const today = getDateKey();
        return get().quests.filter((q) => q.date === today);
      },

      getCompletedCount: () => {
        const today = getDateKey();
        return get().quests.filter((q) => q.date === today && q.isCompleted).length;
      },
    }),
    {
      name: 'daily-quests-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        quests: state.quests,
        lastGeneratedDate: state.lastGeneratedDate,
      }),
    }
  )
);
