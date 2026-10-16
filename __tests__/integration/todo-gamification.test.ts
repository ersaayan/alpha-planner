/**
 * Integration tests: Todo Store <-> Gamification Store
 *
 * Tests the cross-store flow: completing a todo triggers gamification XP,
 * achievement checks, daily stats updates, and sync operations.
 *
 * Real stores are used; only external services are mocked (via jest.setup.ts).
 */

import { useGamificationStore } from '@/stores/gamification-store';
import { useTodoStore } from '@/stores/todo-store';
import { useSyncStore } from '@/stores/sync-store';
import { INITIAL_COMBO_STATE, INITIAL_PRESTIGE_STATE, INITIAL_USER_STATS } from '@/types';
import type { Todo } from '@/types';
import { XP_VALUES } from '@/constants/gamification';
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

const TODO_INITIAL = {
  todos: [],
  filter: {},
};

const SYNC_INITIAL = {
  pendingOperations: [],
  lastSyncedAt: null,
  isSyncing: false,
  lastError: null,
};

function addSampleTodo(
  overrides: Partial<Parameters<ReturnType<typeof useTodoStore.getState>['addTodo']>[0]> = {},
): Todo {
  return useTodoStore.getState().addTodo({
    title: 'Integration test todo',
    description: null,
    dueDate: null,
    status: 'pending',
    categoryId: null,
    priority: 'medium',
    estimatedPomodoros: null,
    completedAt: null,
    order: 0, // addTodo assigns the real order
    ...overrides,
  });
}

beforeEach(() => {
  useGamificationStore.setState(GAMIFICATION_INITIAL);
  useTodoStore.setState(TODO_INITIAL);
  useSyncStore.setState(SYNC_INITIAL);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Todo -> Gamification integration', () => {
  it('completing a todo awards task XP to gamification store', () => {
    const todo = addSampleTodo();

    useTodoStore.getState().toggleTodoStatus(todo.id);

    // With 0 daily combo streak, multiplier is 1x -> XP_VALUES.TASK_COMPLETE = 8
    const { stats } = useGamificationStore.getState();
    expect(stats.totalXp).toBeGreaterThanOrEqual(XP_VALUES.TASK_COMPLETE);
  });

  it('completing a todo increments totalTasksCompleted', () => {
    const todo = addSampleTodo();

    expect(useGamificationStore.getState().stats.totalTasksCompleted).toBe(0);

    useTodoStore.getState().toggleTodoStatus(todo.id);

    expect(useGamificationStore.getState().stats.totalTasksCompleted).toBe(1);
  });

  it('completing a todo triggers achievement check', () => {
    const todo = addSampleTodo();

    useTodoStore.getState().toggleTodoStatus(todo.id);

    // After 1 task, the "task_starter" achievement (task_count >= 1) should unlock
    const { unlockedAchievements } = useGamificationStore.getState();
    const taskStarter = unlockedAchievements.find((ua) => ua.achievementId === 'task_starter');
    expect(taskStarter).toBeDefined();
    expect(taskStarter!.unlockedAt).toBeDefined();
  });

  it('completing multiple todos unlocks task_starter achievement', () => {
    // Complete 3 todos and verify the achievement is only unlocked once
    const todos = [addSampleTodo(), addSampleTodo(), addSampleTodo()];
    for (const todo of todos) {
      useTodoStore.getState().toggleTodoStatus(todo.id);
    }

    const { unlockedAchievements, stats } = useGamificationStore.getState();
    const taskStarterEntries = unlockedAchievements.filter((ua) => ua.achievementId === 'task_starter');
    expect(taskStarterEntries).toHaveLength(1);
    expect(stats.totalTasksCompleted).toBe(3);
  });

  it('todo completion enqueues sync operation', () => {
    const todo = addSampleTodo();
    // addTodo already enqueues an insert; clear so we can isolate the update
    useSyncStore.setState({ pendingOperations: [] });

    useTodoStore.getState().toggleTodoStatus(todo.id);

    const { pendingOperations } = useSyncStore.getState();
    // At minimum there should be an update for the todo status change
    const todoSyncOps = pendingOperations.filter((op) => op.table === 'todos');
    expect(todoSyncOps.length).toBeGreaterThanOrEqual(1);
    expect(todoSyncOps.some((op) => op.data.status === 'completed')).toBe(true);
  });

  it('toggling todo to completed awards XP, toggling back does not remove XP', () => {
    const todo = addSampleTodo();

    // Toggle to completed
    useTodoStore.getState().toggleTodoStatus(todo.id);
    const xpAfterComplete = useGamificationStore.getState().stats.totalXp;
    expect(xpAfterComplete).toBeGreaterThan(0);

    // Toggle back to pending
    useTodoStore.getState().toggleTodoStatus(todo.id);
    const xpAfterUncomplete = useGamificationStore.getState().stats.totalXp;

    // XP should NOT decrease (XP is never revoked)
    expect(xpAfterUncomplete).toBe(xpAfterComplete);
  });

  it('subtask completion via toggleSubtask awards subtask XP when all done', () => {
    const todo = addSampleTodo();
    const todoId = todo.id;

    // Add two subtasks
    useTodoStore.getState().addSubtask(todoId, 'Subtask A');
    useTodoStore.getState().addSubtask(todoId, 'Subtask B');

    const subtasks = useTodoStore.getState().todos.find((t) => t.id === todoId)!.subtasks;
    expect(subtasks).toHaveLength(2);

    // Complete the first subtask -> awards SUBTASK XP (3)
    useTodoStore.getState().toggleSubtask(todoId, subtasks[0].id);
    const xpAfterFirst = useGamificationStore.getState().stats.totalXp;
    expect(xpAfterFirst).toBe(3); // subtask XP = 3

    // Complete the second subtask -> awards subtask XP AND triggers task completion
    useTodoStore.getState().toggleSubtask(todoId, subtasks[1].id);
    const xpAfterSecond = useGamificationStore.getState().stats.totalXp;

    // Should be: 3 (first subtask) + 3 (second subtask) + task XP (8) + achievement XP (task_starter = 25)
    expect(xpAfterSecond).toBeGreaterThan(xpAfterFirst);
    // Parent todo should auto-complete
    const updatedTodo = useTodoStore.getState().todos.find((t) => t.id === todoId);
    expect(updatedTodo!.status).toBe('completed');
  });

  it('completing a todo updates daily stats tasksCompleted', () => {
    const todo = addSampleTodo();

    useTodoStore.getState().toggleTodoStatus(todo.id);

    const today = getDateKey();
    const { dailyStats } = useGamificationStore.getState();
    const todayStat = dailyStats.find((ds) => ds.date === today);
    expect(todayStat).toBeDefined();
    expect(todayStat!.tasksCompleted).toBe(1);
  });

  it('updateTodo with status completed also triggers gamification', () => {
    const todo = addSampleTodo();

    useTodoStore.getState().updateTodo(todo.id, { status: 'completed' });

    const { stats } = useGamificationStore.getState();
    expect(stats.totalTasksCompleted).toBe(1);
    expect(stats.totalXp).toBeGreaterThanOrEqual(XP_VALUES.TASK_COMPLETE);
  });
});
