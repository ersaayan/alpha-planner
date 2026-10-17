import { format, type Locale } from 'date-fns';
import { enUS, tr } from 'date-fns/locale';
import { parseDateKey } from './date';

/** The date-fns locale for an app language ('tr' or anything else → English). */
export function getDateLocale(language: string | undefined): Locale {
  return language?.startsWith('tr') ? tr : enUS;
}

/** First day of the week for the language: Monday for Turkish, Sunday for (US) English. */
export function getLocaleWeekStart(language: string | undefined): 0 | 1 {
  return (getDateLocale(language).options?.weekStartsOn ?? 0) === 1 ? 1 : 0;
}

/** The first day of the week: the user's choice, or the language's convention for 'auto'. */
export function resolveWeekStart(setting: 0 | 1 | 'auto' | undefined, language: string | undefined): 0 | 1 {
  return setting === 0 || setting === 1 ? setting : getLocaleWeekStart(language);
}

/** "October 2026" / "Ekim 2026" for a `yyyy-MM` month key. */
export function formatMonthKey(month: string, language: string | undefined): string {
  return format(parseDateKey(`${month}-01`), 'LLLL yyyy', { locale: getDateLocale(language) });
}

/** A localized date with a date-fns pattern. */
export function formatLocalized(date: Date, pattern: string, language: string | undefined): string {
  return format(date, pattern, { locale: getDateLocale(language) });
}
