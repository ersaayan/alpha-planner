const mockSettingsState = {
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
    notificationsEnabled: true,
    soundEnabled: true,
    timeFormat: '24h',
  },
};

jest.mock('@/stores/settings-store', () => ({
  useSettingsStore: {
    getState: jest.fn(() => mockSettingsState),
    setState: jest.fn(),
  },
}));

const mockIncrementPomodoro = jest.fn();
const mockResetSessionCombo = jest.fn();
jest.mock('@/stores/gamification-store', () => ({
  useGamificationStore: {
    getState: jest.fn(() => ({
      incrementPomodoro: mockIncrementPomodoro,
      resetSessionCombo: mockResetSessionCombo,
    })),
  },
}));

const mockIncrementPomodoroCount = jest.fn();
jest.mock('@/stores/todo-store', () => ({
  useTodoStore: {
    getState: jest.fn(() => ({ incrementPomodoroCount: mockIncrementPomodoroCount })),
  },
}));

const mockEnqueue = jest.fn();
jest.mock('@/stores/sync-store', () => ({
  useSyncStore: { getState: jest.fn(() => ({ enqueue: mockEnqueue })) },
}));

const mockArmAlerts = jest.fn((..._args: unknown[]) => Promise.resolve());
jest.mock('@/services/notifications/pomodoro-alerts', () => ({
  armAlerts: (...args: unknown[]) => mockArmAlerts(...args),
}));

