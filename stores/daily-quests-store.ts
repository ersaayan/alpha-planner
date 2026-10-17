import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DailyQuest } from '@/types';
import {
  DAILY_QUEST_COUNT,
  getQuestTemplate,
  pickQuests,
  type QuestContext,
  type QuestEvent,
} from '@/constants/daily-quests';
import { generateId } from '@/utils/uuid';
import { getDateKey } from '@/utils/date';
import { isPastDue } from '@/utils/todo-dates';
import { useGamificationStore } from './gamification-store';
import { asRecord, asRecordArray, createPersistOptions } from './persist';
import { useSyncStore } from './sync-store';

interface DailyQuestsStore {
  quests: DailyQuest[];
  lastGeneratedDate: string | null;

  // Actions
  /** Generates today's quests once per day. `context` overrides parts of what is read from the other stores. */
  ensureTodayQuests: (context?: Partial<QuestContext>) => void;
  /** Moves the quests of the event's day forward. */
  recordQuestEvent: (event: QuestEvent) => void;
  /** Adds `delta` to the quests of one type on the day of `at` (default: now). */
  updateQuestProgress: (questType: string, delta: number, at?: Date) => void;
  getTodayQuests: () => DailyQuest[];
  getCompletedCount: () => number;
}

/** Days of history kept (3 quests a day). */
const QUEST_HISTORY_LIMIT = 90;

/**
 * Reads what quest generation needs from the other stores. Loaded lazily: the todo and
 * settings stores import the gamification store, which updates quests.
 */
export function buildQuestContext(now: Date = new Date()): QuestContext {
  const { useSettingsStore } = require('./settings-store') as typeof import('./settings-store');
  const { useTodoStore } = require('./todo-store') as typeof import('./todo-store');
  const { pomodoroSettings } = useSettingsStore.getState();

  const openTasks = useTodoStore
    .getState()
    .todos.filter((todo) => todo.status === 'pending' || todo.status === 'in_progress')
    .map((todo) => ({
      priority: todo.priority,
      categoryId: todo.categoryId,
      isOverdue: isPastDue(todo.dueDate, now, todo.dueTime),
      openSubtasks: todo.subtasks.filter((subtask) => !subtask.isCompleted).length,
    }));

  // Averages per calendar day over the 7 days before today.
  const statsByDate = new Map(useGamificationStore.getState().dailyStats.map((ds) => [ds.date, ds]));
  const totals = { pomodoros: 0, tasks: 0, focusMinutes: 0 };
  for (let daysAgo = 1; daysAgo <= 7; daysAgo++) {
    const day = new Date(now);
    day.setDate(day.getDate() - daysAgo);
    const stats = statsByDate.get(getDateKey(day));
    if (!stats) continue;
    totals.pomodoros += stats.pomodorosCompleted;
    totals.tasks += stats.tasksCompleted;
    totals.focusMinutes += stats.focusTime / 60;
  }

  return {
    now,
    focusMinutes: Math.round(pomodoroSettings.focusDuration / 60),
    shortBreakMinutes: Math.round(pomodoroSettings.shortBreakDuration / 60),
    openTasks,
    recent: { pomodoros: totals.pomodoros / 7, tasks: totals.tasks / 7, focusMinutes: totals.focusMinutes / 7 },
    random: Math.random,
  };
}

function syncQuest(quest: DailyQuest): void {
  useSyncStore.getState().enqueue('daily_quests', 'update', {
    id: quest.id,
    current_value: quest.currentValue,
    is_completed: quest.isCompleted,
  });
}

