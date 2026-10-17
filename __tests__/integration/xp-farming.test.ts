/**
 * Rewards are paid once per todo and once per subtask, however often they are toggled,
 * archived or restored. Inflated counts must not reach stats, quests, goals or the streak.
 */
import { ACHIEVEMENTS, XP_VALUES } from '@/constants/gamification';
import { useDailyQuestsStore } from '@/stores/daily-quests-store';
import { useGamificationStore } from '@/stores/gamification-store';
import { migrateTodoState, useTodoStore } from '@/stores/todo-store';
import { useWeeklyGoalsStore } from '@/stores/weekly-goals-store';
import { INITIAL_COMBO_STATE, INITIAL_PRESTIGE_STATE, INITIAL_USER_STATS, type Todo } from '@/types';
import { addDaysToKey, getDateKey } from '@/utils/date';

const NOW = new Date(2026, 9, 14, 10, 0);
const TODAY = getDateKey(NOW);

function addTodo(overrides: Partial<Todo> = {}): Todo {
  return useTodoStore.getState().addTodo({
    title: 'Task',
    description: null,
    dueDate: null,
    status: 'pending',
    categoryId: null,
    priority: 'medium',
    estimatedPomodoros: null,
    completedAt: null,
    order: 0,
    ...overrides,
  });
}

const todo = (id: string) => useTodoStore.getState().todos.find((t) => t.id === id)!;
const stats = () => useGamificationStore.getState().stats;
const today = () => useGamificationStore.getState().dailyStats.find((d) => d.date === TODAY);

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  useGamificationStore.setState({
    stats: { ...INITIAL_USER_STATS },
    // Achievements would add their own XP; this suite measures task rewards only.
    unlockedAchievements: ACHIEVEMENTS.map((a) => ({ achievementId: a.id, unlockedAt: '', notified: true })),
    dailyStats: [],
    pendingNotifications: [],
    combo: { ...INITIAL_COMBO_STATE },
    prestige: { ...INITIAL_PRESTIGE_STATE },
  });
  useTodoStore.setState({ todos: [], filter: {} });
  useDailyQuestsStore.setState({
    quests: [
      { id: 'q', date: TODAY, questType: 'complete_tasks', questParams: {}, targetValue: 5, currentValue: 0, isCompleted: false, xpReward: 20 },
    ],
    lastGeneratedDate: TODAY,
  });
  useWeeklyGoalsStore.setState({ goals: [], lastGeneratedWeek: null });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('a todo is rewarded once', () => {
  it('50 complete/uncomplete toggles pay XP, count and quest progress once', () => {
    const { id } = addTodo();
    useTodoStore.getState().toggleTodoStatus(id);
    const xpAfterFirst = stats().totalXp;

    for (let i = 0; i < 50; i++) useTodoStore.getState().toggleTodoStatus(id);

    expect(todo(id).status).toBe('completed');
    expect(stats().totalXp).toBe(xpAfterFirst);
    expect(stats().totalTasksCompleted).toBe(1);
    expect(today()!.tasksCompleted).toBe(1);
    expect(useDailyQuestsStore.getState().quests[0].currentValue).toBe(1);
  });

  it('Done → Archived → Done keeps completedAt and pays nothing extra', () => {
    const { id } = addTodo();
    useTodoStore.getState().updateTodo(id, { status: 'completed' });
    const completedAt = todo(id).completedAt;
    const xp = stats().totalXp;

    jest.setSystemTime(new Date(2026, 9, 14, 12, 0));
    useTodoStore.getState().updateTodo(id, { status: 'archived' });
    expect(todo(id).completedAt).toBe(completedAt);

    useTodoStore.getState().updateTodo(id, { status: 'completed' });
    expect(todo(id).completedAt).toBe(completedAt);
    expect(stats().totalXp).toBe(xp);
    expect(stats().totalTasksCompleted).toBe(1);
  });

  it('reopening clears completedAt; callers cannot set the reward fields', () => {
    const { id } = addTodo();
    useTodoStore.getState().updateTodo(id, { status: 'completed' });
    useTodoStore.getState().updateTodo(id, { status: 'pending', xpAwardedAt: null, completedAt: 'x' });
    expect(todo(id).completedAt).toBeNull();
    expect(todo(id).xpAwardedAt).toBeTruthy();
  });

  it('unchecking an in-progress todo puts it back in progress', () => {
    const { id } = addTodo({ status: 'in_progress' });
    useTodoStore.getState().toggleTodoStatus(id);
    expect(todo(id).status).toBe('completed');
    useTodoStore.getState().toggleTodoStatus(id);
    expect(todo(id).status).toBe('in_progress');
  });
});

