import {
  ALERT_CHAIN_LIMIT,
  formatClock,
  getNextPhase,
  getPhaseDuration,
  getPhaseEndMs,
  getRemainingSeconds,
  planAlerts,
  reconcileTimer,
  sanitizeTimerState,
} from '@/utils/pomodoro-helpers';
import type { PomodoroSettings, PomodoroTimerState } from '@/types';
import { INITIAL_TIMER_STATE } from '@/types';

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

  it('treats idle as "ready to focus"', () => {
    expect(getPhaseDuration('idle', mockSettings)).toBe(25 * 60);
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

const NOW = 1_700_000_000_000;
const MIN = 60_000;
const running = (overrides: Partial<PomodoroTimerState> = {}): PomodoroTimerState => ({
  ...INITIAL_TIMER_STATE,
  phase: 'focus',
  state: 'running',
  totalTime: 1500,
  remainingTime: 1500,
  startedAt: NOW,
  ...overrides,
});
const autoBoth: PomodoroSettings = { ...mockSettings, autoStartBreaks: true, autoStartFocus: true };

describe('remaining time', () => {
  it('derives the end from startedAt, totalTime and pauses', () => {
    expect(getPhaseEndMs(running({ totalPausedDuration: 60 }))).toBe(NOW + 26 * MIN);
    expect(getPhaseEndMs({ ...INITIAL_TIMER_STATE })).toBeNull();
  });

  it('rounds up so a fresh phase shows its full length', () => {
    expect(getRemainingSeconds(running(), NOW)).toBe(1500);
    expect(getRemainingSeconds(running(), NOW + 400)).toBe(1500);
    expect(getRemainingSeconds(running(), NOW + 1000)).toBe(1499);
  });

  it('clamps to [0, totalTime] (clock moved back, or past the end)', () => {
    expect(getRemainingSeconds(running(), NOW - 60 * MIN)).toBe(1500);
    expect(getRemainingSeconds(running(), NOW + 60 * MIN)).toBe(0);
  });

  it('freezes at the pause moment while paused', () => {
    const paused = running({ state: 'paused', pausedAt: NOW + 10 * MIN });
    expect(getRemainingSeconds(paused, NOW + 50 * MIN)).toBe(900);
  });

  it('ignores a negative pause total', () => {
    expect(getPhaseEndMs(running({ totalPausedDuration: -300 }))).toBe(NOW + 25 * MIN);
  });

  it('formats MM:SS', () => {
    expect(formatClock(1500)).toBe('25:00');
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(-3)).toBe('00:00');
  });
});

describe('reconcileTimer', () => {
  it('never reads remainingTime', () => {
    const result = reconcileTimer(running({ remainingTime: 1 }), mockSettings, NOW + 20 * MIN);
    expect(result.completed).toEqual([]);
    expect(result.timer.state).toBe('running');
  });

  it('completes an ended phase once and waits for a manual start', () => {
    const result = reconcileTimer(running(), mockSettings, NOW + 30 * MIN);
    expect(result.completed).toEqual([
      { phase: 'focus', startedAt: NOW, completedAt: NOW + 25 * MIN, totalTime: 1500, pausedSeconds: 0, chainIndex: 0 },
    ]);
    expect(result.timer).toMatchObject({ state: 'stopped', phase: 'short_break', totalTime: 300, sessionsCompleted: 1 });
    expect(reconcileTimer(result.timer, mockSettings, NOW + 30 * MIN).completed).toEqual([]);
  });

  it('continues an auto-start chain from the previous end', () => {
    const result = reconcileTimer(running(), autoBoth, NOW + 31 * MIN);
    expect(result.completed.map((c) => c.phase)).toEqual(['focus', 'short_break']);
    expect(result.timer).toMatchObject({ state: 'running', phase: 'focus', startedAt: NOW + 30 * MIN, chainIndex: 2 });
  });

  it('stops after the chain limit', () => {
    const result = reconcileTimer(running(), autoBoth, NOW + 24 * 60 * MIN);
    expect(result.completed).toHaveLength(ALERT_CHAIN_LIMIT);
    expect(result.timer).toMatchObject({ state: 'stopped', phase: 'focus', chainIndex: 0, sessionsCompleted: 4 });
  });

  it('counts the chain from the timer position', () => {
    const result = reconcileTimer(running({ chainIndex: 6 }), autoBoth, NOW + 24 * 60 * MIN);
    expect(result.completed).toHaveLength(2);
  });
});

describe('planAlerts', () => {
  it('plans only the running phase without auto-start', () => {
    expect(planAlerts(running(), mockSettings)).toEqual([
      { chainIndex: 0, phase: 'focus', endMs: NOW + 25 * MIN, nextPhase: 'short_break', continues: false, chainLimitReached: false },
    ]);
  });

  it('plans the chain up to the next manual start', () => {
    const plan = planAlerts(running(), { ...mockSettings, autoStartBreaks: true });
    expect(plan.map((a) => [a.phase, a.endMs])).toEqual([
      ['focus', NOW + 25 * MIN],
      ['short_break', NOW + 30 * MIN],
    ]);
  });

  it('plans at most ALERT_CHAIN_LIMIT alerts and flags the last one', () => {
    const plan = planAlerts(running(), autoBoth);
    expect(plan).toHaveLength(ALERT_CHAIN_LIMIT);
    expect(plan.map((a) => a.chainIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(plan[7]).toMatchObject({ phase: 'long_break', continues: false, chainLimitReached: true });
    expect(plan[7].endMs).toBe(NOW + (4 * 25 + 3 * 5 + 15) * MIN);
  });

  it('is empty unless running', () => {
    expect(planAlerts(running({ state: 'paused', pausedAt: NOW }), autoBoth)).toEqual([]);
    expect(planAlerts({ ...INITIAL_TIMER_STATE }, autoBoth)).toEqual([]);
  });

  it('agrees with reconcileTimer on every phase end', () => {
    const plan = planAlerts(running(), autoBoth);
    const done = reconcileTimer(running(), autoBoth, NOW + 24 * 60 * MIN).completed;
    expect(done.map((c) => c.completedAt)).toEqual(plan.map((a) => a.endMs));
  });
});

describe('sanitizeTimerState', () => {
  it('fills defaults for garbage', () => {
    expect(sanitizeTimerState(undefined)).toEqual(INITIAL_TIMER_STATE);
    expect(sanitizeTimerState({ state: 'weird', phase: 'nap', totalTime: -1 })).toEqual(INITIAL_TIMER_STATE);
  });

  it('keeps a valid running timer', () => {
    expect(sanitizeTimerState(running({ chainIndex: 3 }))).toEqual(running({ chainIndex: 3 }));
  });

  it('clamps chainIndex into the chain', () => {
    expect(sanitizeTimerState(running({ chainIndex: 99 })).chainIndex).toBe(ALERT_CHAIN_LIMIT - 1);
  });
});
