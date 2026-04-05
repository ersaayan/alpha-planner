jest.mock('@/stores/settings-store', () => ({
  useSettingsStore: {
    getState: jest.fn(() => ({
      pomodoroSettings: {
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
      },
      settings: {
        notificationsEnabled: false,
        soundEnabled: true,
      },
    })),
    setState: jest.fn(),
  },
}));

jest.mock('@/stores/gamification-store', () => ({
  useGamificationStore: {
    getState: jest.fn(() => ({
      incrementPomodoro: jest.fn(),
      resetSessionCombo: jest.fn(),
    })),
    setState: jest.fn(),
  },
}));

jest.mock('@/stores/todo-store', () => ({
  useTodoStore: {
    getState: jest.fn(() => ({
      todos: [],
      filter: {},
      incrementPomodoroCount: jest.fn(),
    })),
    setState: jest.fn(),
  },
}));

jest.mock('@/stores/sync-store', () => ({
  useSyncStore: {
    getState: jest.fn(() => ({ enqueue: jest.fn() })),
  },
}));

jest.mock('react-native', () => ({
  AppState: { currentState: 'active' },
}));

import { scheduleTimerNotification, cancelScheduledTimerNotifications, registerPomodoroBackgroundTask, unregisterPomodoroBackgroundTask } from '@/services/background';
import { notificationService } from '@/services/notifications';
import { usePomodoroStore } from '@/stores/pomodoro-store';
import { useGamificationStore } from '@/stores/gamification-store';
import { useTodoStore } from '@/stores/todo-store';
import { useSettingsStore } from '@/stores/settings-store';
import { INITIAL_TIMER_STATE } from '@/types';

const INITIAL_STATE = {
  timer: { ...INITIAL_TIMER_STATE },
  sessions: [],
  currentSession: null,
};

beforeEach(() => {
  usePomodoroStore.setState(INITIAL_STATE);
  jest.clearAllMocks();
  jest.useRealTimers();
});

afterEach(() => {
  // Stop any running timer to prevent leaked intervals
  try {
    const { timer, _stopTicking } = usePomodoroStore.getState();
    _stopTicking();
  } catch {
    // best-effort cleanup
  }
});

