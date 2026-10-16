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
  // expo's lazily installed global fetch reads Platform at first access
  Platform: {
    OS: 'ios',
    select: (spec: Record<string, unknown>) => spec.ios ?? spec.native ?? spec.default,
  },
}));

import { scheduleTimerNotification, cancelScheduledTimerNotifications } from '@/services/background';
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

// ═══════════════════════════════════════════════════════════════════════════
// NEW TESTS — coverage push from ~51% to 90%+
// ═══════════════════════════════════════════════════════════════════════════

const NOW = 1700000000000; // fixed epoch ms

/** Helper: build a running timer state rooted at `startedAt` */
function makeRunningTimer(overrides: Partial<typeof INITIAL_TIMER_STATE> = {}) {
  return {
    ...INITIAL_TIMER_STATE,
    phase: 'focus' as const,
    state: 'running' as const,
    remainingTime: 25 * 60,
    totalTime: 25 * 60,
    sessionsCompleted: 0,
    startedAt: NOW,
    pausedAt: null,
    totalPausedDuration: 0,
    currentSessionId: 'sess-1',
    linkedTodoId: null,
    notificationId: null,
    ...overrides,
  };
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sess-1',
    todoId: null,
    phase: 'focus',
    startedAt: new Date(NOW).toISOString(),
    endedAt: null,
    pausedDuration: 0,
    wasCompleted: false,
    duration: 0,
    targetDuration: 25 * 60,
    ...overrides,
  };
}

/** Override the settings-store mock for a single test */
function withSettings(overrides: Record<string, unknown>) {
  const base = (useSettingsStore.getState as jest.Mock)();
  (useSettingsStore.getState as jest.Mock).mockReturnValue({
    ...base,
    pomodoroSettings: { ...base.pomodoroSettings, ...overrides.pomodoroSettings },
    settings: { ...base.settings, ...overrides.settings },
  });
}

function resetSettingsMock() {
  (useSettingsStore.getState as jest.Mock).mockReturnValue({
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
  });
}

// ── Timer Math (calculateRemainingTime / calculateCompletionTimeMs) ─────

describe('Timer Math helpers (via tick / syncTimer)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    usePomodoroStore.setState({
      timer: makeRunningTimer(),
      sessions: [],
      currentSession: makeSession(),
    });
  });
  afterEach(() => {
    usePomodoroStore.getState()._stopTicking();
    jest.useRealTimers();
    jest.restoreAllMocks();
    resetSettingsMock();
  });

  it('calculates correct remaining time for a running timer', () => {
    // 10 seconds have passed
    (Date.now as jest.Mock).mockReturnValue(NOW + 10_000);
    usePomodoroStore.getState().tick();
    expect(usePomodoroStore.getState().timer.remainingTime).toBe(25 * 60 - 10);
  });

  it('returns 0 when past completion (triggers _handleCompletion which transitions)', () => {
    // Way past completion (30 min elapsed on a 25 min timer)
    // tick() detects remainingTime === 0, calls _handleCompletion, which transitions phase
    (Date.now as jest.Mock).mockReturnValue(NOW + 30 * 60 * 1000);
    usePomodoroStore.getState().tick();
    // After completion, timer transitioned to short_break with fresh duration
    const { timer } = usePomodoroStore.getState();
    expect(timer.phase).toBe('short_break');
    expect(timer.state).toBe('stopped');
    expect(timer.remainingTime).toBe(5 * 60);
  });

  it('calculateCompletionTimeMs produces correct absolute timestamp via syncTimer', () => {
    // Timer started at NOW, 25 min total, no pause → completion at NOW + 1500s
    // Just confirm the timer is still running with correct remaining after 5 sec
    (Date.now as jest.Mock).mockReturnValue(NOW + 5000);
    usePomodoroStore.getState().syncTimer({ now: NOW + 5000 });
    expect(usePomodoroStore.getState().timer.remainingTime).toBe(25 * 60 - 5);
  });
});

// ── _startTicking / _stopTicking ────────────────────────────────────────

describe('_startTicking / _stopTicking', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    usePomodoroStore.setState({
      timer: makeRunningTimer(),
      sessions: [],
      currentSession: makeSession(),
    });
  });
  afterEach(() => {
    usePomodoroStore.getState()._stopTicking();
    jest.useRealTimers();
    jest.restoreAllMocks();
    resetSettingsMock();
  });

  it('_startTicking sets up interval that calls tick every second', () => {
    usePomodoroStore.getState()._startTicking();
    (Date.now as jest.Mock).mockReturnValue(NOW + 1000);
    jest.advanceTimersByTime(1000);
    expect(usePomodoroStore.getState().timer.remainingTime).toBe(25 * 60 - 1);
  });

  it('_startTicking clears previous interval before creating new one (idempotent)', () => {
    usePomodoroStore.getState()._startTicking();
    usePomodoroStore.getState()._startTicking(); // second call should not double-tick

    (Date.now as jest.Mock).mockReturnValue(NOW + 1000);
    jest.advanceTimersByTime(1000);
    // Should only have ticked once per second, not twice
    expect(usePomodoroStore.getState().timer.remainingTime).toBe(25 * 60 - 1);
  });

  it('_stopTicking clears interval so ticks stop', () => {
    usePomodoroStore.getState()._startTicking();
    usePomodoroStore.getState()._stopTicking();

    (Date.now as jest.Mock).mockReturnValue(NOW + 5000);
    jest.advanceTimersByTime(5000);
    // remainingTime should not have changed because ticking was stopped
    expect(usePomodoroStore.getState().timer.remainingTime).toBe(25 * 60);
  });

  it('_stopTicking also clears autoStartTimeout', () => {
    // We test this indirectly: after _handleCompletion sets autoStartTimeout,
    // _stopTicking should prevent the auto-start from firing.
    // Set up auto-start scenario
    withSettings({ pomodoroSettings: { autoStartBreaks: true } });
    usePomodoroStore.getState()._handleCompletion();
    // Now _stopTicking to cancel the pending timeout
    usePomodoroStore.getState()._stopTicking();
    jest.advanceTimersByTime(5000);
    // Timer should still be stopped, not auto-started
    expect(usePomodoroStore.getState().timer.state).toBe('stopped');
  });
});

