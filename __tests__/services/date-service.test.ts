import { TranslationWidth } from '@ui-kitten/components';
import { createDateService } from '@/services/i18n/date-service';

describe('createDateService (Datepicker)', () => {
  it('names months and days in Turkish, Monday first', () => {
    const service = createDateService('tr', 1);
    expect(service.getMonthName(new Date(2026, 1, 1), TranslationWidth.LONG)).toBe('Şubat');
    expect(service.getDayOfWeekNames(TranslationWidth.SHORT)[0]).toBe('Pzt');
    expect(service.getFirstDayOfWeek()).toBe(1);
  });

  it('names months and days in English, Sunday first', () => {
    const service = createDateService('en', 0);
    expect(service.getMonthName(new Date(2026, 9, 1), TranslationWidth.LONG)).toBe('October');
    expect(service.getDayOfWeekNames(TranslationWidth.SHORT)[0]).toBe('Sun');
  });

  it('formats the input with the user date format', () => {
    const date = new Date(2026, 9, 7);
    expect(createDateService('en', 0, 'MM/DD/YYYY').format(date, null as never)).toBe('10/07/2026');
    expect(createDateService('tr', 1, 'YYYY-MM-DD').format(date, null as never)).toBe('2026-10-07');
    expect(createDateService('tr', 1).format(date, null as never)).toBe('07/10/2026');
  });
});
