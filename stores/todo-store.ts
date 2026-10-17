import type { Subtask, Todo, TodoFilter, TodoStatus } from '@/types';
import { generateId } from '@/utils/uuid';
import { isPastDue } from '@/utils/todo-dates';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useGamificationStore } from './gamification-store';
import { asRecord, asRecordArray, createPersistOptions } from './persist';
import { useSyncStore } from './sync-store';

interface TodoState {
  todos: Todo[];
  filter: TodoFilter;

  // Todo actions
  addTodo: (todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt' | 'subtasks' | 'pomodoroSessions'>) => Todo;
  updateTodo: (id: string, updates: Partial<Todo>) => void;
  deleteTodo: (id: string) => void;
  toggleTodoStatus: (id: string) => void;
  reorderTodos: (todoIds: string[]) => void;

  // Subtask actions
  addSubtask: (todoId: string, title: string) => void;
  updateSubtask: (todoId: string, subtaskId: string, updates: Partial<Subtask>) => void;
  toggleSubtask: (todoId: string, subtaskId: string) => void;
  deleteSubtask: (todoId: string, subtaskId: string) => void;

  // Filter actions
  setFilter: (filter: Partial<TodoFilter>) => void;
  clearFilter: () => void;

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

      addTodo: (todoData) => {
        const now = new Date().toISOString();
        const newTodo: Todo = {
          ...todoData,
          id: generateId(),
          subtasks: [],
          pomodoroSessions: 0,
          order: get().todos.length,
          createdAt: now,
          updatedAt: now,
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
          due_date: newTodo.dueDate ?? null,
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
          due_date: updated.dueDate ?? null,
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

        // B7 fix: Cancel scheduled task-due notification to prevent memory leak
        try {
          const { notificationService } = require('@/services/notifications');
          const notifMap = notificationService.scheduledTaskDueNotifications;
          if (notifMap?.has(id)) {
            notificationService.cancelNotification(notifMap.get(id));
            notifMap.delete(id);
          }
        } catch {
          // Non-fatal
        }

        set((state) => ({
          todos: state.todos.filter((todo) => todo.id !== id),
        }));
      },

      toggleTodoStatus: (id) => {
        const todo = get().todos.find((t) => t.id === id);
        if (!todo) return;

        // Checked → back to the open status it was completed from; anything else → completed.
        const nextStatus = todo.status === 'completed' ? (todo.reopenStatus ?? 'pending') : 'completed';

        get().updateTodo(id, { status: nextStatus });
      },

      reorderTodos: (todoIds) => {
        set((state) => ({
          todos: state.todos.map((todo) => {
            const newOrder = todoIds.indexOf(todo.id);
            // Place unmatched todos after all explicitly ordered ones
            return { ...todo, order: newOrder !== -1 ? newOrder : todoIds.length + todo.order };
          }),
        }));
      },

      addSubtask: (todoId, title) => {
        const newSubtask: Subtask = {
          id: generateId(),
          todoId,
          title,
          isCompleted: false,
          order: get().todos.find((t) => t.id === todoId)?.subtasks.length ?? 0,
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
        set((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === todoId
              ? {
                  ...todo,
                  subtasks: todo.subtasks.map((subtask) =>
                    subtask.id === subtaskId ? { ...subtask, ...updates } : subtask
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
        const { todos, filter } = get();

        if (todos.length === 0) return [];

        const hasFilter = filter.status?.length ||
          filter.categoryId ||
          filter.priority?.length ||
          filter.search ||
          filter.dueDateRange;

        if (!hasFilter) {
          return [...todos].sort((a, b) => a.order - b.order);
        }

        return todos
          .filter((todo) => {
            if (filter.status?.length && !filter.status.includes(todo.status)) {
              return false;
            }
            if (filter.categoryId && todo.categoryId !== filter.categoryId) {
              return false;
            }
            if (filter.priority?.length && !filter.priority.includes(todo.priority)) {
              return false;
            }
            if (filter.search) {
              const search = filter.search.toLowerCase();
              if (
                !todo.title.toLowerCase().includes(search) &&
                !todo.description?.toLowerCase().includes(search)
              ) {
                return false;
              }
            }
            if (filter.dueDateRange) {
              if (!todo.dueDate) return false;
              const dueDate = new Date(todo.dueDate);
              const start = new Date(filter.dueDateRange.start);
              const end = new Date(filter.dueDateRange.end);
              if (dueDate < start || dueDate > end) return false;
            }
            return true;
          })
          .sort((a, b) => a.order - b.order);
      },
    }),
    createPersistOptions<TodoState, Pick<TodoState, 'todos' | 'filter'>>({
      name: 'todo-storage',
      // v2: xpAwardedAt on todos and subtasks (rewards are paid once).
      version: 2,
      partialize: (state) => ({ todos: state.todos, filter: state.filter }),
      migrate: migrateTodoState,
    })
  )
);

/** Normalizes every todo so missing fields never crash a screen; v1 → v2 see markRewardedV1. */
export function migrateTodoState(persisted: unknown, fromVersion: number) {
  const state = asRecord(persisted);
  const todos = asRecordArray(state.todos).map(normalizeTodo);
  return {
    todos: fromVersion < 2 ? todos.map(markRewardedV1) : todos,
    filter: asRecord(state.filter),
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