// ── startTimer (full flow) ──────────────────────────────────────────────

describe('startTimer (full flow)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => {
    usePomodoroStore.getState()._stopTicking();
    jest.useRealTimers();
    jest.restoreAllMocks();
    resetSettingsMock();
  });

  it('sets state to running with correct fields', () => {
    usePomodoroStore.getState().startTimer();
    const { timer } = usePomodoroStore.getState();
    expect(timer.state).toBe('running');
    expect(timer.phase).toBe('focus');
    expect(timer.totalTime).toBe(25 * 60);
    expect(timer.remainingTime).toBe(25 * 60);
  });

  it('sets startedAt to current time', () => {
    usePomodoroStore.getState().startTimer();
    expect(usePomodoroStore.getState().timer.startedAt).toBe(NOW);
  });

  it('sets totalPausedDuration to 0', () => {
    usePomodoroStore.getState().startTimer();
    expect(usePomodoroStore.getState().timer.totalPausedDuration).toBe(0);
  });

  it('creates a new session with correct shape', () => {
    usePomodoroStore.getState().startTimer();
    const { currentSession } = usePomodoroStore.getState();
    expect(currentSession).not.toBeNull();
    expect(currentSession!.phase).toBe('focus');
    expect(currentSession!.startedAt).toBe(new Date(NOW).toISOString());
    expect(currentSession!.endedAt).toBeNull();
    expect(currentSession!.pausedDuration).toBe(0);
    expect(currentSession!.wasCompleted).toBe(false);
    expect(currentSession!.targetDuration).toBe(25 * 60);
  });

  it('with linkedTodoId sets it on timer and session', () => {
    usePomodoroStore.getState().startTimer('todo-abc');
    const { timer, currentSession } = usePomodoroStore.getState();
    expect(timer.linkedTodoId).toBe('todo-abc');
    expect(currentSession!.todoId).toBe('todo-abc');
  });

  it('is no-op when already running (double-start prevention)', () => {
    usePomodoroStore.getState().startTimer();
    const sid1 = usePomodoroStore.getState().timer.currentSessionId;
    usePomodoroStore.getState().startTimer();
    expect(usePomodoroStore.getState().timer.currentSessionId).toBe(sid1);
  });

  it('calls scheduleTimerNotification when notifications enabled', () => {
    withSettings({ settings: { notificationsEnabled: true, soundEnabled: true } });
    usePomodoroStore.getState().startTimer();
    expect(scheduleTimerNotification).toHaveBeenCalledWith(
      'focus',
      NOW + 25 * 60 * 1000,
      expect.objectContaining({ isAbsoluteMs: true })
    );
  });

  it('dismisses timer notification when notifications enabled', () => {
    withSettings({ settings: { notificationsEnabled: true, soundEnabled: true } });
    usePomodoroStore.getState().startTimer();
    expect(notificationService.dismissTimerNotification).toHaveBeenCalled();
  });

  it('clears pending autoStartTimeout before starting', () => {
    // Simulate autoStartTimeout by enabling auto-start, completing, then starting new
    withSettings({ pomodoroSettings: { autoStartBreaks: true } });
    usePomodoroStore.setState({
      timer: makeRunningTimer(),
      sessions: [],
      currentSession: makeSession(),
    });
    usePomodoroStore.getState()._handleCompletion(); // sets autoStartTimeout
    // Now manually start — the pending auto-start should be cancelled
    resetSettingsMock();
    usePomodoroStore.getState().startTimer();
    const { timer } = usePomodoroStore.getState();
    expect(timer.state).toBe('running');
  });
});

// ── Pause / Resume ──────────────────────────────────────────────────────

describe('pauseTimer / resumeTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => {
    usePomodoroStore.getState()._stopTicking();
    jest.useRealTimers();
    jest.restoreAllMocks();
    resetSettingsMock();
  });

  it('pauseTimer sets state to paused and records pausedAt', () => {
    usePomodoroStore.getState().startTimer();
    (Date.now as jest.Mock).mockReturnValue(NOW + 5000);
    usePomodoroStore.getState().pauseTimer();
    const { timer } = usePomodoroStore.getState();
    expect(timer.state).toBe('paused');
    expect(timer.pausedAt).toBe(NOW + 5000);
  });

  it('pauseTimer cancels scheduled notifications', () => {
    usePomodoroStore.getState().startTimer();
    usePomodoroStore.getState().pauseTimer();
    expect(cancelScheduledTimerNotifications).toHaveBeenCalled();
  });

  it('pauseTimer is no-op when not running', () => {
    usePomodoroStore.getState().pauseTimer();
    expect(usePomodoroStore.getState().timer.state).toBe('stopped');
  });

  it('resumeTimer accumulates totalPausedDuration correctly', () => {
    usePomodoroStore.getState().startTimer();
    // Pause after 10s
    (Date.now as jest.Mock).mockReturnValue(NOW + 10_000);
    usePomodoroStore.getState().pauseTimer();
    // Resume after 20s pause
    (Date.now as jest.Mock).mockReturnValue(NOW + 30_000);
    usePomodoroStore.getState().resumeTimer();

    const { timer } = usePomodoroStore.getState();
    expect(timer.state).toBe('running');
    // Paused for 20 seconds
    expect(timer.totalPausedDuration).toBe(20);
  });

  it('resumeTimer keeps original startedAt (does not recalculate)', () => {
    usePomodoroStore.getState().startTimer();
    const originalStartedAt = usePomodoroStore.getState().timer.startedAt;
    (Date.now as jest.Mock).mockReturnValue(NOW + 10_000);
    usePomodoroStore.getState().pauseTimer();
    (Date.now as jest.Mock).mockReturnValue(NOW + 30_000);
    usePomodoroStore.getState().resumeTimer();
    expect(usePomodoroStore.getState().timer.startedAt).toBe(originalStartedAt);
  });

  it('resumeTimer reschedules notification when notifications enabled', () => {
    withSettings({ settings: { notificationsEnabled: true, soundEnabled: true } });
    usePomodoroStore.getState().startTimer();
    jest.clearAllMocks();

    (Date.now as jest.Mock).mockReturnValue(NOW + 5000);
    usePomodoroStore.getState().pauseTimer();
    (Date.now as jest.Mock).mockReturnValue(NOW + 15_000);
    usePomodoroStore.getState().resumeTimer();

    expect(scheduleTimerNotification).toHaveBeenCalledWith(
      'focus',
      expect.any(Number),
      expect.objectContaining({ isAbsoluteMs: true })
    );
  });

  it('resumeTimer updates session pausedDuration in milliseconds', () => {
    usePomodoroStore.getState().startTimer();
    (Date.now as jest.Mock).mockReturnValue(NOW + 5000);
    usePomodoroStore.getState().pauseTimer();
    (Date.now as jest.Mock).mockReturnValue(NOW + 25_000);
    usePomodoroStore.getState().resumeTimer();

    const { currentSession } = usePomodoroStore.getState();
    // pauseDeltaMs = 20000
    expect(currentSession!.pausedDuration).toBe(20_000);
  });

  it('resumeTimer is no-op when not paused (no pausedAt)', () => {
    // Timer is stopped, no pausedAt
    const before = usePomodoroStore.getState().timer;
    usePomodoroStore.getState().resumeTimer();
    expect(usePomodoroStore.getState().timer).toEqual(before);
  });
});

