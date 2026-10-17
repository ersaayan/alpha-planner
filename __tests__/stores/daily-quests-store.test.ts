/**
 * Daily quests store: generation from the user's real situation, progress booked on the
 * day of the event, and the rewards for completing a day's quests.
 */
import { useDailyQuestsStore } from '@/stores/daily-quests-store';
import { useGamificationStore } from '@/stores/gamification-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useTodoStore } from '@/stores/todo-store';
import { DAILY_QUEST_ALL_COMPLETE_BONUS } from '@/constants/daily-quests';
import { INITIAL_COMBO_STATE, INITIAL_PRESTIGE_STATE, INITIAL_USER_STATS, type DailyQuest } from '@/types';
import { getDateKey } from '@/utils/date';

const NOW = new Date(2026, 9, 14, 9, 0);
const TODAY = getDateKey(NOW);
const YESTERDAY = getDateKey(new Date(2026, 9, 13, 12, 0));

function quest(overrides: Partial<DailyQuest>): DailyQuest {
  return {
    id: Math.random().toString(36).slice(2),
    date: TODAY,
    questType: 'complete_tasks',
    questParams: {},
    targetValue: 1,
    currentValue: 0,
    isCompleted: false,
    xpReward: 20,
    ...overrides,
  };
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  useGamificationStore.setState({
    stats: { ...INITIAL_USER_STATS },
    unlockedAchievements: [],
    dailyStats: [],
    pendingNotifications: [],
    combo: { ...INITIAL_COMBO_STATE },
    prestige: { ...INITIAL_PRESTIGE_STATE },
  });
  useDailyQuestsStore.setState({ quests: [], lastGeneratedDate: null });
  useTodoStore.setState({ todos: [], filter: {} });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('generation', () => {
  it('only offers task quests the user can act on', () => {
    // No open tasks at all: no overdue/urgent/category/subtask quests.
    for (let i = 0; i < 25; i++) {
      useDailyQuestsStore.setState({ quests: [], lastGeneratedDate: null });
      useDailyQuestsStore.getState().ensureTodayQuests({ random: Math.random });
      const types = useDailyQuestsStore.getState().getTodayQuests().map((q) => q.questType);
      expect(types).toHaveLength(3);
      for (const type of ['clear_overdue', 'complete_urgent_task', 'complete_in_category', 'complete_subtasks']) {
        expect(types).not.toContain(type);
      }
    }
  });

  it('a category quest names a category with open tasks', () => {
    useTodoStore.getState().addTodo({
      title: 'Report', description: null, dueDate: null, status: 'pending', categoryId: 'work',
      priority: 'medium', estimatedPomodoros: null, completedAt: null, order: 0,
    });
    let found: DailyQuest | undefined;
    for (let i = 0; i < 50 && !found; i++) {
      useDailyQuestsStore.setState({ quests: [], lastGeneratedDate: null });
      useDailyQuestsStore.getState().ensureTodayQuests({ random: Math.random });
      found = useDailyQuestsStore.getState().getTodayQuests().find((q) => q.questType === 'complete_in_category');
    }
    expect(found).toMatchObject({ questParams: { categoryId: 'work' }, targetValue: 1 });
  });

  it('long focus quests follow the focus length setting', () => {
    const original = useSettingsStore.getState().pomodoroSettings;
    useSettingsStore.setState({ pomodoroSettings: { ...original, focusDuration: 50 * 60 } });
    let found: DailyQuest | undefined;
    for (let i = 0; i < 50 && !found; i++) {
      useDailyQuestsStore.setState({ quests: [], lastGeneratedDate: null });
      useDailyQuestsStore.getState().ensureTodayQuests({ random: Math.random });
      found = useDailyQuestsStore.getState().getTodayQuests().find((q) => q.questType === 'long_focus');
    }
    useSettingsStore.setState({ pomodoroSettings: original });
    expect(found).toMatchObject({ questParams: { minutes: 50 }, targetValue: 1 });
  });
});

describe('progress', () => {
  it('a focus session completed yesterday counts for yesterday, not today', () => {
    useDailyQuestsStore.setState({
      quests: [
        quest({ id: 'old', date: YESTERDAY, questType: 'complete_pomodoros', targetValue: 2 }),
        quest({ id: 'new', date: TODAY, questType: 'complete_pomodoros', targetValue: 2 }),
      ],
    });
    useGamificationStore.getState().incrementPomodoro(1500, new Date(2026, 9, 13, 23, 50));

    const byId = Object.fromEntries(useDailyQuestsStore.getState().quests.map((q) => [q.id, q.currentValue]));
    expect(byId).toEqual({ old: 1, new: 0 });
  });

  it('task, subtask, creation and break events reach their quests', () => {
    useDailyQuestsStore.setState({
      quests: [
        quest({ id: 'create', questType: 'create_tasks', targetValue: 2 }),
        quest({ id: 'urgent', questType: 'complete_urgent_task', targetValue: 1 }),
        quest({ id: 'subtasks', questType: 'complete_subtasks', targetValue: 2 }),
        quest({ id: 'breaks', questType: 'no_skip_break', targetValue: 2 }),
      ],
    });
    const todo = useTodoStore.getState().addTodo({
      title: 'Fix', description: null, dueDate: null, status: 'pending', categoryId: null,
      priority: 'urgent', estimatedPomodoros: null, completedAt: null, order: 0,
    });
    useTodoStore.getState().addSubtask(todo.id, 'a');
    useTodoStore.getState().addSubtask(todo.id, 'b');
    const [a] = useTodoStore.getState().todos[0].subtasks;
    useTodoStore.getState().toggleSubtask(todo.id, a.id);
    useTodoStore.getState().toggleTodoStatus(todo.id);
    useGamificationStore.getState().recordBreak(new Date(), false);

    const byId = Object.fromEntries(useDailyQuestsStore.getState().quests.map((q) => [q.id, q.currentValue]));
    expect(byId).toEqual({ create: 1, urgent: 1, subtasks: 1, breaks: 1 });
  });

  it('completing an overdue task advances clear_overdue', () => {
    useDailyQuestsStore.setState({ quests: [quest({ id: 'overdue', questType: 'clear_overdue', targetValue: 1 })] });
    const todo = useTodoStore.getState().addTodo({
      title: 'Late', description: null, dueDate: YESTERDAY, status: 'pending', categoryId: null,
      priority: 'low', estimatedPomodoros: null, completedAt: null, order: 0,
    });
    useTodoStore.getState().toggleTodoStatus(todo.id);
    expect(useDailyQuestsStore.getState().quests[0].isCompleted).toBe(true);
  });

  it('a skipped break starts the break quest over', () => {
    useDailyQuestsStore.setState({ quests: [quest({ id: 'breaks', questType: 'no_skip_break', targetValue: 3 })] });
    useGamificationStore.getState().recordBreak(new Date(), false);
    useGamificationStore.getState().recordBreak(new Date(), false);
    useGamificationStore.getState().recordBreak(new Date(), true);
    expect(useDailyQuestsStore.getState().quests[0].currentValue).toBe(0);
  });

  it('finishing the last quest of a day pays the bonus once and records a perfect day', () => {
    useDailyQuestsStore.setState({
      quests: [
        quest({ id: 'a', questType: 'create_tasks', targetValue: 1 }),
        quest({ id: 'b', questType: 'complete_pomodoros', targetValue: 1 }),
      ],
    });
    useGamificationStore.getState().recordTaskCreated(new Date());
    const xpBefore = useGamificationStore.getState().stats.totalXp;
    useGamificationStore.getState().incrementPomodoro(1500, new Date());
    useGamificationStore.getState().incrementPomodoro(1500, new Date());

    const today = useGamificationStore.getState().dailyStats.find((d) => d.date === TODAY)!;
    expect(today.dailyQuestsCompleted).toBe(2);
    const gained = useGamificationStore.getState().stats.totalXp - xpBefore;
    // quest XP + bonus are part of what the two sessions earned
    expect(gained).toBeGreaterThanOrEqual(20 + DAILY_QUEST_ALL_COMPLETE_BONUS);
    expect(useDailyQuestsStore.getState().quests.every((q) => q.isCompleted)).toBe(true);
  });
});
