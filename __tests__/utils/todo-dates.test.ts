import {
  dueDateToTimestamp,
  formatDue,
  getDueAt,
  getDueDateKey,
  isPastDue,
  normalizeDueTime,
} from '@/utils/todo-dates';
import { filterTodos, sortTodos } from '@/utils/todo-list';
import type { Todo } from '@/types';

describe('due dates are local calendar days', () => {
  it('reads the old ISO format as the local day it was picked for', () => {
    // The old Datepicker stored local midnight of the 14th via toISOString().
    const oldValue = new Date(2026, 9, 14).toISOString();
    expect(getDueDateKey(oldValue)).toBe('2026-10-14');
    expect(getDueDateKey('2026-10-14')).toBe('2026-10-14');
    expect(getDueDateKey('garbage')).toBeNull();
  });

  it('a date key is never shifted by the time zone', () => {
    // `new Date('2026-10-14')` is UTC midnight: the 13th in New York.
    expect(new Date('2026-10-14').getDate()).toBe(13);
    expect(formatDue('2026-10-14', null, 'DD/MM/YYYY')).toBe('14/10/2026');
  });

  it('formats an optional time in the user clock style', () => {
    expect(formatDue('2026-10-14', '09:05', 'YYYY-MM-DD')).toBe('2026-10-14 09:05');
    expect(formatDue('2026-10-14', '21:30', 'MM/DD/YYYY', '12h')).toBe('10/14/2026 9:30 PM');
    expect(formatDue('2026-10-14', '00:15', 'MM/DD/YYYY', '12h')).toBe('10/14/2026 12:15 AM');
  });

  it('validates times and builds the due moment', () => {
    expect(normalizeDueTime('24:00')).toBeNull();
    expect(normalizeDueTime('7:00')).toBeNull();
    expect(getDueAt('2026-10-14', '07:30')).toEqual(new Date(2026, 9, 14, 7, 30));
    expect(getDueAt('2026-10-14', null)).toBeNull();
    expect(dueDateToTimestamp('2026-10-14', '07:30')).toBe(new Date(2026, 9, 14, 7, 30).toISOString());
  });

  it('is past due after its day, or after its time on the day', () => {
    const noon = new Date(2026, 9, 14, 12, 0);
    expect(isPastDue('2026-10-13', noon)).toBe(true);
    expect(isPastDue('2026-10-14', noon)).toBe(false);
    expect(isPastDue('2026-10-14', noon, '11:59')).toBe(true);
    expect(isPastDue('2026-10-14', noon, '12:30')).toBe(false);
  });
});

describe('task list filter and sort', () => {
  const todo = (id: string, overrides: Partial<Todo>): Todo => ({
    id, title: id, description: null, dueDate: null, status: 'pending', categoryId: null, priority: 'medium',
    subtasks: [], pomodoroSessions: 0, estimatedPomodoros: null, createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '', completedAt: null, order: 0, ...overrides,
  });
  const todos = [
    todo('a', { order: 2, dueDate: '2026-10-20', priority: 'low', categoryId: 'work', createdAt: '2026-10-03T00:00:00.000Z' }),
    todo('b', { order: 0, dueDate: '2026-10-15', dueTime: '18:00', priority: 'urgent' }),
    todo('c', { order: 1, priority: 'high', categoryId: 'work', title: 'İstanbul gezisi', createdAt: '2026-10-05T00:00:00.000Z' }),
    todo('d', { order: 3, dueDate: '2026-10-15', dueTime: '09:00', priority: 'urgent', status: 'completed' }),
  ];
  const ids = (list: Todo[]) => list.map((t) => t.id);

  it('sorts by my order, due moment, priority or newest', () => {
    expect(ids(sortTodos(todos, 'manual'))).toEqual(['b', 'c', 'a', 'd']);
    expect(ids(sortTodos(todos, 'dueDate'))).toEqual(['d', 'b', 'a', 'c']);
    expect(ids(sortTodos(todos, 'priority'))).toEqual(['d', 'b', 'c', 'a']);
    expect(ids(sortTodos(todos, 'newest'))[0]).toBe('c');
  });

  it('filters by status, category, priorities and a Turkish-aware search', () => {
    expect(ids(filterTodos(todos, { categoryId: 'work' }))).toEqual(['a', 'c']);
    expect(ids(filterTodos(todos, { priorities: ['urgent'], status: 'pending' }))).toEqual(['b']);
    expect(ids(filterTodos(todos, { search: 'istanbul' }))).toEqual(['c']);
  });
});

describe('12-hour times follow the app language', () => {
  it('uses the Turkish day periods in Turkish', () => {
    expect(formatDue('2026-10-14', '21:30', 'DD/MM/YYYY', '12h', 'tr')).toBe('14/10/2026 9:30 ÖS');
    expect(formatDue('2026-10-14', '08:00', 'DD/MM/YYYY', '12h', 'en')).toBe('14/10/2026 8:00 AM');
  });
});