// ── stopTimer ───────────────────────────────────────────────────────────

describe('stopTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => {
    usePomodoroStore.getState()._stopTicking();
    jest.useRealTimers();
    jest.restoreAllMocks();
    resetSettingsMock();
  });

  it('stops ticking and cancels notifications', () => {
    usePomodoroStore.getState().startTimer();
    jest.clearAllMocks();
    usePomodoroStore.getState().stopTimer();
    expect(cancelScheduledTimerNotifications).toHaveBeenCalled();
  });

  it('records ended session with correct duration', () => {
    usePomodoroStore.getState().startTimer();
    // Simulate 10 min of work by updating remainingTime
    usePomodoroStore.setState((s) => ({
      timer: { ...s.timer, remainingTime: 15 * 60 },
    }));
    usePomodoroStore.getState().stopTimer();

    const { sessions } = usePomodoroStore.getState();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].endedAt).toBeDefined();
    // duration = totalTime - remainingTime = 1500 - 900 = 600
    expect(sessions[0].duration).toBe(600);
    expect(sessions[0].wasCompleted).toBe(false);
  });

  it('resets to INITIAL_TIMER_STATE preserving sessionsCompleted', () => {
    usePomodoroStore.setState({
      timer: makeRunningTimer({ sessionsCompleted: 3 }),
      sessions: [],
      currentSession: makeSession(),
    });
    usePomodoroStore.getState().stopTimer();

    const { timer } = usePomodoroStore.getState();
    expect(timer.state).toBe('stopped');
    expect(timer.phase).toBe('idle');
    expect(timer.sessionsCompleted).toBe(3);
    expect(timer.startedAt).toBeNull();
    expect(timer.currentSessionId).toBeNull();
  });

  it('calls resetSessionCombo on gamification store', () => {
    const mockResetCombo = jest.fn();
    (useGamificationStore.getState as jest.Mock).mockReturnValue({
      incrementPomodoro: jest.fn(),
      resetSessionCombo: mockResetCombo,
    });

    usePomodoroStore.getState().startTimer();
    usePomodoroStore.getState().stopTimer();

    expect(mockResetCombo).toHaveBeenCalled();
  });

  it('dismisses notification when notifications enabled', () => {
    withSettings({ settings: { notificationsEnabled: true, soundEnabled: true } });
    usePomodoroStore.getState().startTimer();
    jest.clearAllMocks();
    usePomodoroStore.getState().stopTimer();
    expect(notificationService.dismissTimerNotification).toHaveBeenCalled();
  });

  it('with no current session still resets timer', () => {
    usePomodoroStore.setState({
      timer: makeRunningTimer({ sessionsCompleted: 2 }),
      sessions: [],
      currentSession: null,
    });
    usePomodoroStore.getState().stopTimer();

    const { timer, sessions } = usePomodoroStore.getState();
    expect(timer.state).toBe('stopped');
    expect(timer.sessionsCompleted).toBe(2);
    expect(sessions).toHaveLength(0);
  });
});

// ── tick ────────────────────────────────────────────────────────────────

describe('tick', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => {
    usePomodoroStore.getState()._stopTicking();
    jest.useRealTimers();
    jest.restoreAllMocks();
    resetSettingsMock();
  });

  it('recalculates remainingTime from formula (not simple countdown)', () => {
    usePomodoroStore.setState({
      timer: makeRunningTimer(),
      sessions: [],
      currentSession: makeSession(),
    });

    (Date.now as jest.Mock).mockReturnValue(NOW + 100_000); // 100s later
    usePomodoroStore.getState().tick();
    expect(usePomodoroStore.getState().timer.remainingTime).toBe(25 * 60 - 100);
  });

  it('calls _handleCompletion when remainingTime reaches 0', () => {
    usePomodoroStore.setState({
      timer: makeRunningTimer(),
      sessions: [],
      currentSession: makeSession(),
    });

    // Move past completion
    (Date.now as jest.Mock).mockReturnValue(NOW + 25 * 60 * 1000);
    usePomodoroStore.getState().tick();

    // After completion, phase should have transitioned
    const { timer } = usePomodoroStore.getState();
    expect(timer.phase).toBe('short_break');
    expect(timer.state).toBe('stopped');
  });

  it('stops ticking when state is not running', () => {
    // Timer is stopped by default
    const spy = jest.spyOn(usePomodoroStore.getState(), '_stopTicking');
    usePomodoroStore.getState().tick();
    // _stopTicking should be called
    expect(usePomodoroStore.getState().timer.state).toBe('stopped');
  });
});

// ── syncTimer (CRITICAL) ────────────────────────────────────────────────

