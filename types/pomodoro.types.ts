export type PomodoroPhase = 'focus' | 'short_break' | 'long_break' | 'idle';
export type PomodoroState = 'running' | 'paused' | 'stopped';

export interface PomodoroSession {
  id: string;
  todoId: string | null;
  phase: PomodoroPhase;
  startedAt: string;
  endedAt: string | null;
  pausedDuration: number;
  wasCompleted: boolean;
  duration: number;
  targetDuration: number;
}

export interface PomodoroSettings {
  focusDuration: number; // seconds
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsUntilLongBreak: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  notificationSound: string;
  vibrationEnabled: boolean;
  tickingSoundEnabled: boolean;
  keepScreenAwake: boolean;
}

/**
 * Persisted timer state. A running phase is defined only by timestamps:
 * it ends at `startedAt + (totalTime + totalPausedDuration) * 1000`.
 * Use the helpers in `utils/pomodoro-helpers.ts` to derive remaining time.
 */
export interface PomodoroTimerState {
  phase: PomodoroPhase;
  state: PomodoroState;
  /**
   * Remaining seconds at the last state change (start, pause, resume, phase change).
   * Not updated while running; never use it to decide whether a phase has ended.
   */
  remainingTime: number;
  /** Length of the current phase in seconds, fixed when the phase starts. */
  totalTime: number;
  sessionsCompleted: number;
  currentSessionId: string | null;
  linkedTodoId: string | null;
  /** Epoch ms when the current phase started. */
  startedAt: number | null;
  /** Epoch ms when the timer was paused, while paused. */
  pausedAt: number | null;
  /** Seconds spent paused during the current phase (may be fractional). */
  totalPausedDuration: number;
  /**
   * Position of the current phase in the auto-start chain: 0 when the user started or
   * resumed it, +1 for each phase that started automatically after it. Caps unattended
   * auto-starts and maps to the phase-end alert identifiers.
   */
  chainIndex: number;
}

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
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

export const INITIAL_TIMER_STATE: PomodoroTimerState = {
  phase: 'idle',
  state: 'stopped',
  remainingTime: 25 * 60,
  totalTime: 25 * 60,
  sessionsCompleted: 0,
  currentSessionId: null,
  linkedTodoId: null,
  startedAt: null,
  pausedAt: null,
  totalPausedDuration: 0,
  chainIndex: 0,
};
