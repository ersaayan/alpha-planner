/**
 * Lifecycle integration: real stores and the real alert scheduler, with only
 * expo-notifications, AsyncStorage and the router mocked.
 */
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
  useNavigationContainerRef: () => mockNavigationRef,
}));
const mockNavigationRef = { isReady: () => true, addListener: jest.fn(() => jest.fn()) };

import { act, renderHook } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { AppState, type AppStateStatus } from 'react-native';

import {
  handleTimerResponse,
  usePomodoroLifecycle,
  whenTimerStoresHydrated,
} from '@/hooks/use-pomodoro-lifecycle';
import { notificationService } from '@/services/notifications';
import {
  NOTIFICATION_KIND,
  PHASE_END_IDS,
  POMODORO_ACTIONS,
  whenAlertsSettled,
} from '@/services/notifications/pomodoro-alerts';
import { useGamificationStore } from '@/stores/gamification-store';
import { stopPomodoroEngine, usePomodoroStore } from '@/stores/pomodoro-store';
import { useSettingsStore } from '@/stores/settings-store';
import { DEFAULT_APP_SETTINGS, DEFAULT_POMODORO_SETTINGS, INITIAL_TIMER_STATE, INITIAL_USER_STATS } from '@/types';

const NOW = 1_700_000_000_000;
const MIN = 60_000;

const cancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const schedule = Notifications.scheduleNotificationAsync as jest.Mock;

let appStateListener: ((state: AppStateStatus) => void) | null = null;

function response(actionIdentifier: string, data: Record<string, unknown> = {}, id = 'pomodoro-phase-end-0') {
  return {
    actionIdentifier,
    notification: {
      date: Date.now(),
      request: { identifier: id, content: { data: { kind: NOTIFICATION_KIND.ongoing, url: '/pomodoro', ...data } } },
    },
  } as unknown as Notifications.NotificationResponse;
}

async function settle() {
  await act(async () => {
    await whenAlertsSettled();
  });
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
  useSettingsStore.setState({
    settings: { ...DEFAULT_APP_SETTINGS, hasCompletedOnboarding: true, notificationsEnabled: true },
    pomodoroSettings: { ...DEFAULT_POMODORO_SETTINGS },
  });
  useGamificationStore.setState({ stats: { ...INITIAL_USER_STATS } });
  usePomodoroStore.setState({ timer: { ...INITIAL_TIMER_STATE }, sessions: [], currentSession: null });
  jest.clearAllMocks();
});