export const useDailyQuestsStore = create<DailyQuestsStore>()(
  persist(
    (set, get) => {
      /**
       * Applies per-quest progress to the quests of one day, then awards XP for the quests
       * it completed (and the bonus when that finishes the day's set).
       */
      const advance = (
        dateKey: string,
        at: Date,
        progressOf: (quest: DailyQuest) => number | 'reset'
      ) => {
        const changed: DailyQuest[] = [];
        const completed: DailyQuest[] = [];

        const quests = get().quests.map((quest) => {
          if (quest.date !== dateKey || quest.isCompleted) return quest;
          const delta = progressOf(quest);
          let next: DailyQuest;
          if (delta === 'reset') {
            if (quest.currentValue === 0) return quest;
            next = { ...quest, currentValue: 0 };
          } else {
            if (!(delta > 0)) return quest;
            const currentValue = Math.min(quest.currentValue + delta, quest.targetValue);
            next = { ...quest, currentValue, isCompleted: currentValue >= quest.targetValue };
            if (next.isCompleted) completed.push(next);
          }
          changed.push(next);
          return next;
        });

        if (changed.length === 0) return;
        set({ quests });
        changed.forEach(syncQuest);

        if (completed.length === 0) return;
        const dayQuests = quests.filter((quest) => quest.date === dateKey);
        const finishedTheDay = dayQuests.length > 0 && dayQuests.every((quest) => quest.isCompleted);
        const gamification = useGamificationStore.getState();
        completed.forEach((quest, index) => {
          gamification.addXp(quest.xpReward, at);
          gamification.recordQuestCompleted(at, finishedTheDay && index === completed.length - 1);
        });
      };

      return {
        quests: [],
        lastGeneratedDate: null,

        ensureTodayQuests: (overrides) => {
          const context = { ...buildQuestContext(overrides?.now), ...overrides };
          const today = getDateKey(context.now);
          if (get().lastGeneratedDate === today) return;
          // Quests for today may already exist (e.g. restored from a backup).
          if (get().quests.some((quest) => quest.date === today)) {
            set({ lastGeneratedDate: today });
            return;
          }

          const newQuests: DailyQuest[] = pickQuests(context, DAILY_QUEST_COUNT).map(({ template, plan }) => ({
            id: generateId(),
            date: today,
            questType: template.type,
            questParams: plan.params ?? {},
            targetValue: plan.targetValue,
            currentValue: 0,
            isCompleted: false,
            xpReward: template.baseXp,
          }));

          // Keep old quests for history, add new ones
          set((state) => ({
            quests: [...state.quests.filter((q) => q.date !== today), ...newQuests].slice(-QUEST_HISTORY_LIMIT),
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

        recordQuestEvent: (event) => {
          advance(getDateKey(event.at), event.at, (quest) => {
            const template = getQuestTemplate(quest.questType);
            return template ? template.progress(quest, event) : 0;
          });
        },

        updateQuestProgress: (questType, delta, at = new Date()) => {
          advance(getDateKey(at), at, (quest) => (quest.questType === questType ? delta : 0));
        },

        getTodayQuests: () => {
          const today = getDateKey();
          return get().quests.filter((q) => q.date === today);
        },

        getCompletedCount: () => {
          const today = getDateKey();
          return get().quests.filter((q) => q.date === today && q.isCompleted).length;
        },
      };
    },
    createPersistOptions<DailyQuestsStore, Pick<DailyQuestsStore, 'quests' | 'lastGeneratedDate'>>({
      name: 'daily-quests-store',
      // v2: start_early / long_focus keep their hour / minutes in questParams, and
      // uninterrupted_focus counts sessions instead of minutes.
      version: 2,
      partialize: (state) => ({
        quests: state.quests,
        lastGeneratedDate: state.lastGeneratedDate,
      }),
      migrate: migrateDailyQuestsState,
    })
  )
);

/** v0 (unversioned) → v1: same shape, with malformed entries dropped. v1 → v2: see upgradeQuestV1. */
export function migrateDailyQuestsState(persisted: unknown, fromVersion: number) {
  const state = asRecord(persisted);
  const quests = asRecordArray(state.quests).filter((item) => typeof item.id === 'string');
  return {
    quests: fromVersion < 2 ? quests.map(upgradeQuestV1) : quests,
    lastGeneratedDate: typeof state.lastGeneratedDate === 'string' ? state.lastGeneratedDate : null,
  };
}

/** Quests made by v1 stored an hour or a number of minutes as their target. */
function upgradeQuestV1(quest: Record<string, unknown>): Record<string, unknown> {
  const params = asRecord(quest.questParams);
  const target = Number(quest.targetValue);
  const done = quest.isCompleted === true;
  const asSingleStep = (extra: Record<string, unknown>) => ({
    ...quest,
    questParams: { ...extra, ...params },
    targetValue: 1,
    currentValue: done ? 1 : 0,
  });
  switch (quest.questType) {
    case 'start_early':
      return asSingleStep({ beforeHour: Number.isFinite(target) ? target : 9 });
    case 'long_focus':
      return asSingleStep({ minutes: Number.isFinite(target) ? target : 45 });
    case 'uninterrupted_focus':
      return asSingleStep({});
    default:
      return quest;
  }
}
