import type { Subtask, Todo, TodoFilter, TodoStatus } from '@/types';
import { generateId } from '@/utils/uuid';
import { dueDateToTimestamp, isPastDue, normalizeDueDate, normalizeDueTime } from '@/utils/todo-dates';
import { filterTodos, sortTodos, type TodoSort } from '@/utils/todo-list';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useGamificationStore } from './gamification-store';
import { asRecord, asRecordArray, createPersistOptions } from './persist';
import { useSyncStore } from './sync-store';

interface TodoState {
  todos: Todo[];
  filter: TodoFilter;
  sortBy: TodoSort;

  // Todo actions
  /** `order` and `completedAt` are set by the store (a new todo goes last, not completed). */
  addTodo: (
    todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt' | 'subtasks' | 'pomodoroSessions' | 'order' | 'completedAt'> &
      Partial<Pick<Todo, 'order' | 'completedAt'>>
  ) => Todo;
  updateTodo: (id: string, updates: Partial<Todo>) => void;
  deleteTodo: (id: string) => void;
  toggleTodoStatus: (id: string) => void;
  reorderTodos: (todoIds: string[]) => void;

  // Subtask actions
  addSubtask: (todoId: string, title: string) => void;
  /** Renames or reorders a subtask (completion goes through toggleSubtask). */
  updateSubtask: (todoId: string, subtaskId: string, updates: Partial<Pick<Subtask, 'title' | 'order'>>) => void;
  toggleSubtask: (todoId: string, subtaskId: string) => void;
  deleteSubtask: (todoId: string, subtaskId: string) => void;

  // Filter actions
  setFilter: (filter: Partial<TodoFilter>) => void;
  clearFilter: () => void;
  setSortBy: (sortBy: TodoSort) => void;

  // Pomodoro integration
  incrementPomodoroCount: (todoId: string) => void;

  // Utility
  getTodoById: (id: string) => Todo | undefined;
  getFilteredTodos: () => Todo[];
}

function isOpen(status: TodoStatus): status is 'pending' | 'in_progress' {
  return status === 'pending' || status === 'in_progress';
}

/**
 * Moves a todo to `status`. `completedAt` is set on completion and kept when the todo is
 * archived (or brought back from the archive); reopening clears it. The open status a
 * todo was completed from is remembered, so unchecking it restores "in progress".
 */
function withStatus(todo: Todo, status: TodoStatus, now: string): Todo {
  if (status === todo.status) return todo;
  const next: Todo = { ...todo, status };
  if (status === 'completed') {
    next.completedAt = todo.status === 'archived' && todo.completedAt ? todo.completedAt : now;
    if (isOpen(todo.status)) next.reopenStatus = todo.status;
  } else if (status !== 'archived') {
    next.completedAt = null;
  }
  return next;
}

/**
 * Marks a todo that has just become completed as rewarded. Returns true the first time
 * only: completing, reopening and completing again (or archiving and restoring) never
 * pays twice.
 */
function claimCompletionReward(todo: Todo, now: string): boolean {
  if (todo.status !== 'completed' || todo.xpAwardedAt) return false;
  todo.xpAwardedAt = now;
  return true;
}

/** What the gamification store needs to know about a completed task. */
function completionDetails(todo: Todo, at: Date) {
  return {
    at,
    priority: todo.priority,
    categoryId: todo.categoryId,
    wasOverdue: isPastDue(todo.dueDate, at, todo.dueTime),
  };
}

