import { format, startOfWeek } from 'date-fns';
import type { AppSettings } from '@/types';

export function getDateKey(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

export function formatDate(date: Date, dateFormat: AppSettings['dateFormat']): string {
  if (isNaN(date.getTime())) return '';
  switch (dateFormat) {
    case 'MM/DD/YYYY':
      return format(date, 'MM/dd/yyyy');
    case 'YYYY-MM-DD':
      return format(date, 'yyyy-MM-dd');
    case 'DD/MM/YYYY':
    default:
      return format(date, 'dd/MM/yyyy');
  }
}

/** The local date of a `yyyy-MM-dd` key (at midnight). */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

/** The key `days` calendar days after (or before, if negative) `key`. DST-safe. */
export function addDaysToKey(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return getDateKey(date);
}

/** The local month (`yyyy-MM`) of `date`: a prestige season. */
export function getMonthKey(date: Date = new Date()): string {
  return format(date, 'yyyy-MM');
}

/** The Monday (`yyyy-MM-dd`) of the week of `date`: weekly goals run Monday to Sunday. */
export function getWeekKey(date: Date = new Date()): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}