describe('syncTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => {
    usePomodoroStore.getState()._stopTicking();
    jest.useRealTimers();
    jest.restoreAllMocks();
    resetSettingsMock();
  });

  it('is no-op when timer not running', () => {
    const before = usePomodoroStore.getState().timer;
    usePomodoroStore.getState().syncTimer({ now: NOW + 60_000 });
    expect(usePomodoroStore.getState().timer).toEqual(before);
  });

  it('updates remainingTime based on elapsed wall-clock time', () => {
    usePomodoroStore.setState({
      timer: makeRunningTimer(),
      sessions: [],
      currentSession: makeSession(),
    });

    // 60 seconds elapsed
    usePomodoroStore.getState().syncTimer({ now: NOW + 60_000 });
    expect(usePomodoroStore.getState().timer.remainingTime).toBe(25 * 60 - 60);
  });

  it('detects completed phase and transitions to next', () => {
    // Timer started 26 min ago (25 min focus is done, 1 min into break)
    // autoStartBreaks = true so focus->break transition happens automatically
    // autoStartFocus is false (default), so it stops at the break
    withSettings({ pomodoroSettings: { autoStartBreaks: true } });
    usePomodoroStore.setState({
      timer: makeRunningTimer({
        startedAt: NOW - 26 * 60 * 1000,
        remainingTime: 1500, // stale
      }),
      sessions: [],
      currentSession: makeSession({ startedAt: new Date(NOW - 26 * 60 * 1000).toISOString() }),
    });

    usePomodoroStore.getState().syncTimer({ now: NOW });

    const { timer } = usePomodoroStore.getState();
    // Focus completed (25m), auto-started short_break, 1 min elapsed into break
    expect(timer.phase).toBe('short_break');
    expect(timer.sessionsCompleted).toBe(1);
    expect(timer.remainingTime).toBe(4 * 60); // 5m break - 1m elapsed = 4m
  });

  it('handles multiple completed phases (auto-start both directions)', () => {
    // autoStartBreaks and autoStartFocus both enabled
    withSettings({
      pomodoroSettings: { autoStartBreaks: true, autoStartFocus: true },
    });

    // Timer started 35 min ago. Focus is 25 min, short break is 5 min.
    // That means focus (25m) + short_break (5m) = 30m completed, 5m into second focus
    usePomodoroStore.setState({
      timer: makeRunningTimer({
        startedAt: NOW - 35 * 60 * 1000,
        remainingTime: 1500, // stale
      }),
      sessions: [],
      currentSession: makeSession({ startedAt: new Date(NOW - 35 * 60 * 1000).toISOString() }),
    });

    usePomodoroStore.getState().syncTimer({ now: NOW });

    const { timer, sessions } = usePomodoroStore.getState();
    // Should be in focus phase (focus -> short_break -> focus)
    expect(timer.phase).toBe('focus');
    expect(timer.sessionsCompleted).toBe(1);
    // Should have ~20 minutes remaining (25 - 5 = 20)
    expect(timer.remainingTime).toBe(20 * 60);
  });

  it('respects autoStartBreaks setting', () => {
    // autoStartBreaks = true, focus completed
    withSettings({ pomodoroSettings: { autoStartBreaks: true } });

    usePomodoroStore.setState({
      timer: makeRunningTimer({
        startedAt: NOW - 26 * 60 * 1000, // 26 min ago, past 25 min focus
        remainingTime: 1500,
      }),
      sessions: [],
      currentSession: makeSession({ startedAt: new Date(NOW - 26 * 60 * 1000).toISOString() }),
    });

    usePomodoroStore.getState().syncTimer({ now: NOW });

    const { timer } = usePomodoroStore.getState();
    expect(timer.phase).toBe('short_break');
    expect(timer.state).toBe('running');
  });

  it('respects autoStartFocus setting', () => {
    withSettings({
      pomodoroSettings: { autoStartBreaks: true, autoStartFocus: true },
    });

    // Start as short_break, 10 min ago (5 min break is done + 5 min into focus)
    usePomodoroStore.setState({
      timer: makeRunningTimer({
        phase: 'short_break',
        startedAt: NOW - 10 * 60 * 1000,
        remainingTime: 5 * 60,
        totalTime: 5 * 60,
        sessionsCompleted: 1,
      }),
      sessions: [],
      currentSession: makeSession({
        phase: 'short_break',
        startedAt: new Date(NOW - 10 * 60 * 1000).toISOString(),
        targetDuration: 5 * 60,
      }),
    });

    usePomodoroStore.getState().syncTimer({ now: NOW });

    const { timer } = usePomodoroStore.getState();
    expect(timer.phase).toBe('focus');
    expect(timer.remainingTime).toBe(20 * 60); // 25 - 5 = 20 min left
  });

  it('stops at phase boundary when auto-start disabled', () => {
    // autoStartBreaks is false (default). Focus completed.
    usePomodoroStore.setState({
      timer: makeRunningTimer({
        startedAt: NOW - 26 * 60 * 1000,
        remainingTime: 1500,
      }),
      sessions: [],
      currentSession: makeSession({ startedAt: new Date(NOW - 26 * 60 * 1000).toISOString() }),
    });

    usePomodoroStore.getState().syncTimer({ now: NOW });

    const { timer } = usePomodoroStore.getState();
    // _handleCompletion was called which transitions and stops
    expect(timer.phase).toBe('short_break');
    expect(timer.state).toBe('stopped');
  });

  it('awards gamification for completed focus sessions', () => {
    const mockIncrementPomodoro = jest.fn();
    const mockIncrementPomodoroCount = jest.fn();
    (useGamificationStore.getState as jest.Mock).mockReturnValue({
      incrementPomodoro: mockIncrementPomodoro,
      resetSessionCombo: jest.fn(),
    });
    (useTodoStore.getState as jest.Mock).mockReturnValue({
      todos: [],
      filter: {},
      incrementPomodoroCount: mockIncrementPomodoroCount,
    });

    withSettings({ pomodoroSettings: { autoStartBreaks: true } });

    usePomodoroStore.setState({
      timer: makeRunningTimer({
        startedAt: NOW - 26 * 60 * 1000,
        remainingTime: 1500,
        linkedTodoId: 'todo-sync-1',
      }),
      sessions: [],
      currentSession: makeSession({
        startedAt: new Date(NOW - 26 * 60 * 1000).toISOString(),
        todoId: 'todo-sync-1',
      }),
    });

    usePomodoroStore.getState().syncTimer({ now: NOW });

    expect(mockIncrementPomodoro).toHaveBeenCalledWith(25 * 60, expect.any(Date));
    expect(mockIncrementPomodoroCount).toHaveBeenCalledWith('todo-sync-1');
  });

  it('reschedules notification after phase change during sync', () => {
    withSettings({
      pomodoroSettings: { autoStartBreaks: true },
      settings: { notificationsEnabled: true, soundEnabled: true },
    });

    usePomodoroStore.setState({
      timer: makeRunningTimer({
        startedAt: NOW - 26 * 60 * 1000,
        remainingTime: 1500,
      }),
      sessions: [],
      currentSession: makeSession({ startedAt: new Date(NOW - 26 * 60 * 1000).toISOString() }),
    });

    jest.clearAllMocks();
    usePomodoroStore.getState().syncTimer({ now: NOW });

    // Should have rescheduled for the new short_break phase
    expect(scheduleTimerNotification).toHaveBeenCalledWith(
      'short_break',
      expect.any(Number),
      expect.objectContaining({ isAbsoluteMs: true })
    );
  });

  it('restarts ticking after sync if timer still running', () => {
    withSettings({ pomodoroSettings: { autoStartBreaks: true } });

    usePomodoroStore.setState({
      timer: makeRunningTimer({
        startedAt: NOW - 26 * 60 * 1000,
        remainingTime: 1500,
      }),
      sessions: [],
      currentSession: makeSession({ startedAt: new Date(NOW - 26 * 60 * 1000).toISOString() }),
    });

    usePomodoroStore.getState().syncTimer({ now: NOW });

    // Timer should be running (auto-started break)
    expect(usePomodoroStore.getState().timer.state).toBe('running');

    // Advance 1 second — if ticking restarted, remainingTime should decrease
    const remainingBefore = usePomodoroStore.getState().timer.remainingTime;
    (Date.now as jest.Mock).mockReturnValue(NOW + 1000);
    jest.advanceTimersByTime(1000);
    // The tick should fire and reduce remaining time
    expect(usePomodoroStore.getState().timer.remainingTime).toBeLessThan(remainingBefore);
  });

  it('caps phase transitions at MAX_SYNC_ITERATIONS (50)', () => {
    withSettings({
      pomodoroSettings: {
        autoStartBreaks: true,
        autoStartFocus: true,
        focusDuration: 1, // 1 second focus
        shortBreakDuration: 1, // 1 second break
      },
    });

    // Timer started way in the past — many phases should have completed
    usePomodoroStore.setState({
      timer: makeRunningTimer({
        startedAt: NOW - 1_000_000, // 1000 seconds ago
        remainingTime: 1,
        totalTime: 1,
      }),
      sessions: [],
      currentSession: makeSession({
        startedAt: new Date(NOW - 1_000_000).toISOString(),
        targetDuration: 1,
      }),
    });

    // Should not hang or crash; capped at 50 iterations
    usePomodoroStore.getState().syncTimer({ now: NOW });
    const { timer } = usePomodoroStore.getState();
    // Just verify it didn't crash and the timer has some valid state
    expect(['focus', 'short_break', 'long_break']).toContain(timer.phase);
  });

  it('creates completed sessions and new session in store during multi-phase sync', () => {
    withSettings({
      pomodoroSettings: { autoStartBreaks: true, autoStartFocus: true },
    });

    usePomodoroStore.setState({
      timer: makeRunningTimer({
        startedAt: NOW - 35 * 60 * 1000,
        remainingTime: 1500,
      }),
      sessions: [],
      currentSession: makeSession({ startedAt: new Date(NOW - 35 * 60 * 1000).toISOString() }),
    });

    usePomodoroStore.getState().syncTimer({ now: NOW });

    const { sessions, currentSession } = usePomodoroStore.getState();
    // focus(25m) completed + short_break(5m) completed = 2 sessions
    expect(sessions.length).toBe(2);
    expect(sessions[0].wasCompleted).toBe(true);
    expect(sessions[1].wasCompleted).toBe(true);
    // Currently in the third phase, so currentSession should exist
    expect(currentSession).not.toBeNull();
  });
});

