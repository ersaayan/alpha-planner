import type { Subtask, Todo, TodoFilter } from '@/types';
import { generateId } from '@/utils/uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useGamificationStore } from './gamification-store';

interface TodoState {
  todos: Todo[];
  filter: TodoFilter;
  isLoading: boolean;

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

export const useTodoStore = create<TodoState>()(
  persist(
    (set, get) => ({
      todos: [],
      filter: {},
      isLoading: false,

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

        return newTodo;
      },

      updateTodo: (id, updates) => {
        const hasStatusUpdate = typeof updates.status !== 'undefined';
        let didComplete = false;

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

        if (didComplete) {
          useGamificationStore.getState().incrementTaskCompleted();
        }
      },

      deleteTodo: (id) => {
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
          useGamificationStore.getState().addXp(3); // SUBTASK_COMPLETE XP

          // Check if this completion triggered parent todo completion
          const updatedTodo = get().todos.find((t) => t.id === todoId);
          if (
            updatedTodo?.status === 'completed' &&
            todo?.status !== 'completed'
          ) {
            useGamificationStore.getState().incrementTaskCompleted();
          }
        }
      },

      deleteSubtask: (todoId, subtaskId) => {
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
    {
      name: 'todo-storage',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ todos: state.todos }),
      migrate: (persistedState: unknown, version: number) => {
        return persistedState as TodoState;
      },
    }
  )
);
