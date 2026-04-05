import { getPriorityColor, formatTime, formatDuration } from '@/utils/theme-helpers';
import { Colors } from '@/constants/theme';

describe('getPriorityColor', () => {
  it('returns error color for urgent priority (light)', () => {
    expect(getPriorityColor('urgent', 'light')).toBe(Colors.light.error);
  });

  it('returns warning color for high priority (light)', () => {
    expect(getPriorityColor('high', 'light')).toBe(Colors.light.warning);
  });

  it('returns info color for medium priority (light)', () => {
    expect(getPriorityColor('medium', 'light')).toBe(Colors.light.info);
  });

  it('returns success color for low priority (light)', () => {
    expect(getPriorityColor('low', 'light')).toBe(Colors.light.success);
  });

  it('returns textSecondary for unknown priority (light)', () => {
    expect(getPriorityColor('none', 'light')).toBe(Colors.light.textSecondary);
  });

  it('defaults to light color scheme when omitted', () => {
    expect(getPriorityColor('urgent')).toBe(Colors.light.error);
  });

  it('returns dark theme colors when dark scheme is specified', () => {
    expect(getPriorityColor('urgent', 'dark')).toBe(Colors.dark.error);
    expect(getPriorityColor('low', 'dark')).toBe(Colors.dark.success);
  });
});

describe('formatTime', () => {
  it('formats 0 seconds as 00:00', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  it('formats 65 seconds as 01:05', () => {
    expect(formatTime(65)).toBe('01:05');
  });

  it('formats 3600 seconds as 60:00', () => {
    expect(formatTime(3600)).toBe('60:00');
  });

  it('formats 59 seconds as 00:59', () => {
    expect(formatTime(59)).toBe('00:59');
  });

  it('formats 1500 seconds (25 min) as 25:00', () => {
    expect(formatTime(1500)).toBe('25:00');
  });
});

describe('formatDuration', () => {
  it('formats 0 seconds as 0m', () => {
    expect(formatDuration(0)).toBe('0m');
  });

  it('formats 90 seconds as 1m (floors to minutes)', () => {
    expect(formatDuration(90)).toBe('1m');
  });

  it('formats 3661 seconds as 1h 1m', () => {
    expect(formatDuration(3661)).toBe('1h 1m');
  });

  it('formats 3600 seconds as 1h 0m', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
  });

  it('formats 7200 seconds as 2h 0m', () => {
    expect(formatDuration(7200)).toBe('2h 0m');
  });
});