jest.mock('react-native', () => ({
  AppState: { currentState: 'active' },
  Platform: {
    OS: 'ios',
    select: (spec: Record<string, unknown>) => spec.ios ?? spec.native ?? spec.default,
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  migratePomodoroState,
  stopPomodoroEngine,
  usePomodoroClock,
  usePomodoroStore,
} from '@/stores/pomodoro-store';
import type { PomodoroSession, PomodoroTimerState } from '@/types';
import { INITIAL_TIMER_STATE } from '@/types';
import { ALERT_CHAIN_LIMIT } from '@/utils/pomodoro-helpers';

const NOW = 1_700_000_000_000;
const MIN = 60_000;
const DEFAULT_POMODORO_SETTINGS = { ...mockSettingsState.pomodoroSettings };

const session = (overrides: Partial<PomodoroSession> = {}): PomodoroSession => ({
  id: 's1',
  todoId: 'todo-1',
  phase: 'focus',
  startedAt: new Date(NOW).toISOString(),
  endedAt: null,
  pausedDuration: 0,
  wasCompleted: false,
  duration: 0,
  targetDuration: 1500,
  ...overrides,
});

const running = (overrides: Partial<PomodoroTimerState> = {}): PomodoroTimerState => ({
  ...INITIAL_TIMER_STATE,
  phase: 'focus',
  state: 'running',
  remainingTime: 1500,
  totalTime: 1500,
  sessionsCompleted: 0,
  startedAt: NOW,
  pausedAt: null,
  totalPausedDuration: 0,
  currentSessionId: 's1',
  linkedTodoId: 'todo-1',
  chainIndex: 0,
  ...overrides,
});

const store = () => usePomodoroStore.getState();
const timer = () => usePomodoroStore.getState().timer;
const lastArmed = () => {
  const calls = mockArmAlerts.mock.calls;
  return calls[calls.length - 1] as unknown as [{ timer: PomodoroTimerState }, { keepBelow: number }];
};

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  jest.clearAllMocks();
  mockSettingsState.pomodoroSettings = { ...DEFAULT_POMODORO_SETTINGS };
  mockSettingsState.settings = { notificationsEnabled: true, soundEnabled: true, timeFormat: '24h' };
  usePomodoroStore.setState({ timer: { ...INITIAL_TIMER_STATE }, sessions: [], currentSession: null });
  jest.clearAllMocks();
});

afterEach(() => {
  stopPomodoroEngine();
  jest.useRealTimers();
});

describe('starting, pausing, resuming', () => {
  it('starts a focus phase from the settings duration', () => {
    mockSettingsState.pomodoroSettings.focusDuration = 50 * 60;
    store().startTimer('todo-9');

    expect(timer()).toMatchObject({
      phase: 'focus',
      state: 'running',
      totalTime: 3000,
      startedAt: NOW,
      chainIndex: 0,
      linkedTodoId: 'todo-9',
    });
    expect(store().currentSession).toMatchObject({ phase: 'focus', todoId: 'todo-9', targetDuration: 3000 });
    expect(lastArmed()[1]).toEqual({ keepBelow: 0 });
  });

  it('ignores a second start while running', () => {
    store().startTimer();
    const id = timer().currentSessionId;
    store().startTimer();
    expect(timer().currentSessionId).toBe(id);
  });

  it('pause recomputes the remaining time from timestamps', () => {
    store().startTimer();
    jest.setSystemTime(NOW + 10 * MIN);
    store().pauseTimer();

    expect(timer()).toMatchObject({ state: 'paused', pausedAt: NOW + 10 * MIN, remainingTime: 900 });
    expect(usePomodoroClock.getState().remainingSeconds).toBe(900);
    expect(lastArmed()[0].timer.state).toBe('paused');
  });

  it('pausing a phase that already ended completes it instead', () => {
    usePomodoroStore.setState({ timer: running(), currentSession: session() });
    jest.setSystemTime(NOW + 26 * MIN);
    store().pauseTimer();

    expect(mockIncrementPomodoro).toHaveBeenCalledTimes(1);
    expect(timer()).toMatchObject({ state: 'stopped', phase: 'short_break' });
  });

  it('resume adds the pause to the phase and restarts the chain', () => {
    usePomodoroStore.setState({
      timer: running({ chainIndex: 3 }),
      currentSession: session(),
    });
    jest.setSystemTime(NOW + 10 * MIN);
    store().pauseTimer();
    jest.setSystemTime(NOW + 15 * MIN);
    store().resumeTimer();

    expect(timer()).toMatchObject({ state: 'running', totalPausedDuration: 300, chainIndex: 0, remainingTime: 900 });
    expect(store().currentSession?.pausedDuration).toBe(5 * MIN);
    expect(lastArmed()[1]).toEqual({ keepBelow: 0 });
  });

  it('startTimer on a paused timer resumes instead of restarting', () => {
    store().startTimer();
    const sessionId = timer().currentSessionId;
    jest.setSystemTime(NOW + 10 * MIN);
    store().pauseTimer();
    jest.setSystemTime(NOW + 12 * MIN);
    store().startTimer();

    expect(timer().state).toBe('running');
    expect(timer().currentSessionId).toBe(sessionId);
    expect(timer().startedAt).toBe(NOW);
    expect(timer().remainingTime).toBe(900);
    expect(store().sessions).toHaveLength(0);
  });

  it('clamps a negative pause (clock moved back while paused) to zero', () => {
    usePomodoroStore.setState({
      timer: running({ state: 'paused', pausedAt: NOW + 10 * MIN, remainingTime: 900 }),
      currentSession: session(),
    });
    jest.setSystemTime(NOW + 5 * MIN);
    store().resumeTimer();

    expect(timer().totalPausedDuration).toBe(0);
    expect(store().currentSession?.pausedDuration).toBe(0);
  });
});

describe('bug 1: catch-up never ends a phase early', () => {
  it('a stale remainingTime below totalTime does not complete the phase on return', () => {
    // Ticked to 15:00 elapsed (remainingTime 600 persisted), back 5 s later.
    usePomodoroStore.setState({ timer: running({ remainingTime: 600 }), currentSession: session() });
    store().syncTimer({ now: NOW + 15 * MIN + 5000, source: 'foreground' });

    expect(timer()).toMatchObject({ state: 'running', phase: 'focus', sessionsCompleted: 0 });
    expect(mockIncrementPomodoro).not.toHaveBeenCalled();
  });

  it('an iOS inactive→active blip after the halfway point keeps the phase running', () => {
    store().startTimer('todo-1');
    jest.setSystemTime(NOW + 13 * MIN + 2000);
    store().syncTimer({ source: 'foreground' });

    expect(timer()).toMatchObject({ state: 'running', phase: 'focus' });
    expect(usePomodoroClock.getState().remainingSeconds).toBe(11 * 60 + 58);
    expect(store().sessions).toHaveLength(0);
  });

  it('an auto-started break starts at the focus end, not later', () => {
    mockSettingsState.pomodoroSettings.autoStartBreaks = true;
    usePomodoroStore.setState({ timer: running({ remainingTime: 600 }), currentSession: session() });
    store().syncTimer({ now: NOW + 27 * MIN });

    expect(timer()).toMatchObject({
      state: 'running',
      phase: 'short_break',
      startedAt: NOW + 25 * MIN,
      chainIndex: 1,
    });
  });
});

describe('bug 2: every completion is credited exactly once', () => {
  it('a focus that ended in the background is credited once', () => {
    usePomodoroStore.setState({ timer: running(), currentSession: session() });
    store().syncTimer({ now: NOW + 26 * MIN });
    store().syncTimer({ now: NOW + 26 * MIN + 1000 });

    expect(mockIncrementPomodoro).toHaveBeenCalledTimes(1);
    expect(mockIncrementPomodoroCount).toHaveBeenCalledTimes(1);
    expect(mockIncrementPomodoroCount).toHaveBeenCalledWith('todo-1');
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(timer().sessionsCompleted).toBe(1);
    expect(store().sessions).toHaveLength(1);
    expect(store().sessions[0]).toMatchObject({ id: 's1', wasCompleted: true, duration: 1500 });
  });

  it('a focus completed by the in-app clock is credited once', () => {
    store().startTimer('todo-1');
    jest.advanceTimersByTime(25 * MIN + 1000);

    expect(mockIncrementPomodoro).toHaveBeenCalledTimes(1);
    expect(timer()).toMatchObject({ state: 'stopped', phase: 'short_break', sessionsCompleted: 1 });
    expect(usePomodoroClock.getState().remainingSeconds).toBe(300);
  });

  it('uses the session length and its real end time, not the current setting or now', () => {
    usePomodoroStore.setState({ timer: running(), currentSession: session() });
    mockSettingsState.pomodoroSettings.focusDuration = 50 * 60;
    store().syncTimer({ now: NOW + 3 * 60 * MIN });

    const [focusTime, completedAt] = mockIncrementPomodoro.mock.calls[0];
    expect(focusTime).toBe(1500);
    expect((completedAt as Date).getTime()).toBe(NOW + 25 * MIN);
    expect(store().sessions[0].endedAt).toBe(new Date(NOW + 25 * MIN).toISOString());
  });

  it('enqueues the completed session for sync', () => {
    usePomodoroStore.setState({ timer: running(), currentSession: session() });
    store().syncTimer({ now: NOW + 26 * MIN });

    expect(mockEnqueue).toHaveBeenCalledWith(
      'pomodoro_sessions',
      'insert',
      expect.objectContaining({ id: 's1', was_completed: true, duration: 1500, todo_id: 'todo-1' }),
    );
  });

  it('long breaks come after every 4th focus, one focus per completion', () => {
    const phases: string[] = [];
    for (let i = 0; i < 4; i++) {
      usePomodoroStore.setState({
        timer: running({ sessionsCompleted: timer().sessionsCompleted }),
        currentSession: session({ id: `s${i}` }),
      });
      store().syncTimer({ now: NOW + 26 * MIN });
      phases.push(`${timer().phase}:${timer().sessionsCompleted}`);
    }
    expect(phases).toEqual(['short_break:1', 'short_break:2', 'short_break:3', 'long_break:4']);
  });
});

describe('bug 3: unattended auto-start catch-up is capped', () => {
  it('10 hours away with both auto-starts credits at most the chain limit', () => {
    mockSettingsState.pomodoroSettings.autoStartBreaks = true;
    mockSettingsState.pomodoroSettings.autoStartFocus = true;
    usePomodoroStore.setState({ timer: running(), currentSession: session() });
    store().syncTimer({ now: NOW + 10 * 60 * MIN });

    // F S F S F S F L = 8 phases, 4 of them focus.
    expect(store().sessions).toHaveLength(ALERT_CHAIN_LIMIT);
    expect(store().sessions.map((s) => s.phase)).toEqual([
      'focus', 'short_break', 'focus', 'short_break', 'focus', 'short_break', 'focus', 'long_break',
    ]);
    expect(mockIncrementPomodoro).toHaveBeenCalledTimes(4);
    expect(mockEnqueue).toHaveBeenCalledTimes(8);
    expect(timer()).toMatchObject({ state: 'stopped', phase: 'focus', sessionsCompleted: 4 });
    expect(store().currentSession).toBeNull();
  });

  it('sessions in a chain are contiguous', () => {
    mockSettingsState.pomodoroSettings.autoStartBreaks = true;
    mockSettingsState.pomodoroSettings.autoStartFocus = true;
    usePomodoroStore.setState({ timer: running(), currentSession: session() });
    store().syncTimer({ now: NOW + 33 * MIN });

    const [focus, shortBreak] = store().sessions;
    expect(focus.endedAt).toBe(new Date(NOW + 25 * MIN).toISOString());
    expect(shortBreak.startedAt).toBe(focus.endedAt);
    expect(timer()).toMatchObject({ phase: 'focus', state: 'running', startedAt: NOW + 30 * MIN, chainIndex: 2 });
    expect(store().currentSession?.startedAt).toBe(new Date(NOW + 30 * MIN).toISOString());
  });

  it('keeps alerts of the phases that just ended when re-arming', () => {
    mockSettingsState.pomodoroSettings.autoStartBreaks = true;
    usePomodoroStore.setState({ timer: running(), currentSession: session() });
    store().syncTimer({ now: NOW + 26 * MIN });

    expect(lastArmed()[1]).toEqual({ keepBelow: 1 });
  });
});

describe('stop, skip, reset', () => {
  it('stop shows the configured focus length (bug 5)', () => {
    mockSettingsState.pomodoroSettings.focusDuration = 50 * 60;
    store().startTimer();
    store().stopTimer();

    expect(timer()).toMatchObject({ state: 'stopped', phase: 'idle', totalTime: 3000, remainingTime: 3000 });
    expect(usePomodoroClock.getState().remainingSeconds).toBe(3000);
  });

  it('stop records an unfinished session as incomplete and breaks the combo', () => {
    usePomodoroStore.setState({ timer: running(), currentSession: session() });
    jest.setSystemTime(NOW + 10 * MIN);
    store().stopTimer();

    expect(store().sessions[0]).toMatchObject({ wasCompleted: false, duration: 600 });
    expect(mockResetSessionCombo).toHaveBeenCalledTimes(1);
    expect(mockIncrementPomodoro).not.toHaveBeenCalled();
  });

  it('stop on a phase that already ended credits it instead of abandoning it (bug 4)', () => {
    usePomodoroStore.setState({ timer: running(), currentSession: session() });
    jest.setSystemTime(NOW + 26 * MIN);
    store().stopTimer();

    expect(mockIncrementPomodoro).toHaveBeenCalledTimes(1);
    expect(store().sessions).toHaveLength(1);
    expect(store().sessions[0].wasCompleted).toBe(true);
    expect(mockResetSessionCombo).not.toHaveBeenCalled();
  });

  it('skip records the session as incomplete and readies the next phase', () => {
    usePomodoroStore.setState({ timer: running(), currentSession: session() });
    jest.setSystemTime(NOW + 5 * MIN);
    store().skipToNextPhase();

    expect(store().sessions[0]).toMatchObject({ wasCompleted: false, duration: 300 });
    expect(timer()).toMatchObject({ state: 'stopped', phase: 'short_break', sessionsCompleted: 1, totalTime: 300 });
    expect(mockIncrementPomodoro).not.toHaveBeenCalled();
    expect(lastArmed()[0].timer.state).toBe('stopped');
  });

  it('reset returns to the configured focus length', () => {
    mockSettingsState.pomodoroSettings.focusDuration = 40 * 60;
    store().startTimer();
    store().resetTimer();
    expect(timer()).toMatchObject({ state: 'stopped', phase: 'idle', totalTime: 2400, sessionsCompleted: 0 });
  });

  it('setPhase readies the given phase', () => {
    store().setPhase('long_break');
    expect(timer()).toMatchObject({ phase: 'long_break', state: 'stopped', totalTime: 900 });
  });
});

describe('clock and display', () => {
  it('the display counts down from timestamps without touching persisted state', () => {
    store().startTimer();
    const persisted = timer();
    jest.advanceTimersByTime(3000);

    expect(usePomodoroClock.getState().remainingSeconds).toBe(1497);
    expect(timer()).toBe(persisted);
  });

  it('clamps the display to the phase length when the clock moves back (bug 7)', () => {
    usePomodoroStore.setState({ timer: running(), currentSession: session() });
    jest.setSystemTime(NOW - 60 * MIN);
    store().syncTimer({ source: 'foreground' });

    // Not 85:00: the phase restarts from the new "now" instead.
    expect(usePomodoroClock.getState().remainingSeconds).toBe(1500);
    expect(timer()).toMatchObject({ state: 'running', startedAt: NOW - 60 * MIN, totalPausedDuration: 0 });
    expect(mockIncrementPomodoro).not.toHaveBeenCalled();
  });

  it('buzzes when the in-app clock completes a phase in the foreground', () => {
    store().startTimer();
    jest.advanceTimersByTime(25 * MIN + 1000);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });

  it('does not buzz on catch-up after returning to the app', () => {
    usePomodoroStore.setState({ timer: running(), currentSession: session() });
    store().syncTimer({ now: NOW + 26 * MIN, source: 'foreground' });
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });
});

describe('settings and links', () => {
  it('applySettingsToTimer updates a stopped timer only', () => {
    store().applySettingsToTimer({ ...DEFAULT_POMODORO_SETTINGS, focusDuration: 30 * 60 });
    expect(timer().totalTime).toBe(1800);

    usePomodoroStore.setState({ timer: running() });
    store().applySettingsToTimer({ ...DEFAULT_POMODORO_SETTINGS, focusDuration: 45 * 60 });
    expect(timer().totalTime).toBe(1500);
  });

  it('refreshAlerts never cancels the alerts of the current chain position or earlier', () => {
    usePomodoroStore.setState({ timer: running({ chainIndex: 2 }), currentSession: session() });
    store().refreshAlerts();
    expect(lastArmed()[1]).toEqual({ keepBelow: 2 });
  });

  it('linkTodo updates the timer and the running session', () => {
    usePomodoroStore.setState({ timer: running(), currentSession: session() });
    store().linkTodo('todo-2');
    expect(timer().linkedTodoId).toBe('todo-2');
    expect(store().currentSession?.todoId).toBe('todo-2');
  });
});

describe('persistence', () => {
  it('does not write to storage on display ticks', async () => {
    store().startTimer();
    await Promise.resolve();
    const writes = () =>
      (AsyncStorage.setItem as jest.Mock).mock.calls.filter(([key]) => key === 'pomodoro-storage').length;
    const before = writes();
    jest.advanceTimersByTime(10_000);
    await Promise.resolve();

    expect(writes()).toBe(before);
  });

  it('persists only timer, sessions and the current session', () => {
    const { partialize } = usePomodoroStore.persist.getOptions();
    const persisted = partialize!(usePomodoroStore.getState()) as Record<string, unknown>;
    expect(Object.keys(persisted).sort()).toEqual(['currentSession', 'sessions', 'timer']);
  });

  it('declares a version for migrations', () => {
    expect(usePomodoroStore.persist.getOptions().version).toBe(1);
  });

  it('migrates a v0 timer: adds chainIndex, drops notificationId, clamps values', () => {
    const migrated = migratePomodoroState({
      timer: {
        ...running(),
        notificationId: 'abc',
        chainIndex: undefined,
        totalPausedDuration: -40,
        remainingTime: 5100,
      },
      sessions: [session()],
      currentSession: session(),
    });

    expect(migrated.timer).not.toHaveProperty('notificationId');
    expect(migrated.timer).toMatchObject({ chainIndex: 0, totalPausedDuration: 0, remainingTime: 1500 });
    expect(migrated.sessions).toHaveLength(1);
  });

  it('drops impossible states on migration', () => {
    const migrated = migratePomodoroState({
      timer: { ...running(), startedAt: null },
      currentSession: session(),
    });
    expect(migrated.timer.state).toBe('stopped');
    expect(migrated.currentSession).toBeNull();
    expect(migrated.sessions).toEqual([]);
  });

  it('does not catch up while hydrating (stores it credits may not be loaded yet)', async () => {
    await AsyncStorage.setItem(
      'pomodoro-storage',
      JSON.stringify({ state: { timer: running(), sessions: [], currentSession: session() }, version: 1 }),
    );
    jest.setSystemTime(NOW + 60 * MIN);
    await usePomodoroStore.persist.rehydrate();

    expect(timer().state).toBe('running');
    expect(mockIncrementPomodoro).not.toHaveBeenCalled();
    await AsyncStorage.removeItem('pomodoro-storage');
  });
});
