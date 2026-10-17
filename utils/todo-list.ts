import type { Todo, TodoPriority, TodoStatus } from '@/types';
import { getDueAt, getDueDateKey } from './todo-dates';
import { foldForSearch } from './search';

export type TodoSort = 'manual' | 'dueDate' | 'priority' | 'newest';

export const TODO_SORTS: TodoSort[] = ['manual', 'dueDate', 'priority', 'newest'];

export interface TodoListQuery {
  status?: TodoStatus | 'all';
  search?: string;
  categoryId?: string | null;
  priorities?: TodoPriority[];
}

const PRIORITY_RANK: Record<TodoPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export function filterTodos(todos: Todo[], query: TodoListQuery): Todo[] {
  const search = query.search ? foldForSearch(query.search.trim()) : '';
  return todos.filter((todo) => {
    if (query.status && query.status !== 'all' && todo.status !== query.status) return false;
    if (query.categoryId && todo.categoryId !== query.categoryId) return false;
    if (query.priorities?.length && !query.priorities.includes(todo.priority)) return false;
    if (search) {
      const inTitle = foldForSearch(todo.title).includes(search);
      const inDescription = todo.description ? foldForSearch(todo.description).includes(search) : false;
      if (!inTitle && !inDescription) return false;
    }
    return true;
  });
}

/** Sort key for due dates: the due moment, the end of the day without a time, last without a date. */
function dueRank(todo: Todo): number {
  const key = getDueDateKey(todo.dueDate);
  if (!key) return Number.MAX_SAFE_INTEGER;
  const at = getDueAt(key, todo.dueTime);
  if (at) return at.getTime();
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59).getTime();
}

export function sortTodos(todos: Todo[], sort: TodoSort): Todo[] {
  const byOrder = (a: Todo, b: Todo) => a.order - b.order;
  const sorted = [...todos];
  switch (sort) {
    case 'dueDate':
      return sorted.sort((a, b) => dueRank(a) - dueRank(b) || byOrder(a, b));
    case 'priority':
      return sorted.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || dueRank(a) - dueRank(b) || byOrder(a, b));
    case 'newest':
      return sorted.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0) || byOrder(a, b));
    case 'manual':
    default:
      return sorted.sort(byOrder);
  }
}
