import type { Subtask, Todo, TodoFilter } from '@/types';
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
        const hasStatusUpdate = typeof updates.status !== 'undefined';
        let didComplete = false;
        const before = get().todos.find((todo) => todo.id === id);

        set((state) => {
          const existing = state.todos.find((todo) => todo.id === id);
          didComplete =
            updates.status === 'completed' && existing?.status !== 'completed';

          return {
            todos: state.todos.map((todo) =>
              todo.id === id
                ? {
                    ...todo,
                    ...updates,
                    updatedAt: new Date().toISOString(),
                    completedAt:
                      hasStatusUpdate
                        ? updates.status === 'completed' && todo.status !== 'completed'
                          ? new Date().toISOString()
                          : updates.status !== 'completed' && todo.status === 'completed'
                            ? null
                            : todo.completedAt
                        : todo.completedAt,
                  }
                : todo
            ),
          };
        });

        const updated = get().todos.find((t) => t.id === id);
        if (didComplete && before && updated) {
          // Overdue is judged on the task as it was before this edit.
          useGamificationStore.getState().incrementTaskCompleted(
            completionDetails({ ...updated, dueDate: before.dueDate, dueTime: before.dueTime }, new Date())
          );
        }

        if (updated) {
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
        }
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

        // Binary toggle: unchecked → completed, checked → pending
        const nextStatus = todo.status === 'completed' ? 'pending' : 'completed';

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
        const wasCompleted = subtask?.isCompleted ?? false;

        set((state) => ({
          todos: state.todos.map((t) => {
            if (t.id !== todoId) return t;

            const updatedSubtasks = t.subtasks.map((s) =>
              s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s
            );

            // Check if all subtasks are now completed
            const allCompleted =
              updatedSubtasks.length > 0 && updatedSubtasks.every((s) => s.isCompleted);
            const wasAllCompleted =
              t.subtasks.length > 0 && t.subtasks.every((s) => s.isCompleted);

            const now = new Date().toISOString();

            return {
              ...t,
              subtasks: updatedSubtasks,
              updatedAt: now,
              // Auto-complete parent when all subtasks done; revert if undoing
              ...(allCompleted && !wasAllCompleted
                ? { status: 'completed' as const, completedAt: now }
                : !allCompleted && wasAllCompleted && t.status === 'completed'
                  ? { status: 'pending' as const, completedAt: null }
                  : {}),
            };
          }),
        }));

        // Award XP when subtask is toggled to completed
        if (!wasCompleted) {
          const now = new Date();
          useGamificationStore.getState().addXp(3); // SUBTASK_COMPLETE XP
          useGamificationStore.getState().recordSubtaskCompleted(now);

          // Check if this completion triggered parent todo completion
          const updatedTodo = get().todos.find((t) => t.id === todoId);
          if (
            updatedTodo?.status === 'completed' &&
            todo?.status !== 'completed'
          ) {
            useGamificationStore.getState().incrementTaskCompleted(completionDetails(updatedTodo, now));
          }
        }
      },

      deleteSubtask: (todoId, subtaskId) => {
        const todoBefore = get().todos.find((t) => t.id === todoId);

        set((state) => ({
          todos: state.todos.map((todo) => {
            if (todo.id !== todoId) return todo;
            const remainingSubtasks = todo.subtasks.filter((subtask) => subtask.id !== subtaskId);
            const allRemainingCompleted =
              remainingSubtasks.length > 0 && remainingSubtasks.every((s) => s.isCompleted);
            const now = new Date().toISOString();
            return {
              ...todo,
              subtasks: remainingSubtasks,
              updatedAt: now,
              ...(allRemainingCompleted && todo.status !== 'completed'
                ? { status: 'completed' as const, completedAt: now }
                : {}),
            };
          }),
        }));

        // Award gamification credit for auto-completion via subtask deletion
        const todoAfter = get().todos.find((t) => t.id === todoId);
        if (todoAfter?.status === 'completed' && todoBefore?.status !== 'completed') {
          useGamificationStore.getState().incrementTaskCompleted(completionDetails(todoAfter, new Date()));
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
      version: 1,
      partialize: (state) => ({ todos: state.todos, filter: state.filter }),
      migrate: migrateTodoState,
    })
  )
);

/** v0 (unversioned) and v1 share a shape; normalize every todo so missing fields never crash a screen. */
export function migrateTodoState(persisted: unknown, _fromVersion: number) {
  const state = asRecord(persisted);
  return {
    todos: asRecordArray(state.todos).map(normalizeTodo),
    filter: asRecord(state.filter),
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
