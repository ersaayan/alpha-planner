const mockHydration = { resolve: () => {}, promise: Promise.resolve() };

jest.mock('@/stores/hydration', () => ({
  whenStoresHydrated: jest.fn(() => mockHydration.promise),
}));

jest.mock('@/services/app/startup-tasks', () => ({
  runStartupTasks: jest.fn(),
  runDateDependentTasks: jest.fn(),
}));

import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { HYDRATION_TIMEOUT_MS, useAppBootstrap } from '@/hooks/use-app-bootstrap';
import { runDateDependentTasks, runStartupTasks } from '@/services/app/startup-tasks';
import { changeLanguage } from '@/services/i18n/i18n-config';
import { useSettingsStore } from '@/stores/settings-store';
import { DEFAULT_APP_SETTINGS } from '@/types';

let appStateListeners: ((state: AppStateStatus) => void)[] = [];

function emitAppState(state: AppStateStatus) {
  appStateListeners.forEach((listener) => listener(state));
}

function deferHydration() {
  mockHydration.promise = new Promise<void>((resolve) => {
    mockHydration.resolve = resolve;
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  appStateListeners = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListeners.push(listener as (state: AppStateStatus) => void);
    return { remove: () => {} } as ReturnType<typeof AppState.addEventListener>;
  });
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  useSettingsStore.setState({ settings: { ...DEFAULT_APP_SETTINGS, language: 'tr' } });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useAppBootstrap', () => {
  it('runs the startup tasks only after the stores have hydrated', async () => {
    deferHydration();
    const { result } = await renderHook(() => useAppBootstrap());

    expect(result.current).toBe(false);
    expect(runStartupTasks).not.toHaveBeenCalled();

    await act(async () => {
      mockHydration.resolve();
    });

    expect(runStartupTasks).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(true);
  });

  it('restores the saved language after hydration', async () => {
    mockHydration.promise = Promise.resolve();
    await renderHook(() => useAppBootstrap());
    await act(async () => {});

    expect(changeLanguage).toHaveBeenCalledWith('tr');
  });

  it('shows the app after the timeout without running the startup tasks', async () => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    deferHydration();
    const { result } = await renderHook(() => useAppBootstrap());

    await act(async () => {
      jest.advanceTimersByTime(HYDRATION_TIMEOUT_MS);
    });

    expect(result.current).toBe(true);
    expect(runStartupTasks).not.toHaveBeenCalled();
  });

  it('re-runs the date-dependent tasks when the app returns to the foreground', async () => {
    mockHydration.promise = Promise.resolve();
    await renderHook(() => useAppBootstrap());
    await act(async () => {});
    (runDateDependentTasks as jest.Mock).mockClear();

    await act(async () => {
      emitAppState('background');
      emitAppState('active');
    });

    expect(runDateDependentTasks).toHaveBeenCalledTimes(1);
  });

  it('re-runs them when the local date changes while the app stays open', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-18T23:59:30') }); // a Sunday night
    mockHydration.promise = Promise.resolve();
    await renderHook(() => useAppBootstrap());
    await act(async () => {});
    (runDateDependentTasks as jest.Mock).mockClear();

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });

    expect(runDateDependentTasks).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(runDateDependentTasks).toHaveBeenCalledTimes(1);
  });

  it('applies a language change from settings', async () => {
    mockHydration.promise = Promise.resolve();
    await renderHook(() => useAppBootstrap());
    await act(async () => {});
    (changeLanguage as jest.Mock).mockClear();

    await act(async () => {
      useSettingsStore.getState().updateSettings({ language: 'en' });
    });

    expect(changeLanguage).toHaveBeenCalledWith('en');
  });
});
