import { NativeDateService } from '@ui-kitten/components';
import type { AppSettings } from '@/types';
import { getDateLocale } from '@/utils/locale';

type Days = [string, string, string, string, string, string, string];
type Months = [string, string, string, string, string, string, string, string, string, string, string, string];

function names<T extends string[]>(count: number, name: (index: number) => string): T {
  return Array.from({ length: count }, (_, index) => name(index)) as T;
}

/**
 * The date service for UI Kitten's Datepicker/Calendar: month and day names in the app
 * language (from date-fns, like the rest of the app), the chosen first day of the week,
 * and the user's date format for the input text.
 */
export function createDateService(
  language: string | undefined,
  startDayOfWeek: 0 | 1,
  dateFormat: AppSettings['dateFormat'] = 'DD/MM/YYYY'
): NativeDateService {
  const { localize } = getDateLocale(language);
  const month = (width: 'abbreviated' | 'wide') => (index: number) => localize.month(index as never, { width });
  const day = (width: 'abbreviated' | 'wide') => (index: number) => localize.day(index as never, { width });
  return new NativeDateService(language?.startsWith('tr') ? 'tr' : 'en', {
    startDayOfWeek,
    // fecha tokens; the settings use the same spelling (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD).
    format: dateFormat,
    i18n: {
      dayNames: { short: names<Days>(7, day('abbreviated')), long: names<Days>(7, day('wide')) },
      monthNames: { short: names<Months>(12, month('abbreviated')), long: names<Months>(12, month('wide')) },
    },
  });
}
