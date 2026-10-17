import type { TodoPriority, TodoStatus } from '@/types';
import type { Colors } from './theme';

/** Priorities from lowest to highest, as offered in the forms. */
export const PRIORITIES: readonly TodoPriority[] = ['low', 'medium', 'high', 'urgent'];

/** Statuses in board order (kanban columns, the status picker). */
export const STATUSES: readonly TodoStatus[] = ['pending', 'in_progress', 'completed', 'archived'];

export const PRIORITY_LABEL_KEYS: Record<TodoPriority, string> = {
  low: 'todo.create.priorityLow',
  medium: 'todo.create.priorityMedium',
  high: 'todo.create.priorityHigh',
  urgent: 'todo.create.priorityUrgent',
};

export const STATUS_LABEL_KEYS: Record<TodoStatus, string> = {
  pending: 'todos.statusPending',
  in_progress: 'todos.statusInProgress',
  completed: 'todos.statusDone',
  archived: 'todos.statusArchived',
};

type ThemeColors = (typeof Colors)['light'] | (typeof Colors)['dark'];

/** The theme color of a priority (dots, accents, selected pills). */
export function priorityColor(priority: TodoPriority, colors: ThemeColors): string {
  switch (priority) {
    case 'urgent':
      return colors.priorityUrgent;
    case 'high':
      return colors.priorityHigh;
    case 'medium':
      return colors.priorityMedium;
    default:
      return colors.priorityLow;
  }
}