describe('a subtask is rewarded once', () => {
  it('toggling a subtask repeatedly pays SUBTASK_COMPLETE once', () => {
    const { id } = addTodo();
    useTodoStore.getState().addSubtask(id, 'a');
    useTodoStore.getState().addSubtask(id, 'b');
    const [a] = todo(id).subtasks;

    for (let i = 0; i < 21; i++) useTodoStore.getState().toggleSubtask(id, a.id);

    expect(todo(id).subtasks[0].isCompleted).toBe(true);
    expect(stats().totalXp).toBe(XP_VALUES.SUBTASK_COMPLETE);
    expect(today()!.subtasksCompleted).toBe(1);
  });

  it('the parent completed through its subtasks is paid once, and reopens to its old status', () => {
    const { id } = addTodo({ status: 'in_progress' });
    useTodoStore.getState().addSubtask(id, 'only');
    const [only] = todo(id).subtasks;

    useTodoStore.getState().toggleSubtask(id, only.id);
    expect(todo(id).status).toBe('completed');
    useTodoStore.getState().toggleSubtask(id, only.id);
    expect(todo(id).status).toBe('in_progress');
    useTodoStore.getState().toggleSubtask(id, only.id);

    expect(stats().totalTasksCompleted).toBe(1);
    expect(stats().totalXp).toBe(XP_VALUES.SUBTASK_COMPLETE + XP_VALUES.TASK_COMPLETE);
  });

  it('an archived todo is not reopened or completed by its subtasks', () => {
    const { id } = addTodo();
    useTodoStore.getState().addSubtask(id, 'a');
    useTodoStore.getState().addSubtask(id, 'b');
    useTodoStore.getState().updateTodo(id, { status: 'archived' });
    const [a, b] = todo(id).subtasks;
    useTodoStore.getState().toggleSubtask(id, a.id);
    useTodoStore.getState().deleteSubtask(id, b.id);
    expect(todo(id).status).toBe('archived');
  });
});

describe('the daily combo multiplier', () => {
  it('applies to subtask XP while the combo is alive', () => {
    useGamificationStore.setState({ combo: { sessionCombo: 0, dailyComboStreak: 3, lastDailyComboDate: addDaysToKey(TODAY, -1) } });
    const { id } = addTodo();
    useTodoStore.getState().addSubtask(id, 'a');
    useTodoStore.getState().addSubtask(id, 'b');
    useTodoStore.getState().toggleSubtask(id, todo(id).subtasks[0].id);
    expect(stats().totalXp).toBe(Math.round(XP_VALUES.SUBTASK_COMPLETE * 1.5));
  });

  it('no longer applies after a day without a combo', () => {
    useGamificationStore.setState({ combo: { sessionCombo: 0, dailyComboStreak: 7, lastDailyComboDate: addDaysToKey(TODAY, -2) } });
    const { id } = addTodo();
    useTodoStore.getState().toggleTodoStatus(id);
    // Base task XP, not multiplied.
    expect(stats().totalXp).toBe(XP_VALUES.TASK_COMPLETE);
    expect(today()!.xpEarned).toBe(XP_VALUES.TASK_COMPLETE);
  });
});

describe('todo store v1 → v2 migration', () => {
  it('marks completed and archived todos and completed subtasks as already rewarded', () => {
    const base = { title: 't', updatedAt: '2026-10-01T10:00:00.000Z', createdAt: '2026-09-01T10:00:00.000Z' };
    const { todos } = migrateTodoState(
      {
        todos: [
          { ...base, id: 'done', status: 'completed', completedAt: '2026-10-01T09:00:00.000Z' },
          { ...base, id: 'archived', status: 'archived', completedAt: null },
          {
            ...base,
            id: 'open',
            status: 'pending',
            subtasks: [
              { id: 's1', todoId: 'open', title: 'x', isCompleted: true, order: 0, createdAt: '2026-09-02T00:00:00.000Z' },
              { id: 's2', todoId: 'open', title: 'y', isCompleted: false, order: 1, createdAt: '2026-09-02T00:00:00.000Z' },
            ],
          },
        ],
      },
      1
    );
    expect(todos[0].xpAwardedAt).toBe('2026-10-01T09:00:00.000Z');
    expect(todos[1].xpAwardedAt).toBe(base.updatedAt);
    expect(todos[2].xpAwardedAt).toBeNull();
    expect(todos[2].subtasks[0].xpAwardedAt).toBe('2026-09-02T00:00:00.000Z');
    expect(todos[2].subtasks[1].xpAwardedAt).toBeUndefined();
  });
});