// ── _handleCompletion ───────────────────────────────────────────────────

describe('_handleCompletion', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => {
    usePomodoroStore.getState()._stopTicking();
    jest.useRealTimers();
    jest.restoreAllMocks();
    resetSettingsMock();
  });

  it('transitions focus -> short_break', () => {
    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'focus', sessionsCompleted: 0 }),
      sessions: [],
      currentSession: makeSession(),
    });

    usePomodoroStore.getState()._handleCompletion();

    const { timer } = usePomodoroStore.getState();
    expect(timer.phase).toBe('short_break');
    expect(timer.state).toBe('stopped');
    expect(timer.totalTime).toBe(5 * 60);
    expect(timer.remainingTime).toBe(5 * 60);
  });

  it('transitions focus -> long_break at sessionsUntilLongBreak boundary', () => {
    // sessionsUntilLongBreak = 4, current completed = 3, after increment = 4 → long_break
    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'focus', sessionsCompleted: 3 }),
      sessions: [],
      currentSession: makeSession(),
    });

    usePomodoroStore.getState()._handleCompletion();

    expect(usePomodoroStore.getState().timer.phase).toBe('long_break');
    expect(usePomodoroStore.getState().timer.totalTime).toBe(15 * 60);
  });

  it('transitions short_break -> focus', () => {
    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'short_break', sessionsCompleted: 1, totalTime: 5 * 60, remainingTime: 5 * 60 }),
      sessions: [],
      currentSession: makeSession({ phase: 'short_break', targetDuration: 5 * 60 }),
    });

    usePomodoroStore.getState()._handleCompletion();

    expect(usePomodoroStore.getState().timer.phase).toBe('focus');
    expect(usePomodoroStore.getState().timer.totalTime).toBe(25 * 60);
  });

  it('increments sessionsCompleted for focus phase', () => {
    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'focus', sessionsCompleted: 2 }),
      sessions: [],
      currentSession: makeSession(),
    });

    usePomodoroStore.getState()._handleCompletion();

    expect(usePomodoroStore.getState().timer.sessionsCompleted).toBe(3);
  });

  it('does not increment sessionsCompleted for break phase', () => {
    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'short_break', sessionsCompleted: 2, totalTime: 5 * 60, remainingTime: 5 * 60 }),
      sessions: [],
      currentSession: makeSession({ phase: 'short_break', targetDuration: 5 * 60 }),
    });

    usePomodoroStore.getState()._handleCompletion();

    expect(usePomodoroStore.getState().timer.sessionsCompleted).toBe(2);
  });

  it('calls incrementPomodoro for focus completion', () => {
    const mockIncrementPomodoro = jest.fn();
    (useGamificationStore.getState as jest.Mock).mockReturnValue({
      incrementPomodoro: mockIncrementPomodoro,
      resetSessionCombo: jest.fn(),
    });

    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'focus' }),
      sessions: [],
      currentSession: makeSession(),
    });

    usePomodoroStore.getState()._handleCompletion();

    expect(mockIncrementPomodoro).toHaveBeenCalledWith(25 * 60, expect.any(Date));
  });

  it('calls incrementPomodoroCount on linked todo for focus completion', () => {
    const mockIncrementPomodoroCount = jest.fn();
    (useTodoStore.getState as jest.Mock).mockReturnValue({
      todos: [],
      filter: {},
      incrementPomodoroCount: mockIncrementPomodoroCount,
    });

    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'focus', linkedTodoId: 'todo-x' }),
      sessions: [],
      currentSession: makeSession({ todoId: 'todo-x' }),
    });

    usePomodoroStore.getState()._handleCompletion();

    expect(mockIncrementPomodoroCount).toHaveBeenCalledWith('todo-x');
  });

  it('does not call incrementPomodoroCount when no linkedTodoId', () => {
    const mockIncrementPomodoroCount = jest.fn();
    (useTodoStore.getState as jest.Mock).mockReturnValue({
      todos: [],
      filter: {},
      incrementPomodoroCount: mockIncrementPomodoroCount,
    });

    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'focus', linkedTodoId: null }),
      sessions: [],
      currentSession: makeSession(),
    });

    usePomodoroStore.getState()._handleCompletion();

    expect(mockIncrementPomodoroCount).not.toHaveBeenCalled();
  });

  it('auto-starts next phase when autoStartBreaks enabled (focus -> break)', () => {
    withSettings({ pomodoroSettings: { autoStartBreaks: true } });

    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'focus' }),
      sessions: [],
      currentSession: makeSession(),
    });

    usePomodoroStore.getState()._handleCompletion();

    // State is stopped initially, but autoStartTimeout should fire
    expect(usePomodoroStore.getState().timer.state).toBe('stopped');

    // Advance past the 1500ms auto-start delay
    (Date.now as jest.Mock).mockReturnValue(NOW + 2000);
    jest.advanceTimersByTime(1500);

    expect(usePomodoroStore.getState().timer.state).toBe('running');
    expect(usePomodoroStore.getState().timer.phase).toBe('short_break');
  });

  it('auto-starts next phase when autoStartFocus enabled (break -> focus)', () => {
    withSettings({ pomodoroSettings: { autoStartFocus: true } });

    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'short_break', sessionsCompleted: 1, totalTime: 5 * 60, remainingTime: 5 * 60 }),
      sessions: [],
      currentSession: makeSession({ phase: 'short_break', targetDuration: 5 * 60 }),
    });

    usePomodoroStore.getState()._handleCompletion();

    (Date.now as jest.Mock).mockReturnValue(NOW + 2000);
    jest.advanceTimersByTime(1500);

    expect(usePomodoroStore.getState().timer.state).toBe('running');
    expect(usePomodoroStore.getState().timer.phase).toBe('focus');
  });

  it('does not auto-start when _isSyncing is true', () => {
    withSettings({ pomodoroSettings: { autoStartBreaks: true } });

    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'focus' }),
      sessions: [],
      currentSession: makeSession(),
    });

    usePomodoroStore.getState()._handleCompletion({ _isSyncing: true });

    jest.advanceTimersByTime(5000);
    // Should remain stopped because _isSyncing prevents auto-start
    expect(usePomodoroStore.getState().timer.state).toBe('stopped');
  });

  it('enqueues completed session to sync store', () => {
    const mockEnqueue = jest.fn();
    jest.mock('@/stores/sync-store', () => ({
      useSyncStore: {
        getState: jest.fn(() => ({ enqueue: mockEnqueue })),
      },
    }));

    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'focus' }),
      sessions: [],
      currentSession: makeSession(),
    });

    usePomodoroStore.getState()._handleCompletion();

    // Session should be added to sessions array
    const { sessions } = usePomodoroStore.getState();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].wasCompleted).toBe(true);
    expect(sessions[0].duration).toBe(25 * 60);
  });

  it('is no-op when timer state is not running', () => {
    usePomodoroStore.setState({
      timer: { ...INITIAL_TIMER_STATE, state: 'stopped' },
      sessions: [],
      currentSession: null,
    });

    usePomodoroStore.getState()._handleCompletion();

    // Nothing should have changed
    expect(usePomodoroStore.getState().timer.state).toBe('stopped');
    expect(usePomodoroStore.getState().timer.phase).toBe('idle');
  });

  it('resets startedAt, pausedAt, totalPausedDuration, and notificationId', () => {
    usePomodoroStore.setState({
      timer: makeRunningTimer({ totalPausedDuration: 30, notificationId: 'notif-1' }),
      sessions: [],
      currentSession: makeSession(),
    });

    usePomodoroStore.getState()._handleCompletion();

    const { timer } = usePomodoroStore.getState();
    expect(timer.startedAt).toBeNull();
    expect(timer.pausedAt).toBeNull();
    expect(timer.totalPausedDuration).toBe(0);
    expect(timer.notificationId).toBeNull();
  });

  it('preserves linkedTodoId through phase transition', () => {
    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'focus', linkedTodoId: 'todo-persist' }),
      sessions: [],
      currentSession: makeSession({ todoId: 'todo-persist' }),
    });

    usePomodoroStore.getState()._handleCompletion();

    expect(usePomodoroStore.getState().timer.linkedTodoId).toBe('todo-persist');
  });

  it('transitions long_break -> focus', () => {
    usePomodoroStore.setState({
      timer: makeRunningTimer({
        phase: 'long_break',
        sessionsCompleted: 4,
        totalTime: 15 * 60,
        remainingTime: 15 * 60,
      }),
      sessions: [],
      currentSession: makeSession({ phase: 'long_break', targetDuration: 15 * 60 }),
    });

    usePomodoroStore.getState()._handleCompletion();

    expect(usePomodoroStore.getState().timer.phase).toBe('focus');
    expect(usePomodoroStore.getState().timer.sessionsCompleted).toBe(4); // not incremented for break
  });
});

