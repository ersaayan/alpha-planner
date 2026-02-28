/**
 * Background task for Pomodoro timer using expo-background-fetch + expo-task-manager.
 *
 * This task runs periodically when the app is backgrounded/killed.
 * It reads the persisted timer state from AsyncStorage, checks if a phase
 * has completed, handles phase transitions (with auto-start), schedules
 * the next completion notification, and writes the updated state back.
 *
 * This is a safety net — the primary mechanism is the scheduled notification
 * at the exact completion time. This task handles multi-phase transitions
 * that the single scheduled notification cannot cover.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

import type { PomodoroPhase, PomodoroSettings, PomodoroTimerState } from '@/types';
import { DEFAULT_POMODORO_SETTINGS, INITIAL_TIMER_STATE } from '@/types';
import { scheduleTimerNotification } from './pomodoro-task';

// ── Constants ────────────────────────────────────────────────────────────────
const POMODORO_BG_TASK = 'pomodoro-background-sync';

// Storage keys matching Zustand persist config
const POMODORO_STORAGE_KEY = 'pomodoro-storage';
const SETTINGS_STORAGE_KEY = 'settings-storage';

// ── Helpers (duplicated from store to avoid importing React-dependent code) ──
function getPhaseDuration(phase: PomodoroPhase, settings: PomodoroSettings): number {
  if (phase === 'focus') return settings.focusDuration;
  if (phase === 'short_break') return settings.shortBreakDuration;
  if (phase === 'long_break') return settings.longBreakDuration;
  return settings.focusDuration;
}

function getNextPhase(
  phase: PomodoroPhase,
  sessionsCompleted: number,
  settings: PomodoroSettings,
): PomodoroPhase {
  if (phase === 'focus') {
    return sessionsCompleted % settings.sessionsUntilLongBreak === 0
      ? 'long_break'
      : 'short_break';
  }
  return 'focus';
}

// ── Read persisted Zustand state from AsyncStorage ──────────────────────────
async function readPersistedTimer(): Promise<{
  timer: PomodoroTimerState;
  rawParsed: Record<string, unknown>;
} | null> {
  try {
    const raw = await AsyncStorage.getItem(POMODORO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const timer: PomodoroTimerState | undefined = parsed?.state?.timer;
    if (!timer) return null;
    return { timer, rawParsed: parsed };
  } catch {
    return null;
  }
}

async function readPersistedSettings(): Promise<{
  pomodoroSettings: PomodoroSettings;
  soundEnabled: boolean;
}> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { pomodoroSettings: DEFAULT_POMODORO_SETTINGS, soundEnabled: true };
    }
    const parsed = JSON.parse(raw);
    return {
      pomodoroSettings: parsed?.state?.pomodoroSettings ?? DEFAULT_POMODORO_SETTINGS,
      soundEnabled: parsed?.state?.settings?.soundEnabled ?? true,
    };
  } catch {
    return { pomodoroSettings: DEFAULT_POMODORO_SETTINGS, soundEnabled: true };
  }
}

async function writePersistedTimer(
  rawParsed: Record<string, unknown>,
  timer: PomodoroTimerState,
): Promise<void> {
  try {
    const updated = {
      ...rawParsed,
      state: {
        ...(rawParsed.state as Record<string, unknown>),
        timer,
      },
    };
    await AsyncStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn('[PomoBgTask] Failed to write timer state:', error);
  }
}

// ── Define the background task (MUST be in global scope) ────────────────────
TaskManager.defineTask(POMODORO_BG_TASK, async () => {
  try {
    const result = await readPersistedTimer();
    if (!result) return BackgroundFetch.BackgroundFetchResult.NoData;

    const { timer, rawParsed } = result;

    // Only process running timers
    if (timer.state !== 'running' || !timer.startedAt) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const nowMs = Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - timer.startedAt) / 1000));
    const remaining = timer.totalTime - elapsedSeconds;

    // Timer has NOT completed yet — nothing to do (scheduled notification handles completion)
    if (remaining > 0) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // ── Timer phase completed while in background ──
    const { pomodoroSettings, soundEnabled } = await readPersistedSettings();

    let currentTimer = { ...timer };
    let currentElapsed = elapsedSeconds;

    // Walk through completed phases
    while (currentElapsed >= currentTimer.totalTime) {
      currentElapsed -= currentTimer.totalTime;

      const isFocus = currentTimer.phase === 'focus';
      const newSessionsCompleted = isFocus
        ? currentTimer.sessionsCompleted + 1
        : currentTimer.sessionsCompleted;

      const shouldAutoContinue =
        (isFocus && pomodoroSettings.autoStartBreaks) ||
        (!isFocus && pomodoroSettings.autoStartFocus);

      if (!shouldAutoContinue) {
        // Stop here — user needs to manually start the next phase
        const nextPhase = getNextPhase(currentTimer.phase, newSessionsCompleted, pomodoroSettings);
        const nextDuration = getPhaseDuration(nextPhase, pomodoroSettings);

        const stoppedTimer: PomodoroTimerState = {
          ...currentTimer,
          phase: nextPhase,
          state: 'stopped',
          remainingTime: nextDuration,
          totalTime: nextDuration,
          sessionsCompleted: newSessionsCompleted,
          startedAt: null,
          pausedAt: null,
          currentSessionId: null,
        };

        await writePersistedTimer(rawParsed, stoppedTimer);
        return BackgroundFetch.BackgroundFetchResult.NewData;
      }

      // Auto-start: advance to the next phase
      const nextPhase = getNextPhase(currentTimer.phase, newSessionsCompleted, pomodoroSettings);
      const nextDuration = getPhaseDuration(nextPhase, pomodoroSettings);
      const nextStartedAt = currentTimer.startedAt! + currentTimer.totalTime * 1000;

      currentTimer = {
        ...currentTimer,
        phase: nextPhase,
        remainingTime: nextDuration,
        totalTime: nextDuration,
        sessionsCompleted: newSessionsCompleted,
        startedAt: nextStartedAt,
        linkedTodoId: currentTimer.linkedTodoId,
      };
    }

    // We've walked through all completed phases.
    // The current phase is still running — update remaining time & schedule notification.
    const newRemaining = Math.max(0, currentTimer.totalTime - currentElapsed);

    const updatedTimer: PomodoroTimerState = {
      ...currentTimer,
      remainingTime: newRemaining,
    };

    await writePersistedTimer(rawParsed, updatedTimer);

    // Schedule notification for the current phase's completion
    if (newRemaining > 0) {
      await scheduleTimerNotification(
        currentTimer.phase as 'focus' | 'short_break' | 'long_break',
        newRemaining,
        {
          soundEnabled,
          vibrationEnabled: pomodoroSettings.vibrationEnabled,
        },
      );
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('[PomoBgTask] Background task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ── Registration helpers ────────────────────────────────────────────────────
export async function registerPomodoroBackgroundTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(POMODORO_BG_TASK);
    if (isRegistered) return;

    await BackgroundFetch.registerTaskAsync(POMODORO_BG_TASK, {
      minimumInterval: 60, // 1 minute (Android respects; iOS uses ~15 min minimum)
      stopOnTerminate: false, // Continue after app kill (Android)
      startOnBoot: true, // Re-register after device reboot (Android)
    });
  } catch (error) {
    console.warn('[PomoBgTask] Failed to register background task:', error);
  }
}

export async function unregisterPomodoroBackgroundTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(POMODORO_BG_TASK);
    if (!isRegistered) return;

    await BackgroundFetch.unregisterTaskAsync(POMODORO_BG_TASK);
  } catch (error) {
    console.warn('[PomoBgTask] Failed to unregister background task:', error);
  }
}
