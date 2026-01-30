import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Todo, TodoFilter, Subtask, TodoStatus } from '@/types';
import { generateId } from '@/utils/uuid';
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
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          todos: [...state.todos, newTodo],
        }));

        return newTodo;
      },

      updateTodo: (id, updates) => {
        const existing = get().todos.find((todo) => todo.id === id);
        const hasStatusUpdate = typeof updates.status !== 'undefined';
        const didComplete =
          updates.status === 'completed' && existing?.status !== 'completed';

        set((state) => ({
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
        }));

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

        const nextStatus: Record<TodoStatus, TodoStatus> = {
          pending: 'in_progress',
          in_progress: 'completed',
          completed: 'pending',
          archived: 'pending',
        };

        get().updateTodo(id, { status: nextStatus[todo.status] });
      },

      reorderTodos: (todoIds) => {
        set((state) => ({
          todos: state.todos.map((todo) => {
            const newOrder = todoIds.indexOf(todo.id);
            return newOrder !== -1 ? { ...todo, order: newOrder } : todo;
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
        set((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === todoId
              ? {
                  ...todo,
                  subtasks: todo.subtasks.map((subtask) =>
                    subtask.id === subtaskId ? { ...subtask, isCompleted: !subtask.isCompleted } : subtask
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : todo
          ),
        }));
      },

      deleteSubtask: (todoId, subtaskId) => {
        set((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === todoId
              ? {
                  ...todo,
                  subtasks: todo.subtasks.filter((subtask) => subtask.id !== subtaskId),
                  updatedAt: new Date().toISOString(),
                }
              : todo
          ),
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
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ todos: state.todos }),
    }
  )
);
