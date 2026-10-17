export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'archived';
export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Subtask {
  id: string;
  todoId: string;
  title: string;
  isCompleted: boolean;
  order: number;
  createdAt: string;
  /** When completing this subtask earned XP. Set once, so it never pays twice. */
  xpAwardedAt?: string | null;
}

export interface Todo {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  /** Optional time of day (`HH:mm`) on the due date. */
  dueTime?: string | null;
  status: TodoStatus;
  categoryId: string | null;
  priority: TodoPriority;
  subtasks: Subtask[];
  pomodoroSessions: number;
  estimatedPomodoros: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  order: number;
  /** When completing this todo earned XP and counted for stats. Set once, never cleared. */
  xpAwardedAt?: string | null;
  /** The open status the todo had when it was completed, restored when it is unchecked. */
  reopenStatus?: 'pending' | 'in_progress' | null;
}

export interface TodoFilter {
  status?: TodoStatus[];
  categoryId?: string | null;
  priority?: TodoPriority[];
  dueDateRange?: {
    start: string;
    end: string;
  };
  search?: string;
}

export type TodoViewType = 'list' | 'kanban' | 'calendar' | 'timeline';