export const useTodoStore = create<TodoState>()(
  persist(
    (set, get) => ({
      todos: [],
      filter: {},
      sortBy: 'manual',

      addTodo: (todoData) => {
        const now = new Date().toISOString();
        const dueDate = normalizeDueDate(todoData.dueDate);
        const newTodo: Todo = {
          ...todoData,
          id: generateId(),
          dueDate,
          dueTime: dueDate ? normalizeDueTime(todoData.dueTime) : null,
          subtasks: [],
          pomodoroSessions: 0,
          // After every existing todo (the count could repeat an order left by a delete).
          order: get().todos.reduce((max, todo) => Math.max(max, todo.order + 1), 0),
          createdAt: now,
          updatedAt: now,
          completedAt: null,
          xpAwardedAt: null,
        };

        set((state) => ({
          todos: [...state.todos, newTodo],
        }));
        useGamificationStore.getState().recordTaskCreated(new Date(now));

        useSyncStore.getState().enqueue('todos', 'insert', {
          id: newTodo.id,
          title: newTodo.title,
          description: newTodo.description ?? null,
          status: newTodo.status,
          priority: newTodo.priority,
          category_id: newTodo.categoryId ?? null,
          due_date: dueDateToTimestamp(newTodo.dueDate, newTodo.dueTime),
          estimated_pomodoros: newTodo.estimatedPomodoros ?? null,
          pomodoro_sessions: 0,
          order: newTodo.order,
          created_at: newTodo.createdAt,
          updated_at: newTodo.updatedAt,
        });

        return newTodo;
      },

      updateTodo: (id, updates) => {
        const before = get().todos.find((todo) => todo.id === id);
        if (!before) return;
        const now = new Date();
        const nowIso = now.toISOString();

        // completedAt, xpAwardedAt and reopenStatus follow the status; callers never set them.
        const { status, completedAt: _completedAt, xpAwardedAt: _xpAwardedAt, ...fields } = updates;
        if ('dueDate' in fields || 'dueTime' in fields) {
          fields.dueDate = normalizeDueDate('dueDate' in fields ? fields.dueDate : before.dueDate);
          // A time only makes sense with a date.
          fields.dueTime = fields.dueDate ? normalizeDueTime('dueTime' in fields ? fields.dueTime : before.dueTime) : null;
        }
        const updated = withStatus({ ...before, ...fields, updatedAt: nowIso }, status ?? before.status, nowIso);
        const rewarded = claimCompletionReward(updated, nowIso);

        set((state) => ({
          todos: state.todos.map((todo) => (todo.id === id ? updated : todo)),
        }));

        if (rewarded) {
          // Overdue is judged on the task as it was before this edit.
          useGamificationStore.getState().incrementTaskCompleted(
            completionDetails({ ...updated, dueDate: before.dueDate, dueTime: before.dueTime }, now)
          );
        }

        useSyncStore.getState().enqueue('todos', 'update', {
          id: updated.id,
          title: updated.title,
          description: updated.description ?? null,
          status: updated.status,
          priority: updated.priority,
          category_id: updated.categoryId ?? null,
          due_date: dueDateToTimestamp(updated.dueDate, updated.dueTime),
          estimated_pomodoros: updated.estimatedPomodoros ?? null,
          pomodoro_sessions: updated.pomodoroSessions,
          order: updated.order,
          updated_at: updated.updatedAt,
        });
      },

      deleteTodo: (id) => {
        // Soft delete: enqueue before removing locally
        useSyncStore.getState().enqueue('todos', 'update', {
          id,
          deleted_at: new Date().toISOString(),
        });

        set((state) => ({
          todos: state.todos.filter((todo) => todo.id !== id),
        }));

        // A timer linked to this task would credit a todo that no longer exists.
        // (Its reminder is cancelled by the task-reminder sync, which follows the todos.)
        try {
          const { usePomodoroStore } = require('./pomodoro-store') as typeof import('./pomodoro-store');
          if (usePomodoroStore.getState().timer.linkedTodoId === id) usePomodoroStore.getState().linkTodo(null);
        } catch {
          // The timer store is optional here (e.g. in tests).
        }
      },

      toggleTodoStatus: (id) => {
        const todo = get().todos.find((t) => t.id === id);
        if (!todo) return;

        // Checked → back to the open status it was completed from; anything else → completed.
        const nextStatus = todo.status === 'completed' ? (todo.reopenStatus ?? 'pending') : 'completed';

        get().updateTodo(id, { status: nextStatus });
      },

      reorderTodos: (todoIds) => {
        set((state) => {
          // The given ids first, in that order, then the rest in their current order: 0..n-1.
          const position = new Map(todoIds.map((id, index) => [id, index]));
          const ranked = [...state.todos].sort((a, b) => {
            const pa = position.get(a.id);
            const pb = position.get(b.id);
            if (pa !== undefined && pb !== undefined) return pa - pb;
            if (pa !== undefined) return -1;
            if (pb !== undefined) return 1;
            return a.order - b.order;
          });
          const orderOf = new Map(ranked.map((todo, index) => [todo.id, index]));
          return { todos: state.todos.map((todo) => ({ ...todo, order: orderOf.get(todo.id) ?? todo.order })) };
        });
      },

      addSubtask: (todoId, title) => {
        if (!title.trim()) return;
        const subtasks = get().todos.find((t) => t.id === todoId)?.subtasks ?? [];
        const newSubtask: Subtask = {
          id: generateId(),
          todoId,
          title: title.trim(),
          isCompleted: false,
          order: subtasks.reduce((max, subtask) => Math.max(max, subtask.order + 1), 0),
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === todoId
              ? {
                  ...todo,
                  subtasks: [...todo.subtasks, newSubtask],
                  updatedAt: new Date().toISOString(),
                }
              : todo
          ),
        }));
      },

      updateSubtask: (todoId, subtaskId, updates) => {
        const changes: Partial<Subtask> = {};
        if (typeof updates.title === 'string' && updates.title.trim()) changes.title = updates.title.trim();
        if (typeof updates.order === 'number') changes.order = updates.order;
        if (Object.keys(changes).length === 0) return;
        set((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === todoId
              ? {
                  ...todo,
                  subtasks: todo.subtasks.map((subtask) =>
                    subtask.id === subtaskId ? { ...subtask, ...changes } : subtask
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : todo
          ),
        }));
      },

      toggleSubtask: (todoId, subtaskId) => {
        const todo = get().todos.find((t) => t.id === todoId);
        const subtask = todo?.subtasks.find((s) => s.id === subtaskId);
        if (!todo || !subtask) return;

        const now = new Date();
        const nowIso = now.toISOString();
        const nowCompleted = !subtask.isCompleted;
        const rewardSubtask = nowCompleted && !subtask.xpAwardedAt;
        const subtasks = todo.subtasks.map((s) =>
          s.id === subtaskId
            ? { ...s, isCompleted: nowCompleted, xpAwardedAt: s.xpAwardedAt ?? (nowCompleted ? nowIso : null) }
            : s
        );

        // Completing the last subtask completes an open todo; unchecking one reopens it.
        const allCompleted = subtasks.every((s) => s.isCompleted);
        let updated: Todo = { ...todo, subtasks, updatedAt: nowIso };
        if (allCompleted && isOpen(todo.status)) {
          updated = withStatus(updated, 'completed', nowIso);
        } else if (!allCompleted && todo.status === 'completed') {
          updated = withStatus(updated, todo.reopenStatus ?? 'pending', nowIso);
        }
        const rewardTodo = claimCompletionReward(updated, nowIso);

        set((state) => ({
          todos: state.todos.map((t) => (t.id === todoId ? updated : t)),
        }));

        const gamification = useGamificationStore.getState();
        if (rewardSubtask) gamification.recordSubtaskCompleted(now);
        if (rewardTodo) gamification.incrementTaskCompleted(completionDetails(todo, now));
      },

      deleteSubtask: (todoId, subtaskId) => {
        const todo = get().todos.find((t) => t.id === todoId);
        if (!todo) return;

        const nowIso = new Date().toISOString();
        const subtasks = todo.subtasks.filter((subtask) => subtask.id !== subtaskId);
        let updated: Todo = { ...todo, subtasks, updatedAt: nowIso };
        // Deleting the only open subtask finishes the todo.
        if (subtasks.length > 0 && subtasks.every((s) => s.isCompleted) && isOpen(todo.status)) {
          updated = withStatus(updated, 'completed', nowIso);
        }
        const rewardTodo = claimCompletionReward(updated, nowIso);

        set((state) => ({
          todos: state.todos.map((t) => (t.id === todoId ? updated : t)),
        }));

        if (rewardTodo) {
          useGamificationStore.getState().incrementTaskCompleted(completionDetails(todo, new Date(nowIso)));
        }
      },

      setFilter: (filter) => {
        set((state) => ({
          filter: { ...state.filter, ...filter },
        }));
      },

      clearFilter: () => {
        set({ filter: {} });
      },

      setSortBy: (sortBy) => {
        set({ sortBy });
      },

      incrementPomodoroCount: (todoId) => {
        set((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === todoId
              ? {
                  ...todo,
                  pomodoroSessions: todo.pomodoroSessions + 1,
                  updatedAt: new Date().toISOString(),
                }
              : todo
          ),
        }));
      },

      getTodoById: (id) => {
        return get().todos.find((todo) => todo.id === id);
      },

      getFilteredTodos: () => {
        const { todos, filter, sortBy } = get();
        let result = filterTodos(todos, {
          categoryId: filter.categoryId,
          priorities: filter.priority,
          search: filter.search,
        });
        if (filter.status?.length) result = result.filter((todo) => filter.status!.includes(todo.status));
        if (filter.dueDateRange) {
          const { start, end } = filter.dueDateRange;
          result = result.filter((todo) => {
            const key = normalizeDueDate(todo.dueDate);
            return key !== null && key >= (normalizeDueDate(start) ?? start) && key <= (normalizeDueDate(end) ?? end);
          });
        }
        return sortTodos(result, sortBy);
      },
    }),
    createPersistOptions<TodoState, Pick<TodoState, 'todos' | 'filter' | 'sortBy'>>({
      name: 'todo-storage',
      // v2: xpAwardedAt on todos and subtasks (rewards are paid once).
      // v3: due dates as local `yyyy-MM-dd` plus an optional dueTime; sortBy.
      version: 3,
      partialize: (state) => ({ todos: state.todos, filter: state.filter, sortBy: state.sortBy }),
      migrate: migrateTodoState,
    })
  )
);

