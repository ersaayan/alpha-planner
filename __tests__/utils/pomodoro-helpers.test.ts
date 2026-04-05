import { getPhaseDuration, getNextPhase } from '@/utils/pomodoro-helpers';
import type { PomodoroSettings } from '@/types';

const mockSettings: PomodoroSettings = {
  focusDuration: 25 * 60,
  shortBreakDuration: 5 * 60,
  longBreakDuration: 15 * 60,
  sessionsUntilLongBreak: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  notificationSound: 'default',
  vibrationEnabled: true,
  tickingSoundEnabled: false,
  keepScreenAwake: true,
};

describe('getPhaseDuration', () => {
  it('returns focusDuration for focus phase', () => {
    expect(getPhaseDuration('focus', mockSettings)).toBe(25 * 60);
  });

  it('returns shortBreakDuration for short_break phase', () => {
    expect(getPhaseDuration('short_break', mockSettings)).toBe(5 * 60);
  });

  it('returns longBreakDuration for long_break phase', () => {
    expect(getPhaseDuration('long_break', mockSettings)).toBe(15 * 60);
  });

  it('returns 0 for idle phase', () => {
    expect(getPhaseDuration('idle', mockSettings)).toBe(0);
  });

  it('respects custom durations', () => {
    const custom: PomodoroSettings = {
      ...mockSettings,
      focusDuration: 50 * 60,
      shortBreakDuration: 10 * 60,
      longBreakDuration: 30 * 60,
    };
    expect(getPhaseDuration('focus', custom)).toBe(50 * 60);
    expect(getPhaseDuration('short_break', custom)).toBe(10 * 60);
    expect(getPhaseDuration('long_break', custom)).toBe(30 * 60);
  });
});

describe('getNextPhase', () => {
  it('focus -> short_break when not at long break boundary', () => {
    // sessionsCompleted=1 is not divisible by 4
    expect(getNextPhase('focus', 1, mockSettings)).toBe('short_break');
    expect(getNextPhase('focus', 2, mockSettings)).toBe('short_break');
    expect(getNextPhase('focus', 3, mockSettings)).toBe('short_break');
  });

  it('focus -> long_break at sessionsUntilLongBreak boundary', () => {
    // sessionsCompleted=4 is divisible by 4
    expect(getNextPhase('focus', 4, mockSettings)).toBe('long_break');
    expect(getNextPhase('focus', 8, mockSettings)).toBe('long_break');
  });

  it('focus -> short_break when sessionsCompleted is 0', () => {
    // 0 is divisible by 4 but the condition requires > 0
    expect(getNextPhase('focus', 0, mockSettings)).toBe('short_break');
  });

  it('short_break -> focus', () => {
    expect(getNextPhase('short_break', 1, mockSettings)).toBe('focus');
    expect(getNextPhase('short_break', 3, mockSettings)).toBe('focus');
  });

  it('long_break -> focus', () => {
    expect(getNextPhase('long_break', 4, mockSettings)).toBe('focus');
    expect(getNextPhase('long_break', 8, mockSettings)).toBe('focus');
  });

  it('idle -> focus', () => {
    expect(getNextPhase('idle', 0, mockSettings)).toBe('focus');
  });

  it('works with custom sessionsUntilLongBreak', () => {
    const custom: PomodoroSettings = { ...mockSettings, sessionsUntilLongBreak: 2 };
    expect(getNextPhase('focus', 2, custom)).toBe('long_break');
    expect(getNextPhase('focus', 1, custom)).toBe('short_break');
    expect(getNextPhase('focus', 4, custom)).toBe('long_break');
  });
});