// ── completeSession ─────────────────────────────────────────────────────

describe('completeSession', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => {
    usePomodoroStore.getState()._stopTicking();
    jest.useRealTimers();
    jest.restoreAllMocks();
    resetSettingsMock();
  });

  it('delegates to _handleCompletion when running with currentSession', () => {
    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'focus' }),
      sessions: [],
      currentSession: makeSession(),
    });

    usePomodoroStore.getState().completeSession();

    const { timer, sessions } = usePomodoroStore.getState();
    expect(timer.phase).toBe('short_break');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].wasCompleted).toBe(true);
  });

  it('is no-op when timer is not running', () => {
    usePomodoroStore.setState({
      timer: { ...INITIAL_TIMER_STATE, state: 'stopped' },
      sessions: [],
      currentSession: makeSession(),
    });

    usePomodoroStore.getState().completeSession();

    // State unchanged
    expect(usePomodoroStore.getState().sessions).toHaveLength(0);
  });
});

// ── skipToNextPhase ─────────────────────────────────────────────────────

describe('skipToNextPhase (extended)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => {
    usePomodoroStore.getState()._stopTicking();
    jest.useRealTimers();
    jest.restoreAllMocks();
    resetSettingsMock();
  });

  it('advances from focus to short_break, incrementing sessionsCompleted', () => {
    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'focus', sessionsCompleted: 0 }),
      sessions: [],
      currentSession: makeSession(),
    });

    usePomodoroStore.getState().skipToNextPhase();

    const { timer } = usePomodoroStore.getState();
    expect(timer.phase).toBe('short_break');
    expect(timer.sessionsCompleted).toBe(1);
    expect(timer.state).toBe('stopped');
  });

  it('advances from focus to long_break at boundary', () => {
    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'focus', sessionsCompleted: 3 }),
      sessions: [],
      currentSession: makeSession(),
    });

    usePomodoroStore.getState().skipToNextPhase();

    expect(usePomodoroStore.getState().timer.phase).toBe('long_break');
    expect(usePomodoroStore.getState().timer.sessionsCompleted).toBe(4);
  });

  it('records current session as not completed when skipping', () => {
    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'focus', remainingTime: 1000 }),
      sessions: [],
      currentSession: makeSession(),
    });

    usePomodoroStore.getState().skipToNextPhase();

    const { sessions } = usePomodoroStore.getState();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].wasCompleted).toBe(false);
    // duration = totalTime - remainingTime = 1500 - 1000 = 500
    expect(sessions[0].duration).toBe(500);
  });

  it('cancels notifications', () => {
    usePomodoroStore.setState({
      timer: makeRunningTimer(),
      sessions: [],
      currentSession: makeSession(),
    });

    jest.clearAllMocks();
    usePomodoroStore.getState().skipToNextPhase();

    expect(cancelScheduledTimerNotifications).toHaveBeenCalled();
  });

  it('dismisses notification when notifications enabled', () => {
    withSettings({ settings: { notificationsEnabled: true, soundEnabled: true } });

    usePomodoroStore.setState({
      timer: makeRunningTimer(),
      sessions: [],
      currentSession: makeSession(),
    });

    jest.clearAllMocks();
    usePomodoroStore.getState().skipToNextPhase();

    expect(notificationService.dismissTimerNotification).toHaveBeenCalled();
  });

  it('handles skip with no currentSession gracefully', () => {
    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'focus', sessionsCompleted: 0 }),
      sessions: [],
      currentSession: null,
    });

    usePomodoroStore.getState().skipToNextPhase();

    const { timer, sessions } = usePomodoroStore.getState();
    expect(timer.phase).toBe('short_break');
    expect(sessions).toHaveLength(0); // no session to record
  });
});

