import { getDateKey } from '@/utils/date';

describe('getDateKey', () => {
  it('returns yyyy-MM-dd format for a specific date', () => {
    const date = new Date(2025, 0, 15); // January 15, 2025
    expect(getDateKey(date)).toBe('2025-01-15');
  });

  it('zero-pads single-digit months and days', () => {
    const date = new Date(2025, 2, 5); // March 5, 2025
    expect(getDateKey(date)).toBe('2025-03-05');
  });

  it('handles end of year correctly', () => {
    const date = new Date(2025, 11, 31); // December 31, 2025
    expect(getDateKey(date)).toBe('2025-12-31');
  });

  it('handles start of year correctly', () => {
    const date = new Date(2025, 0, 1); // January 1, 2025
    expect(getDateKey(date)).toBe('2025-01-01');
  });

  it('returns a string matching yyyy-MM-dd pattern when called with default (no args)', () => {
    const result = getDateKey();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('handles double-digit months and days', () => {
    const date = new Date(2025, 10, 25); // November 25, 2025
    expect(getDateKey(date)).toBe('2025-11-25');
  });

  it('handles Feb 28 in a non-leap year', () => {
    const date = new Date(2025, 1, 28); // Feb 28, 2025
    expect(getDateKey(date)).toBe('2025-02-28');
  });

  it('handles Feb 29 in a leap year', () => {
    const date = new Date(2024, 1, 29); // Feb 29, 2024
    expect(getDateKey(date)).toBe('2024-02-29');
  });

  it('returns a 10-character string', () => {
    const date = new Date(2025, 5, 10);
    expect(getDateKey(date)).toHaveLength(10);
  });

  it('returns today when called without arguments', () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    expect(getDateKey()).toBe(`${y}-${m}-${d}`);
  });
});
