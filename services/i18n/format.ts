import type { TFunction } from 'i18next';

/** A duration in words: "1h 25m" / "1sa 25dk", or "25m" / "25dk" under an hour. */
export function formatDuration(t: TFunction, seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? t('summary.hoursMinutes', { hours, minutes }) : t('stats.minutesValue', { minutes });
}