afterEach(() => {
  stopPomodoroEngine();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('whenTimerStoresHydrated', () => {
  const fakeStore = (hydrated: boolean) => {
    const listeners: (() => void)[] = [];
    return {
      persist: {
        hasHydrated: () => hydrated,
        onFinishHydration: (listener: () => void) => {
          listeners.push(listener);
          return () => undefined;
        },
      },
      finish: () => listeners.forEach((l) => l()),
    };
  };

  it('waits for every store, then fires once', () => {
    const a = fakeStore(false);
    const b = fakeStore(false);
    const c = fakeStore(true);
    const callback = jest.fn();
    whenTimerStoresHydrated(callback, [a, b, c]);

    a.finish();
    expect(callback).not.toHaveBeenCalled();
    b.finish();
    b.finish();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('fires immediately when everything is hydrated', () => {
    const callback = jest.fn();
    whenTimerStoresHydrated(callback, [fakeStore(true)]);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe('usePomodoroLifecycle', () => {
  it('sets up notifications without asking for permission at launch', async () => {
    await renderHook(() => usePomodoroLifecycle());
    expect(notificationService.initialize).toHaveBeenCalled();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(notificationService.syncDailySummary).toHaveBeenCalledWith(true);
  });

  it('never cancels or reschedules alerts on AppState changes', async () => {
    await renderHook(() => usePomodoroLifecycle());
    usePomodoroStore.getState().startTimer();
    await settle();
    cancel.mockClear();
    schedule.mockClear();

    jest.setSystemTime(NOW + 5 * MIN);
    expect(appStateListener).not.toBeNull();
    await act(async () => {
      appStateListener?.('inactive');
      appStateListener?.('background');
      appStateListener?.('active');
    });
    await settle();

    expect(cancel).not.toHaveBeenCalled();
    expect(schedule).not.toHaveBeenCalled();
    expect(usePomodoroStore.getState().timer.state).toBe('running');
  });

  it('on return after the phase ended, credits once and keeps the fired alert', async () => {
    await renderHook(() => usePomodoroLifecycle());
    usePomodoroStore.getState().startTimer();
    await settle();
    cancel.mockClear();

    jest.setSystemTime(NOW + 40 * MIN);
    await act(async () => {
      appStateListener?.('active');
    });
    await settle();

    expect(useGamificationStore.getState().stats.totalPomodoros).toBe(1);
    expect(cancel).not.toHaveBeenCalledWith('pomodoro-phase-end-0');
  });

  it.each([
    ['pause', () => usePomodoroStore.getState().pauseTimer()],
    ['stop', () => usePomodoroStore.getState().stopTimer()],
    ['skip', () => usePomodoroStore.getState().skipToNextPhase()],
  ])('cancels every pending alert on %s', async (_name, action) => {
    usePomodoroStore.getState().startTimer();
    await settle();
    cancel.mockClear();

    jest.setSystemTime(NOW + MIN);
    action();
    await settle();

    expect(cancel.mock.calls.map(([id]) => id).sort()).toEqual([...PHASE_END_IDS].sort());
  });

  it('turning notifications off cancels the alerts and the daily summary; on asks again', async () => {
    await renderHook(() => usePomodoroLifecycle());
    usePomodoroStore.getState().startTimer();
    await settle();
    cancel.mockClear();

    await act(async () => {
      useSettingsStore.getState().updateSettings({ notificationsEnabled: false });
    });
    await settle();
    expect(cancel.mock.calls.map(([id]) => id).sort()).toEqual([...PHASE_END_IDS].sort());
    expect(notificationService.syncDailySummary).toHaveBeenLastCalledWith(false);

    await act(async () => {
      useSettingsStore.getState().updateSettings({ notificationsEnabled: true });
    });
    await settle();
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  it('handles the response that launched the app once stores are ready', async () => {
    usePomodoroStore.getState().startTimer();
    jest.setSystemTime(NOW + 5 * MIN);
    (Notifications.getLastNotificationResponse as jest.Mock).mockReturnValueOnce(
      response(POMODORO_ACTIONS.pause, { phaseStartedAt: NOW }, 'launch-1'),
    );

    await renderHook(() => usePomodoroLifecycle());
    await settle();

    expect(usePomodoroStore.getState().timer.state).toBe('paused');
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled();
    jest.runOnlyPendingTimers();
    expect(mockNavigate).toHaveBeenCalledWith('/pomodoro');
  });
});

describe('handleTimerResponse', () => {
  it('syncs before pausing: an ended focus is credited, the auto-started break is paused', () => {
    useSettingsStore.getState().updatePomodoroSettings({ autoStartBreaks: true });
    usePomodoroStore.getState().startTimer();
    jest.setSystemTime(NOW + 27 * MIN);

    handleTimerResponse(response(POMODORO_ACTIONS.pause, { phaseStartedAt: NOW }, 'pause-1'));

    expect(useGamificationStore.getState().stats.totalPomodoros).toBe(1);
    expect(usePomodoroStore.getState().timer).toMatchObject({ phase: 'short_break', state: 'paused' });
  });

  it('Stop on a phase that already ended records it as completed', () => {
    usePomodoroStore.getState().startTimer();
    jest.setSystemTime(NOW + 26 * MIN);

    handleTimerResponse(response(POMODORO_ACTIONS.stop, {}, 'stop-1'));

    expect(usePomodoroStore.getState().sessions.map((s) => s.wasCompleted)).toEqual([true]);
  });

  it('Skip from a stale notification does not skip the next phase', () => {
    useSettingsStore.getState().updatePomodoroSettings({ autoStartBreaks: true });
    usePomodoroStore.getState().startTimer();
    jest.setSystemTime(NOW + 27 * MIN);

    handleTimerResponse(response(POMODORO_ACTIONS.skip, { phaseStartedAt: NOW }, 'skip-1'));

    expect(usePomodoroStore.getState().timer).toMatchObject({ phase: 'short_break', state: 'running' });
  });

  it('Skip from the current phase skips it', () => {
    usePomodoroStore.getState().startTimer();
    jest.setSystemTime(NOW + 5 * MIN);

    handleTimerResponse(response(POMODORO_ACTIONS.skip, { phaseStartedAt: NOW }, 'skip-2'));

    expect(usePomodoroStore.getState().timer).toMatchObject({ phase: 'short_break', state: 'stopped' });
  });

  it('handles each response once', () => {
    usePomodoroStore.getState().startTimer();
    const pause = response(POMODORO_ACTIONS.pause, {}, 'dup-1');
    handleTimerResponse(pause);
    usePomodoroStore.getState().resumeTimer();
    handleTimerResponse(pause);
    expect(usePomodoroStore.getState().timer.state).toBe('running');
  });

  it('a plain tap opens the timer screen', () => {
    expect(handleTimerResponse(response(Notifications.DEFAULT_ACTION_IDENTIFIER, {}, 'tap-1'))).toBe('/pomodoro');
    expect(
      handleTimerResponse({
        ...response(Notifications.DEFAULT_ACTION_IDENTIFIER, {}, 'tap-2'),
        notification: { date: 1, request: { identifier: 'daily', content: { data: {} } } },
      } as unknown as Notifications.NotificationResponse),
    ).toBeNull();
  });
});
