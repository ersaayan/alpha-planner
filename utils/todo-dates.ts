import { getDateKey } from './date';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
  if (!dueTime) return false;
  const [hours, minutes] = dueTime.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return false;
  return at.getHours() * 60 + at.getMinutes() > hours * 60 + minutes;
}
