import { format } from 'date-fns';
import type { AppSettings } from '@/types';
import { formatDate, getDateKey, parseDateKey } from './date';
import { getDateLocale } from './locale';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Due dates are stored as a local calendar day (`yyyy-MM-dd`) with an optional time of
 * day (`HH:mm`), so a task due on the 14th stays on the 14th in every time zone.
 */

/**
 * The local calendar day (`yyyy-MM-dd`) of a stored due date. Accepts the current
 * format (a date key) and the old one (an ISO timestamp of local midnight).
 */
export function getDueDateKey(dueDate: string | null | undefined): string | null {
  if (!dueDate) return null;
  if (DATE_KEY_PATTERN.test(dueDate)) return dueDate;
  const parsed = new Date(dueDate);
  return Number.isNaN(parsed.getTime()) ? null : getDateKey(parsed);
}

/** A due date in the stored format, or null. */
export function normalizeDueDate(value: unknown): string | null {
  return typeof value === 'string' ? getDueDateKey(value) : value instanceof Date ? getDateKey(value) : null;
}

/** A due time (`HH:mm`, 24-hour) or null. */
export function normalizeDueTime(value: unknown): string | null {
  return typeof value === 'string' && TIME_PATTERN.test(value) ? value : null;
}

/** `HH:mm` of a Date. */
export function toTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** The moment a task is due: its day at its time, or null without a time. */
export function getDueAt(dueDate: string | null | undefined, dueTime: string | null | undefined): Date | null {
  const key = getDueDateKey(dueDate);
  const time = normalizeDueTime(dueTime);
  if (!key || !time) return null;
  const [hours, minutes] = time.split(':').map(Number);
  const date = parseDateKey(key);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/** For sync (a TIMESTAMPTZ column): the due moment, or local midnight without a time. */
export function dueDateToTimestamp(dueDate: string | null | undefined, dueTime: string | null | undefined): string | null {
  const key = getDueDateKey(dueDate);
  if (!key) return null;
  return (getDueAt(key, dueTime) ?? parseDateKey(key)).toISOString();
}

/** True when a task due on `dueDate` is late at `at`: its day (or due time) has passed. */
export function isPastDue(
  dueDate: string | null | undefined,
  at: Date = new Date(),
  dueTime?: string | null
): boolean {
  const dueKey = getDueDateKey(dueDate);
  if (!dueKey) return false;
  const todayKey = getDateKey(at);
  if (dueKey !== todayKey) return dueKey < todayKey;
  const dueAt = getDueAt(dueKey, dueTime);
  return dueAt !== null && at.getTime() > dueAt.getTime();
}

/**
 * "14/10/2026" or "14/10/2026 09:30" (or "9:30 PM" / "9:30 ÖS") following the user's
 * formats and the app language.
 */
export function formatDue(
  dueDate: string | null | undefined,
  dueTime: string | null | undefined,
  dateFormat: AppSettings['dateFormat'],
  timeFormat: AppSettings['timeFormat'] = '24h',
  language?: string
): string {
  const key = getDueDateKey(dueDate);
  if (!key) return '';
  const day = formatDate(parseDateKey(key), dateFormat);
  const time = normalizeDueTime(dueTime);
  return time ? `${day} ${formatTime(time, timeFormat, language)}` : day;
}

/** An `HH:mm` time as shown to the user: unchanged for 24h, "9:30 PM" (or "9:30 ÖS") for 12h. */
export function formatTime(time: string, timeFormat: AppSettings['timeFormat'] = '24h', language?: string): string {
  if (timeFormat !== '12h') return time;
  const [hours, minutes] = time.split(':').map(Number);
  return format(new Date(2000, 0, 1, hours, minutes), 'h:mm a', { locale: getDateLocale(language) });
}
