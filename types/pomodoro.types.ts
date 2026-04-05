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

export interface PomodoroTimerState {
  phase: PomodoroPhase;
  state: PomodoroState;
  remainingTime: number;
  totalTime: number;
  sessionsCompleted: number;
  currentSessionId: string | null;
  linkedTodoId: string | null;
  startedAt: number | null;
  pausedAt: number | null;
  totalPausedDuration: number;
  notificationId: string | null;
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
  notificationId: null,
};