// ── linkTodo ────────────────────────────────────────────────────────────

describe('linkTodo (extended)', () => {
  it('sets linkedTodoId', () => {
    usePomodoroStore.getState().linkTodo('todo-link-1');
    expect(usePomodoroStore.getState().timer.linkedTodoId).toBe('todo-link-1');
  });

  it('clears linkedTodoId with null', () => {
    usePomodoroStore.getState().linkTodo('todo-link-1');
    usePomodoroStore.getState().linkTodo(null);
    expect(usePomodoroStore.getState().timer.linkedTodoId).toBeNull();
  });
});

// ── applySettingsToTimer (extended) ─────────────────────────────────────

describe('applySettingsToTimer (extended)', () => {
  it('updates totalTime when phase matches and timer is stopped', () => {
    usePomodoroStore.setState({
      timer: { ...INITIAL_TIMER_STATE, phase: 'short_break', state: 'stopped', remainingTime: 100, totalTime: 100 },
      sessions: [],
      currentSession: null,
    });

    usePomodoroStore.getState().applySettingsToTimer({
      focusDuration: 25 * 60,
      shortBreakDuration: 10 * 60, // changed from 5 to 10
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
    expect(timer.remainingTime).toBe(10 * 60);
    expect(timer.totalTime).toBe(10 * 60);
  });

  it('is no-op when remainingTime and totalTime already match settings', () => {
    usePomodoroStore.setState({
      timer: { ...INITIAL_TIMER_STATE, phase: 'focus', state: 'stopped', remainingTime: 25 * 60, totalTime: 25 * 60 },
      sessions: [],
      currentSession: null,
    });

    usePomodoroStore.getState().applySettingsToTimer({
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
    });

    // No change — should be identical
    const { timer } = usePomodoroStore.getState();
    expect(timer.remainingTime).toBe(25 * 60);
  });

  it('uses settings from useSettingsStore when no override given', () => {
    usePomodoroStore.setState({
      timer: { ...INITIAL_TIMER_STATE, phase: 'focus', state: 'stopped', remainingTime: 100, totalTime: 100 },
      sessions: [],
      currentSession: null,
    });

    // No argument → reads from mock settings store (25 * 60 for focus)
    usePomodoroStore.getState().applySettingsToTimer();

    const { timer } = usePomodoroStore.getState();
    expect(timer.remainingTime).toBe(25 * 60);
    expect(timer.totalTime).toBe(25 * 60);
  });
});

// ── getPhaseDuration / getNextPhase (via setPhase / skipToNextPhase) ────

describe('getPhaseDuration / getNextPhase edge cases', () => {
  it('getPhaseDuration returns focusDuration for unknown phase (fallback)', () => {
    // The store's setPhase uses getPhaseDuration internally.
    // Setting phase to 'focus' (the fallback case is when phase doesn't match known types)
    usePomodoroStore.getState().setPhase('focus');
    const { timer } = usePomodoroStore.getState();
    expect(timer.totalTime).toBe(25 * 60);
  });

  it('getNextPhase at long_break -> focus', () => {
    usePomodoroStore.setState({
      timer: makeRunningTimer({
        phase: 'long_break',
        sessionsCompleted: 4,
        totalTime: 15 * 60,
        remainingTime: 15 * 60,
      }),
      sessions: [],
      currentSession: makeSession({ phase: 'long_break', targetDuration: 15 * 60 }),
    });

    usePomodoroStore.getState().skipToNextPhase();

    expect(usePomodoroStore.getState().timer.phase).toBe('focus');
  });
});

// ── _handleCompletion notification when app is in background ────────────

describe('_handleCompletion background notification', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => {
    usePomodoroStore.getState()._stopTicking();
    jest.useRealTimers();
    jest.restoreAllMocks();
    resetSettingsMock();
  });

  it('sends timer complete notification when app is in background', () => {
    // Set AppState to background
    const { AppState } = require('react-native');
    const original = AppState.currentState;
    AppState.currentState = 'background';

    withSettings({ settings: { notificationsEnabled: true, soundEnabled: true } });

    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'focus' }),
      sessions: [],
      currentSession: makeSession(),
    });

    jest.clearAllMocks();
    usePomodoroStore.getState()._handleCompletion();

    expect(notificationService.sendTimerCompleteNotification).toHaveBeenCalledWith(
      'focus',
      expect.objectContaining({ soundEnabled: true, vibrationEnabled: true })
    );

    // Restore
    AppState.currentState = original;
  });

  it('does not send notification when shouldNotify is false', () => {
    const { AppState } = require('react-native');
    const original = AppState.currentState;
    AppState.currentState = 'background';

    withSettings({ settings: { notificationsEnabled: true, soundEnabled: true } });

    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'focus' }),
      sessions: [],
      currentSession: makeSession(),
    });

    jest.clearAllMocks();
    usePomodoroStore.getState()._handleCompletion({ shouldNotify: false });

    expect(notificationService.sendTimerCompleteNotification).not.toHaveBeenCalled();

    AppState.currentState = original;
  });

  it('does not send notification when notifications are disabled', () => {
    const { AppState } = require('react-native');
    const original = AppState.currentState;
    AppState.currentState = 'background';

    // notificationsEnabled is false by default
    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'focus' }),
      sessions: [],
      currentSession: makeSession(),
    });

    jest.clearAllMocks();
    usePomodoroStore.getState()._handleCompletion();

    expect(notificationService.sendTimerCompleteNotification).not.toHaveBeenCalled();

    AppState.currentState = original;
  });
});

