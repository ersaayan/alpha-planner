jest.mock('@/stores/gamification-store', () => ({
  useGamificationStore: {
    getState: () => ({
      incrementTaskCompleted: jest.fn(),
      addXp: jest.fn(),
    }),
  },
}));

jest.mock('@/stores/sync-store', () => ({
  useSyncStore: {
    getState: () => ({
      enqueue: jest.fn(),
    }),
  },
}));

import { useTodoStore } from '@/stores/todo-store';
import type { Todo } from '@/types';

const INITIAL_STATE = {
  todos: [],
  filter: {},
};

beforeEach(() => {
  useTodoStore.setState(INITIAL_STATE);
});

// ── Helpers ────────────────────────────────────────────────────────────

function addSampleTodo(overrides: Partial<Parameters<ReturnType<typeof useTodoStore.getState>['addTodo']>[0]> = {}): Todo {
  return useTodoStore.getState().addTodo({
    title: 'Test todo',
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

// ── Tests ──────────────────────────────────────────────────────────────

describe('useTodoStore', () => {
  // ── addTodo ────────────────────────────────────────────────────────

  it('addTodo: creates a todo with generated id and timestamps', () => {
    const todo = addSampleTodo({ title: 'Buy groceries' });

    expect(todo.id).toBeDefined();
    expect(todo.title).toBe('Buy groceries');
    expect(todo.subtasks).toEqual([]);
    expect(todo.pomodoroSessions).toBe(0);
    expect(todo.createdAt).toBeDefined();
    expect(todo.updatedAt).toBeDefined();

    const { todos } = useTodoStore.getState();
    expect(todos).toHaveLength(1);
    expect(todos[0].id).toBe(todo.id);
  });

  it('addTodo: assigns order based on array length', () => {
    addSampleTodo({ title: 'First' });
    const second = addSampleTodo({ title: 'Second' });

    expect(second.order).toBe(1);
  });

  // ── updateTodo ─────────────────────────────────────────────────────

  it('updateTodo: updates specified fields and sets updatedAt', () => {
    const todo = addSampleTodo();

    // Force an earlier updatedAt so the comparison is reliable
    useTodoStore.setState((state) => ({
      todos: state.todos.map((t) =>
        t.id === todo.id ? { ...t, updatedAt: '2020-01-01T00:00:00.000Z' } : t
      ),
    }));

    useTodoStore.getState().updateTodo(todo.id, { title: 'Updated title', priority: 'high' });

    const updated = useTodoStore.getState().todos[0];
    expect(updated.title).toBe('Updated title');
    expect(updated.priority).toBe('high');
    expect(updated.updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
  });

  it('updateTodo: sets completedAt when status changes to completed', () => {
    const todo = addSampleTodo({ status: 'pending' });

    useTodoStore.getState().updateTodo(todo.id, { status: 'completed' });

    const updated = useTodoStore.getState().todos[0];
    expect(updated.status).toBe('completed');
    expect(updated.completedAt).toBeDefined();
  });

  it('updateTodo: clears completedAt when status changes away from completed', () => {
    const todo = addSampleTodo({ status: 'pending' });
    useTodoStore.getState().updateTodo(todo.id, { status: 'completed' });
    useTodoStore.getState().updateTodo(todo.id, { status: 'pending' });

    const updated = useTodoStore.getState().todos[0];
    expect(updated.status).toBe('pending');
    expect(updated.completedAt).toBeNull();
  });

  // ── deleteTodo ─────────────────────────────────────────────────────

  it('deleteTodo: removes the todo from the array', () => {
    const todo = addSampleTodo();
    expect(useTodoStore.getState().todos).toHaveLength(1);

    useTodoStore.getState().deleteTodo(todo.id);
    expect(useTodoStore.getState().todos).toHaveLength(0);
  });

  it('deleteTodo: does not affect other todos', () => {
    const todo1 = addSampleTodo({ title: 'First' });
    const todo2 = addSampleTodo({ title: 'Second' });

    useTodoStore.getState().deleteTodo(todo1.id);

    const remaining = useTodoStore.getState().todos;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(todo2.id);
  });

  // ── toggleTodoStatus ───────────────────────────────────────────────

  it('toggleTodoStatus: toggles pending to completed', () => {
    const todo = addSampleTodo({ status: 'pending' });

    useTodoStore.getState().toggleTodoStatus(todo.id);

    expect(useTodoStore.getState().todos[0].status).toBe('completed');
  });

  it('toggleTodoStatus: toggles completed back to pending', () => {
    const todo = addSampleTodo({ status: 'pending' });

    useTodoStore.getState().toggleTodoStatus(todo.id);
    useTodoStore.getState().toggleTodoStatus(todo.id);

    expect(useTodoStore.getState().todos[0].status).toBe('pending');
  });

  // ── addSubtask ─────────────────────────────────────────────────────

  it('addSubtask: adds a subtask to the correct todo', () => {
    const todo = addSampleTodo();

    useTodoStore.getState().addSubtask(todo.id, 'Sub-item 1');

    const updated = useTodoStore.getState().todos[0];
    expect(updated.subtasks).toHaveLength(1);
    expect(updated.subtasks[0].title).toBe('Sub-item 1');
    expect(updated.subtasks[0].isCompleted).toBe(false);
    expect(updated.subtasks[0].todoId).toBe(todo.id);
    expect(updated.subtasks[0].id).toBeDefined();
  });

  it('addSubtask: assigns incremental order', () => {
    const todo = addSampleTodo();

    useTodoStore.getState().addSubtask(todo.id, 'First');
    useTodoStore.getState().addSubtask(todo.id, 'Second');

    const subtasks = useTodoStore.getState().todos[0].subtasks;
    expect(subtasks[0].order).toBe(0);
    expect(subtasks[1].order).toBe(1);
  });

  // ── toggleSubtask ──────────────────────────────────────────────────

  it('toggleSubtask: toggles isCompleted on the subtask', () => {
    const todo = addSampleTodo();
    useTodoStore.getState().addSubtask(todo.id, 'Sub-item');

    const subtaskId = useTodoStore.getState().todos[0].subtasks[0].id;
    useTodoStore.getState().toggleSubtask(todo.id, subtaskId);

    expect(useTodoStore.getState().todos[0].subtasks[0].isCompleted).toBe(true);
  });

  it('toggleSubtask: auto-completes parent when all subtasks are done', () => {
    const todo = addSampleTodo({ status: 'pending' });
    useTodoStore.getState().addSubtask(todo.id, 'Only subtask');

    const subtaskId = useTodoStore.getState().todos[0].subtasks[0].id;
    useTodoStore.getState().toggleSubtask(todo.id, subtaskId);

    expect(useTodoStore.getState().todos[0].status).toBe('completed');
  });

  // ── deleteSubtask ──────────────────────────────────────────────────

  it('deleteSubtask: removes the subtask from the todo', () => {
    const todo = addSampleTodo();
    useTodoStore.getState().addSubtask(todo.id, 'To be deleted');
    useTodoStore.getState().addSubtask(todo.id, 'Keep me');

    const subtaskId = useTodoStore.getState().todos[0].subtasks[0].id;
    useTodoStore.getState().deleteSubtask(todo.id, subtaskId);

    const subtasks = useTodoStore.getState().todos[0].subtasks;
    expect(subtasks).toHaveLength(1);
    expect(subtasks[0].title).toBe('Keep me');
  });

  // ── setFilter / clearFilter ────────────────────────────────────────

  it('setFilter: merges partial filter into existing filter state', () => {
    useTodoStore.getState().setFilter({ status: ['pending'] });
    useTodoStore.getState().setFilter({ categoryId: 'cat-1' });

    const { filter } = useTodoStore.getState();
    expect(filter.status).toEqual(['pending']);
    expect(filter.categoryId).toBe('cat-1');
  });

  it('clearFilter: resets filter to empty object', () => {
    useTodoStore.getState().setFilter({ status: ['pending'], search: 'test' });
    useTodoStore.getState().clearFilter();

    expect(useTodoStore.getState().filter).toEqual({});
  });

  // ── getFilteredTodos ───────────────────────────────────────────────

  it('getFilteredTodos: returns all todos sorted by order when no filter', () => {
    addSampleTodo({ title: 'Second' });
    addSampleTodo({ title: 'First' });

    // Manually set orders to test sorting
    useTodoStore.setState((state) => ({
      todos: state.todos.map((t, i) => ({ ...t, order: i === 0 ? 1 : 0 })),
    }));

    const result = useTodoStore.getState().getFilteredTodos();
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('First');
    expect(result[1].title).toBe('Second');
  });

  it('getFilteredTodos: filters by status', () => {
    addSampleTodo({ title: 'Pending', status: 'pending' });
    addSampleTodo({ title: 'Done', status: 'pending' });
    // Complete the second todo
    const doneId = useTodoStore.getState().todos[1].id;
    useTodoStore.getState().updateTodo(doneId, { status: 'completed' });

    useTodoStore.getState().setFilter({ status: ['completed'] });

    const result = useTodoStore.getState().getFilteredTodos();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Done');
  });

  it('getFilteredTodos: filters by search term matching title', () => {
    addSampleTodo({ title: 'Buy groceries' });
    addSampleTodo({ title: 'Read a book' });

    useTodoStore.getState().setFilter({ search: 'groceries' });

    const result = useTodoStore.getState().getFilteredTodos();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Buy groceries');
  });

  it('getFilteredTodos: search is case-insensitive', () => {
    addSampleTodo({ title: 'Buy GROCERIES' });

    useTodoStore.getState().setFilter({ search: 'groceries' });

    const result = useTodoStore.getState().getFilteredTodos();
    expect(result).toHaveLength(1);
  });

  it('getFilteredTodos: filters by categoryId', () => {
    addSampleTodo({ title: 'Work task', categoryId: 'work' });
    addSampleTodo({ title: 'Personal task', categoryId: 'personal' });

    useTodoStore.getState().setFilter({ categoryId: 'work' });

    const result = useTodoStore.getState().getFilteredTodos();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Work task');
  });

  it('getFilteredTodos: returns empty array when no todos exist', () => {
    expect(useTodoStore.getState().getFilteredTodos()).toEqual([]);
  });
});