describe('usePomodoroStore', () => {
  // ── initial state ─────────────────────────────────────────────────────

  it('initial state matches INITIAL_TIMER_STATE', () => {
    const { timer, sessions, currentSession } = usePomodoroStore.getState();
    expect(timer.phase).toBe('idle');
    expect(timer.state).toBe('stopped');
    expect(timer.remainingTime).toBe(25 * 60);
    expect(timer.sessionsCompleted).toBe(0);
    expect(sessions).toEqual([]);
    expect(currentSession).toBeNull();
  });

  // ── startTimer ────────────────────────────────────────────────────────

  it('startTimer: transitions from idle/stopped to running/focus', () => {
    usePomodoroStore.getState().startTimer();

    const { timer, currentSession } = usePomodoroStore.getState();
    expect(timer.state).toBe('running');
    expect(timer.phase).toBe('focus');
    expect(timer.totalTime).toBe(25 * 60);
    expect(timer.startedAt).toBeDefined();
    expect(currentSession).not.toBeNull();
    expect(currentSession?.phase).toBe('focus');
  });

  it('startTimer: links provided todoId', () => {
    usePomodoroStore.getState().startTimer('todo-123');

    const { timer, currentSession } = usePomodoroStore.getState();
    expect(timer.linkedTodoId).toBe('todo-123');
    expect(currentSession?.todoId).toBe('todo-123');
  });

  it('startTimer: prevents double-start', () => {
    usePomodoroStore.getState().startTimer();
    const firstSessionId = usePomodoroStore.getState().timer.currentSessionId;

    usePomodoroStore.getState().startTimer();
    const secondSessionId = usePomodoroStore.getState().timer.currentSessionId;

    expect(secondSessionId).toBe(firstSessionId);
  });

  // ── pauseTimer ────────────────────────────────────────────────────────

  it('pauseTimer: transitions from running to paused', () => {
    usePomodoroStore.getState().startTimer();
    usePomodoroStore.getState().pauseTimer();

    const { timer } = usePomodoroStore.getState();
    expect(timer.state).toBe('paused');
    expect(timer.pausedAt).toBeDefined();
  });

  it('pauseTimer: is no-op when not running', () => {
    usePomodoroStore.getState().pauseTimer();
    expect(usePomodoroStore.getState().timer.state).toBe('stopped');
  });

  // ── resumeTimer ───────────────────────────────────────────────────────

  it('resumeTimer: transitions from paused back to running', () => {
    usePomodoroStore.getState().startTimer();
    usePomodoroStore.getState().pauseTimer();
    usePomodoroStore.getState().resumeTimer();

    const { timer } = usePomodoroStore.getState();
    expect(timer.state).toBe('running');
    expect(timer.pausedAt).toBeNull();
  });

  // ── stopTimer ─────────────────────────────────────────────────────────

  it('stopTimer: resets to stopped state', () => {
    usePomodoroStore.getState().startTimer();
    usePomodoroStore.getState().stopTimer();

    const { timer, currentSession } = usePomodoroStore.getState();
    expect(timer.state).toBe('stopped');
    expect(currentSession).toBeNull();
  });

  it('stopTimer: saves current session to sessions array', () => {
    usePomodoroStore.getState().startTimer();
    expect(usePomodoroStore.getState().currentSession).not.toBeNull();

    usePomodoroStore.getState().stopTimer();

    const { sessions } = usePomodoroStore.getState();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].endedAt).toBeDefined();
  });

  // ── resetTimer ────────────────────────────────────────────────────────

  it('resetTimer: resets to initial state with correct focus duration', () => {
    usePomodoroStore.getState().startTimer();
    usePomodoroStore.getState().resetTimer();

    const { timer, currentSession } = usePomodoroStore.getState();
    expect(timer.phase).toBe('idle');
    expect(timer.state).toBe('stopped');
    expect(timer.remainingTime).toBe(25 * 60);
    expect(timer.totalTime).toBe(25 * 60);
    expect(currentSession).toBeNull();
  });

  // ── tick ──────────────────────────────────────────────────────────────

  it('tick: is no-op when not running (stops ticking)', () => {
    // timer is stopped by default
    usePomodoroStore.getState().tick();
    expect(usePomodoroStore.getState().timer.state).toBe('stopped');
  });

  // ── setPhase ──────────────────────────────────────────────────────────

  it('setPhase: changes phase and sets correct duration', () => {
    usePomodoroStore.getState().setPhase('short_break');

    const { timer } = usePomodoroStore.getState();
    expect(timer.phase).toBe('short_break');
    expect(timer.remainingTime).toBe(5 * 60);
    expect(timer.totalTime).toBe(5 * 60);
    expect(timer.state).toBe('stopped');
  });

  it('setPhase: sets long_break with correct duration', () => {
    usePomodoroStore.getState().setPhase('long_break');

    const { timer } = usePomodoroStore.getState();
    expect(timer.phase).toBe('long_break');
    expect(timer.remainingTime).toBe(15 * 60);
  });

  // ── skipToNextPhase ───────────────────────────────────────────────────

  it('skipToNextPhase: focus -> short_break', () => {
    usePomodoroStore.getState().startTimer();
    usePomodoroStore.getState().skipToNextPhase();

    const { timer } = usePomodoroStore.getState();
    expect(timer.phase).toBe('short_break');
    expect(timer.state).toBe('stopped');
    expect(timer.sessionsCompleted).toBe(1);
  });

  it('skipToNextPhase: short_break -> focus', () => {
    usePomodoroStore.setState({
      ...INITIAL_STATE,
      timer: { ...INITIAL_TIMER_STATE, phase: 'short_break', state: 'running', sessionsCompleted: 1, startedAt: Date.now() },
    });

    usePomodoroStore.getState().skipToNextPhase();

    expect(usePomodoroStore.getState().timer.phase).toBe('focus');
  });

  // ── linkTodo ──────────────────────────────────────────────────────────

  it('linkTodo: updates linkedTodoId', () => {
    usePomodoroStore.getState().linkTodo('todo-456');
    expect(usePomodoroStore.getState().timer.linkedTodoId).toBe('todo-456');
  });

  it('linkTodo: clears linkedTodoId with null', () => {
    usePomodoroStore.getState().linkTodo('todo-456');
    usePomodoroStore.getState().linkTodo(null);
    expect(usePomodoroStore.getState().timer.linkedTodoId).toBeNull();
  });

  // ── getProgress ───────────────────────────────────────────────────────

  it('getProgress: returns 0 at start', () => {
    expect(usePomodoroStore.getState().getProgress()).toBe(0);
  });

  it('getProgress: returns correct fraction', () => {
    usePomodoroStore.setState({
      ...INITIAL_STATE,
      timer: { ...INITIAL_TIMER_STATE, remainingTime: 750, totalTime: 1500 },
    });
    expect(usePomodoroStore.getState().getProgress()).toBe(0.5);
  });

  it('getProgress: returns 0 when totalTime is 0', () => {
    usePomodoroStore.setState({
      ...INITIAL_STATE,
      timer: { ...INITIAL_TIMER_STATE, remainingTime: 0, totalTime: 0 },
    });
    expect(usePomodoroStore.getState().getProgress()).toBe(0);
  });

  // ── formatTime ────────────────────────────────────────────────────────

  it('formatTime: formats 25:00 correctly', () => {
    expect(usePomodoroStore.getState().formatTime()).toBe('25:00');
  });

  it('formatTime: formats single-digit seconds with leading zero', () => {
    usePomodoroStore.setState({
      ...INITIAL_STATE,
      timer: { ...INITIAL_TIMER_STATE, remainingTime: 65 },
    });
    expect(usePomodoroStore.getState().formatTime()).toBe('01:05');
  });

  it('formatTime: formats 0 seconds as 00:00', () => {
    usePomodoroStore.setState({
      ...INITIAL_STATE,
      timer: { ...INITIAL_TIMER_STATE, remainingTime: 0 },
    });
    expect(usePomodoroStore.getState().formatTime()).toBe('00:00');
  });

  // ── applySettingsToTimer ──────────────────────────────────────────────

  it('applySettingsToTimer: updates remaining/total time when stopped', () => {
    usePomodoroStore.setState({
      ...INITIAL_STATE,
      timer: { ...INITIAL_TIMER_STATE, phase: 'focus', state: 'stopped', remainingTime: 100, totalTime: 100 },
    });

    usePomodoroStore.getState().applySettingsToTimer({
      focusDuration: 30 * 60,
      shortBreakDuration: 5 * 60,
      longBreakDuration: 15 * 60,
      sessionsUntilLongBreak: 4,
      autoStartBreaks: false,
      autoStartFocus: false,
      notificationSound: 'default',
      vibrationEnabled: true,
      tickingSoundEnabled: false,
      keepScreenAwake: true,
    });

    const { timer } = usePomodoroStore.getState();
    expect(timer.remainingTime).toBe(30 * 60);
    expect(timer.totalTime).toBe(30 * 60);
  });

  it('applySettingsToTimer: is no-op when timer is running', () => {
    usePomodoroStore.getState().startTimer();
    const before = usePomodoroStore.getState().timer.totalTime;

    usePomodoroStore.getState().applySettingsToTimer({
      focusDuration: 45 * 60,
      shortBreakDuration: 5 * 60,
      longBreakDuration: 15 * 60,
      sessionsUntilLongBreak: 4,
      autoStartBreaks: false,
      autoStartFocus: false,
      notificationSound: 'default',
      vibrationEnabled: true,
      tickingSoundEnabled: false,
      keepScreenAwake: true,
    });

    expect(usePomodoroStore.getState().timer.totalTime).toBe(before);
  });

  it('applySettingsToTimer: handles idle phase as focus', () => {
    // Timer starts in idle phase by default
    expect(usePomodoroStore.getState().timer.phase).toBe('idle');

    usePomodoroStore.getState().applySettingsToTimer({
      focusDuration: 50 * 60,
      shortBreakDuration: 5 * 60,
      longBreakDuration: 15 * 60,
      sessionsUntilLongBreak: 4,
      autoStartBreaks: false,
      autoStartFocus: false,
      notificationSound: 'default',
      vibrationEnabled: true,
      tickingSoundEnabled: false,
      keepScreenAwake: true,
    });

    const { timer } = usePomodoroStore.getState();
    expect(timer.remainingTime).toBe(50 * 60);
    expect(timer.totalTime).toBe(50 * 60);
  });

  // ── completeSession ───────────────────────────────────────────────────

  it('completeSession: is no-op when no currentSession', () => {
    usePomodoroStore.getState().completeSession();
    // Should not throw and sessions should remain empty
    expect(usePomodoroStore.getState().sessions).toEqual([]);
  });
});