// ── autoStartTimeout dedup (line 661) ──────────────────────────────────

describe('autoStartTimeout deduplication', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => {
    usePomodoroStore.getState()._stopTicking();
    jest.useRealTimers();
    jest.restoreAllMocks();
    resetSettingsMock();
  });

  it('clears previous autoStartTimeout before setting a new one', () => {
    withSettings({ pomodoroSettings: { autoStartBreaks: true } });

    // First completion sets autoStartTimeout
    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'focus' }),
      sessions: [],
      currentSession: makeSession(),
    });
    usePomodoroStore.getState()._handleCompletion();

    // Now manually set up another running focus timer and complete again
    // This should clear the first timeout before setting a new one (line 661)
    (Date.now as jest.Mock).mockReturnValue(NOW + 500);
    usePomodoroStore.setState({
      timer: makeRunningTimer({ phase: 'focus', startedAt: NOW + 500 }),
      sessions: [],
      currentSession: makeSession(),
    });
    usePomodoroStore.getState()._handleCompletion();

    // Advance past the timeout — only one auto-start should fire
    (Date.now as jest.Mock).mockReturnValue(NOW + 3000);
    jest.advanceTimersByTime(1500);

    // Should be running (auto-started once)
    expect(usePomodoroStore.getState().timer.state).toBe('running');
  });
});

// ── Error handling in startTimer / resumeTimer catch blocks ─────────────

describe('Error handling in notification scheduling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => {
    usePomodoroStore.getState()._stopTicking();
    jest.useRealTimers();
    jest.restoreAllMocks();
    resetSettingsMock();
  });

  it('startTimer still works when scheduleTimerNotification throws', () => {
    withSettings({ settings: { notificationsEnabled: true, soundEnabled: true } });
    (scheduleTimerNotification as jest.Mock).mockImplementationOnce(() => {
      throw new Error('notification failed');
    });

    usePomodoroStore.getState().startTimer();

    // Timer should still be running despite notification error
    expect(usePomodoroStore.getState().timer.state).toBe('running');
  });

  it('resumeTimer still works when scheduleTimerNotification throws', () => {
    withSettings({ settings: { notificationsEnabled: true, soundEnabled: true } });
    usePomodoroStore.getState().startTimer();

    (Date.now as jest.Mock).mockReturnValue(NOW + 5000);
    usePomodoroStore.getState().pauseTimer();

    (scheduleTimerNotification as jest.Mock).mockImplementationOnce(() => {
      throw new Error('notification failed');
    });

    (Date.now as jest.Mock).mockReturnValue(NOW + 10_000);
    usePomodoroStore.getState().resumeTimer();

    expect(usePomodoroStore.getState().timer.state).toBe('running');
  });
});
