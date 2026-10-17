export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'archived';
export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Subtask {
  id: string;
  todoId: string;
  title: string;
  isCompleted: boolean;
  order: number;
  createdAt: string;
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
