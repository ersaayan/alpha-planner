import { formatDate } from '@/utils/date';

describe('formatDate', () => {
  it('formats as MM/DD/YYYY', () => {
    const date = new Date(2025, 0, 15); // January 15, 2025
    expect(formatDate(date, 'MM/DD/YYYY')).toBe('01/15/2025');
  });

  it('formats as DD/MM/YYYY', () => {
    const date = new Date(2025, 0, 15); // January 15, 2025
    expect(formatDate(date, 'DD/MM/YYYY')).toBe('15/01/2025');
  });

  it('formats as YYYY-MM-DD', () => {
    const date = new Date(2025, 0, 15); // January 15, 2025
    expect(formatDate(date, 'YYYY-MM-DD')).toBe('2025-01-15');
  });

  it('handles different date values', () => {
    const date = new Date(2024, 11, 31); // December 31, 2024
    expect(formatDate(date, 'MM/DD/YYYY')).toBe('12/31/2024');
    expect(formatDate(date, 'DD/MM/YYYY')).toBe('31/12/2024');
    expect(formatDate(date, 'YYYY-MM-DD')).toBe('2024-12-31');
  });

  it('uses DD/MM/YYYY as default format', () => {
    const date = new Date(2025, 5, 10); // June 10, 2025
    // When an unrecognized format is passed, it falls through to default (DD/MM/YYYY)
    expect(formatDate(date, 'DD/MM/YYYY')).toBe('10/06/2025');
  });

  it('returns empty string for invalid date', () => {
    const invalid = new Date('not-a-date');
    expect(formatDate(invalid, 'MM/DD/YYYY')).toBe('');
    expect(formatDate(invalid, 'DD/MM/YYYY')).toBe('');
    expect(formatDate(invalid, 'YYYY-MM-DD')).toBe('');
  });

  it('zero-pads single-digit months and days', () => {
    const date = new Date(2025, 2, 5); // March 5, 2025
    expect(formatDate(date, 'MM/DD/YYYY')).toBe('03/05/2025');
    expect(formatDate(date, 'DD/MM/YYYY')).toBe('05/03/2025');
    expect(formatDate(date, 'YYYY-MM-DD')).toBe('2025-03-05');
  });

  it('handles leap year date', () => {
    const date = new Date(2024, 1, 29); // Feb 29, 2024
    expect(formatDate(date, 'MM/DD/YYYY')).toBe('02/29/2024');
    expect(formatDate(date, 'DD/MM/YYYY')).toBe('29/02/2024');
  });
});