/** Normalizes every todo so missing fields never crash a screen; v1 → v2 see markRewardedV1. */
export function migrateTodoState(persisted: unknown, fromVersion: number) {
  const state = asRecord(persisted);
  let todos = asRecordArray(state.todos).map(normalizeTodo);
  if (fromVersion < 2) todos = todos.map(markRewardedV1);
  if (fromVersion < 3) {
    // The date picker stored local midnight as UTC (e.g. "2026-10-13T21:00:00.000Z" for
    // the 14th in Istanbul); read back on the same device it gives the intended day.
    todos = todos.map((todo) => ({ ...todo, dueDate: normalizeDueDate(todo.dueDate), dueTime: null }));
  }
  return {
    todos,
    filter: asRecord(state.filter),
    ...(typeof state.sortBy === 'string' ? { sortBy: state.sortBy } : {}),
  };
}

/**
 * Before v2 a todo paid XP every time it was completed. Whatever is completed (or
 * archived, which only followed completion) has been paid already.
 */
function markRewardedV1(todo: Todo): Todo {
  const done = todo.status === 'completed' || todo.status === 'archived' || Boolean(todo.completedAt);
  return {
    ...todo,
    xpAwardedAt: todo.xpAwardedAt ?? (done ? (todo.completedAt ?? todo.updatedAt) : null),
    subtasks: todo.subtasks.map((subtask) =>
      subtask.isCompleted && !subtask.xpAwardedAt
        ? { ...subtask, xpAwardedAt: subtask.createdAt ?? todo.updatedAt }
        : subtask
    ),
  };
}

function normalizeTodo(raw: Record<string, unknown>, index: number): Todo {
  const now = new Date().toISOString();
  return {
    description: null,
    dueDate: null,
    status: 'pending',
    categoryId: null,
    priority: 'medium',
    pomodoroSessions: 0,
    estimatedPomodoros: null,
    completedAt: null,
    order: index,
    createdAt: now,
    updatedAt: now,
    ...raw,
    id: typeof raw.id === 'string' && raw.id ? raw.id : generateId(),
    title: typeof raw.title === 'string' ? raw.title : '',
    subtasks: asRecordArray(raw.subtasks) as unknown as Subtask[],
  } as Todo;
}
