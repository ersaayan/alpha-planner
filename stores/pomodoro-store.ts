import { armAlerts, type AlertSnapshot } from '@/services/notifications/pomodoro-alerts';
import type { PomodoroPhase, PomodoroSession, PomodoroSettings, PomodoroTimerState } from '@/types';
import { INITIAL_TIMER_STATE } from '@/types';
import {
  ALERT_CHAIN_LIMIT,
  getNextPhase,
  getPhaseDuration,
  getPhaseEndMs,
  getRemainingMs,
  getRemainingSeconds,
  readyTimer,
  reconcileTimer,
  sanitizeTimerState,
  toActivePhase,
  type ActivePhase,
  type ReconcileResult,
} from '@/utils/pomodoro-helpers';
import { generateId } from '@/utils/uuid';
import * as Haptics from 'expo-haptics';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useGamificationStore } from './gamification-store';
import { createPersistOptions } from './persist';
import { useSettingsStore } from './settings-store';
import { useTodoStore } from './todo-store';

export const POMODORO_STORE_VERSION = 1;
const SESSION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
// A running phase that ends further away than its own length means the wall clock
// moved back past its start; the phase restarts instead of freezing the display.
const CLOCK_SKEW_TOLERANCE_MS = 2000;

/** What triggered a sync. Only 'tick' (the in-app clock reaching a phase end) buzzes. */
export type SyncSource = 'tick' | 'foreground' | 'launch' | 'action';

interface PomodoroState {
  timer: PomodoroTimerState;
  sessions: PomodoroSession[];
  currentSession: PomodoroSession | null;

  /** Starts the current phase, or resumes it when paused. */
  startTimer: (linkedTodoId?: string | null) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  resetTimer: () => void;
  skipToNextPhase: () => void;
  setPhase: (phase: PomodoroPhase) => void;

  /**
   * Brings a running timer up to the wall clock: completes (and credits, once) every
   * phase that has ended, then keeps the in-app clock running.
   */
  syncTimer: (options?: { now?: number; source?: SyncSource }) => void;
  /** Re-arms the alerts after a settings, permission or language change. */
  refreshAlerts: () => void;

  linkTodo: (todoId: string | null) => void;
  applySettingsToTimer: (settings?: PomodoroSettings) => void;
}

type PersistedPomodoroState = Pick<PomodoroState, 'timer' | 'sessions' | 'currentSession'>;

/** Live display state. Not persisted: it is derived from the timer's timestamps. */
interface PomodoroClockState {
  remainingSeconds: number;
}

export const usePomodoroClock = create<PomodoroClockState>()(() => ({
  remainingSeconds: INITIAL_TIMER_STATE.totalTime,
}));

function publishRemaining(timer: PomodoroTimerState, nowMs = Date.now()): void {
  const remainingSeconds = getRemainingSeconds(timer, nowMs);
  if (usePomodoroClock.getState().remainingSeconds !== remainingSeconds) {
    usePomodoroClock.setState({ remainingSeconds });
  }
}

// ── Side effects ────────────────────────────────────────────────────────

function alertSnapshot(timer: PomodoroTimerState): AlertSnapshot {
  const { settings, pomodoroSettings } = useSettingsStore.getState();
  return {
    timer,
    pomodoroSettings,
    notificationsEnabled: settings.notificationsEnabled,
    soundEnabled: settings.soundEnabled,
    use24HourClock: settings.timeFormat !== '12h',
  };
}

function arm(timer: PomodoroTimerState, keepBelow = 0): void {
  void armAlerts(alertSnapshot(timer), { keepBelow });
}

function createSession(
  phase: ActivePhase,
  startedAtMs: number,
  todoId: string | null,
  totalTime: number,
): PomodoroSession {
  return {
    id: generateId(),
    todoId,
    phase,
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: null,
    pausedDuration: 0,
    wasCompleted: false,
    duration: 0,
    targetDuration: totalTime,
  };
}

/** Closes an unfinished session (stop, skip, phase change). */
function abandonSession(
  timer: PomodoroTimerState,
  session: PomodoroSession,
  nowMs: number,
): PomodoroSession {
  const pausedExtra =
    timer.state === 'paused' && timer.pausedAt !== null ? Math.max(0, nowMs - timer.pausedAt) : 0;
  return {
    ...session,
    endedAt: new Date(nowMs).toISOString(),
    duration: Math.round(timer.totalTime - getRemainingMs(timer, nowMs) / 1000),
    wasCompleted: false,
    pausedDuration: session.pausedDuration + pausedExtra,
  };
}

function enqueueSessionSync(session: PomodoroSession): void {
  try {
    const { useSyncStore } = require('./sync-store');
    useSyncStore.getState().enqueue('pomodoro_sessions', 'insert', {
      id: session.id,
      todo_id: session.todoId ?? null,
      phase: session.phase,
      duration: session.duration,
      target_duration: session.targetDuration,
      was_completed: session.wasCompleted,
      started_at: session.startedAt,
      ended_at: session.endedAt,
      paused_duration: session.pausedDuration,
    });
  } catch {
    // Sync is optional; a failed enqueue never blocks the timer.
  }
}

function creditFocus(session: PomodoroSession): void {
  try {
    const completedAt = new Date(session.endedAt ?? Date.now());
    useGamificationStore.getState().incrementPomodoro(session.duration, completedAt, {
      startedAt: new Date(session.startedAt),
      pausedMs: session.pausedDuration,
    });
    if (session.todoId) {
      useTodoStore.getState().incrementPomodoroCount(session.todoId);
    }
  } catch (error) {
    console.warn('[Pomodoro] Failed to credit focus session:', error);
  }
}

/** Breaks feed the "take your breaks" quest and achievement. */
function creditBreak(at: Date, skipped: boolean): void {
  try {
    useGamificationStore.getState().recordBreak(at, skipped);
  } catch (error) {
    console.warn('[Pomodoro] Failed to record a break:', error);
  }
}

function resetSessionCombo(): void {
  try {
    useGamificationStore.getState().resetSessionCombo();
  } catch {
    // Non-fatal.
  }
}

function buzz(): void {
  if (!useSettingsStore.getState().pomodoroSettings.vibrationEnabled) return;
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  } catch {
    // Haptics are a nicety.
  }
}

function pruneSessions(sessions: PomodoroSession[]): PomodoroSession[] {
  const cutoff = Date.now() - SESSION_RETENTION_MS;
  return sessions.filter((s) => new Date(s.startedAt).getTime() >= cutoff);
}

// ── In-app clock ────────────────────────────────────────────────────────
// One timeout, outside React, wakes when the displayed second changes or the phase
// ends. It only refreshes the display and triggers syncTimer; the alerts never depend
// on it. JS timers stop in the background, which is fine: syncTimer runs on return.

let wakeHandle: ReturnType<typeof setTimeout> | null = null;

export function stopPomodoroEngine(): void {
  if (wakeHandle !== null) {
    clearTimeout(wakeHandle);
    wakeHandle = null;
  }
}

function runEngine(): void {
  stopPomodoroEngine();
  const { timer } = usePomodoroStore.getState();
  const endMs = getPhaseEndMs(timer);
  if (timer.state !== 'running' || endMs === null) return;

  const nowMs = Date.now();
  publishRemaining(timer, nowMs);
  const untilEnd = endMs - nowMs;
  const untilNextSecond = ((untilEnd % 1000) + 1000) % 1000 || 1000;
  wakeHandle = setTimeout(onWake, Math.max(0, Math.min(untilEnd, untilNextSecond)));
}

function onWake(): void {
  wakeHandle = null;
  const store = usePomodoroStore.getState();
  const endMs = getPhaseEndMs(store.timer);
  if (store.timer.state !== 'running' || endMs === null) return;
  if (Date.now() >= endMs) {
    store.syncTimer({ source: 'tick' });
  } else {
    runEngine();
  }
}

// ── Store ───────────────────────────────────────────────────────────────

export const usePomodoroStore = create<PomodoroState>()(
  persist(
    (set, get) => {
      /**
       * The only completion path: records, credits and syncs each finished phase exactly
       * once, using the phase's own length and its real end time.
       */
      const commit = (result: ReconcileResult, source: SyncSource) => {
        const { timer: previous, currentSession, sessions } = get();
        const records = result.completed.map((phase, index): PomodoroSession => {
          const base =
            index === 0 && currentSession
              ? currentSession
              : createSession(phase.phase, phase.startedAt, previous.linkedTodoId, phase.totalTime);
          return {
            ...base,
            todoId: base.todoId ?? previous.linkedTodoId,
            phase: phase.phase,
            endedAt: new Date(phase.completedAt).toISOString(),
            duration: phase.totalTime,
            targetDuration: phase.totalTime,
            wasCompleted: true,
          };
        });

        let timer = result.timer;
        let nextSession: PomodoroSession | null = null;
        if (timer.state === 'running' && timer.startedAt !== null) {
          nextSession = createSession(
            toActivePhase(timer.phase),
            timer.startedAt,
            timer.linkedTodoId,
            timer.totalTime,
          );
          timer = { ...timer, currentSessionId: nextSession.id };
        }

        // State first, so a re-entrant sync sees the advanced timer and cannot credit again.
        set({ timer, currentSession: nextSession, sessions: [...sessions, ...records] });

        for (const record of records) {
          if (record.phase === 'focus') creditFocus(record);
          else creditBreak(new Date(record.endedAt ?? Date.now()), false);
          enqueueSessionSync(record);
        }

        // Keep the alerts of the phases that just ended: they may still be about to fire.
        const last = result.completed[result.completed.length - 1];
        arm(timer, last.chainIndex + 1);
        if (source === 'tick' && AppState.currentState === 'active') buzz();
      };

      return {
        timer: INITIAL_TIMER_STATE,
        sessions: [],
        currentSession: null,

        startTimer: (linkedTodoId) => {
          const { timer } = get();
          if (timer.state === 'running') return;
          if (timer.state === 'paused') {
            if (linkedTodoId !== undefined) get().linkTodo(linkedTodoId);
            get().resumeTimer();
            return;
          }

          const settings = useSettingsStore.getState().pomodoroSettings;
          const phase = toActivePhase(timer.phase);
          const totalTime = getPhaseDuration(phase, settings);
          const nowMs = Date.now();
          const todoId = linkedTodoId ?? timer.linkedTodoId;
          const session = createSession(phase, nowMs, todoId, totalTime);
          const next: PomodoroTimerState = {
            ...timer,
            phase,
            state: 'running',
            totalTime,
            remainingTime: totalTime,
            linkedTodoId: todoId,
            currentSessionId: session.id,
            startedAt: nowMs,
            pausedAt: null,
            totalPausedDuration: 0,
            chainIndex: 0,
          };

          set({ timer: next, currentSession: session });
          runEngine();
          arm(next);
        },

        pauseTimer: () => {
          // A phase that already ended is completed first, never paused at 00:00.
          get().syncTimer({ source: 'action' });
          const { timer } = get();
          if (timer.state !== 'running') return;

          const nowMs = Date.now();
          const next: PomodoroTimerState = {
            ...timer,
            state: 'paused',
            pausedAt: nowMs,
            remainingTime: getRemainingSeconds(timer, nowMs),
          };
          stopPomodoroEngine();
          set({ timer: next });
          arm(next);
        },

        resumeTimer: () => {
          const { timer, currentSession } = get();
          if (timer.state !== 'paused' || timer.pausedAt === null) return;

          const nowMs = Date.now();
          const pausedMs = Math.max(0, nowMs - timer.pausedAt);
          const resumed: PomodoroTimerState = {
            ...timer,
            state: 'running',
            pausedAt: null,
            totalPausedDuration: Math.max(0, timer.totalPausedDuration) + pausedMs / 1000,
            // A manual resume starts a fresh auto-start chain.
            chainIndex: 0,
          };
          const next = { ...resumed, remainingTime: getRemainingSeconds(resumed, nowMs) };

          set({
            timer: next,
            currentSession: currentSession
              ? { ...currentSession, pausedDuration: currentSession.pausedDuration + pausedMs }
              : null,
          });
          runEngine();
          arm(next);
        },

        stopTimer: () => {
          // A phase that already ended is credited, not recorded as abandoned.
          get().syncTimer({ source: 'action' });
          const { timer, currentSession, sessions } = get();
          const nowMs = Date.now();
          const wasActive = timer.state !== 'stopped';
          const ended = wasActive && currentSession ? abandonSession(timer, currentSession, nowMs) : null;

          const { focusDuration } = useSettingsStore.getState().pomodoroSettings;
          const next: PomodoroTimerState = {
            ...INITIAL_TIMER_STATE,
            totalTime: focusDuration,
            remainingTime: focusDuration,
            sessionsCompleted: timer.sessionsCompleted,
          };

          stopPomodoroEngine();
          set({ timer: next, currentSession: null, sessions: ended ? [...sessions, ended] : sessions });
          if (ended) enqueueSessionSync(ended);
          // Stopping breaks the session combo; pausing does not.
          if (wasActive) resetSessionCombo();
          arm(next);
        },

        resetTimer: () => {
          const { focusDuration } = useSettingsStore.getState().pomodoroSettings;
          const next: PomodoroTimerState = {
            ...INITIAL_TIMER_STATE,
            totalTime: focusDuration,
            remainingTime: focusDuration,
          };
          stopPomodoroEngine();
          set({ timer: next, currentSession: null });
          arm(next);
        },

        skipToNextPhase: () => {
          get().syncTimer({ source: 'action' });
          const { timer, currentSession, sessions } = get();
          const settings = useSettingsStore.getState().pomodoroSettings;
          const nowMs = Date.now();

          const phase = toActivePhase(timer.phase);
          // A skipped focus still counts towards the long-break cycle (no XP).
          const sessionsCompleted = phase === 'focus' ? timer.sessionsCompleted + 1 : timer.sessionsCompleted;
          const nextPhase = getNextPhase(phase, sessionsCompleted, settings);
          const ended =
            timer.state !== 'stopped' && currentSession ? abandonSession(timer, currentSession, nowMs) : null;
          const next = readyTimer(timer, nextPhase, settings, sessionsCompleted);

          stopPomodoroEngine();
          set({ timer: next, currentSession: null, sessions: ended ? [...sessions, ended] : sessions });
          if (ended) enqueueSessionSync(ended);
          if (phase !== 'focus') creditBreak(new Date(nowMs), true);
          arm(next);
        },

        setPhase: (phase) => {
          const { timer, currentSession, sessions } = get();
          const settings = useSettingsStore.getState().pomodoroSettings;
          const ended =
            timer.state !== 'stopped' && currentSession
              ? abandonSession(timer, currentSession, Date.now())
              : null;
          const next = readyTimer(timer, phase, settings, timer.sessionsCompleted);

          stopPomodoroEngine();
          set({ timer: next, currentSession: null, sessions: ended ? [...sessions, ended] : sessions });
          if (ended) enqueueSessionSync(ended);
          arm(next);
        },

        syncTimer: (options = {}) => {
          const nowMs = options.now ?? Date.now();
          let { timer } = get();
          if (timer.state !== 'running' || timer.startedAt === null) {
            stopPomodoroEngine();
            return;
          }

          const endMs = getPhaseEndMs(timer) ?? nowMs;
          if (endMs - nowMs > timer.totalTime * 1000 + CLOCK_SKEW_TOLERANCE_MS) {
            timer = { ...timer, startedAt: nowMs, totalPausedDuration: 0, remainingTime: timer.totalTime };
            set({ timer });
            arm(timer, timer.chainIndex);
          }

          const settings = useSettingsStore.getState().pomodoroSettings;
          const result = reconcileTimer(timer, settings, nowMs);
          if (result.completed.length > 0) {
            commit(result, options.source ?? 'action');
          }
          runEngine();
        },

        refreshAlerts: () => {
          get().syncTimer({ source: 'action' });
          get().applySettingsToTimer();
          const { timer } = get();
          // Never cancel alerts of phases that already ended.
          arm(timer, timer.state === 'running' ? timer.chainIndex : ALERT_CHAIN_LIMIT);
        },

        linkTodo: (todoId) => {
          set((state) => ({
            timer: { ...state.timer, linkedTodoId: todoId },
            currentSession: state.currentSession ? { ...state.currentSession, todoId } : null,
          }));
        },

        applySettingsToTimer: (settingsOverride) => {
          const { timer } = get();
          if (timer.state !== 'stopped') return;

          const settings = settingsOverride ?? useSettingsStore.getState().pomodoroSettings;
          const totalTime = getPhaseDuration(timer.phase, settings);
          if (timer.remainingTime === totalTime && timer.totalTime === totalTime) return;

          set({ timer: { ...timer, remainingTime: totalTime, totalTime } });
        },
      };
    },
    // Shared persistence (stores/persist.ts): no writes before hydration, and unreadable
    // data is backed up instead of failing hydration (which would block catch-up).
    createPersistOptions<PomodoroState, PersistedPomodoroState>({
      name: 'pomodoro-storage',
      version: POMODORO_STORE_VERSION,
      // Written only on state changes: the per-second display lives in usePomodoroClock.
      partialize: (state): PersistedPomodoroState => ({
        timer: state.timer,
        sessions: pruneSessions(state.sessions),
        currentSession: state.currentSession,
      }),
      migrate: (persisted) => migratePomodoroState(persisted),
      // Sanitize on every load, not only on version changes.
      normalize: migratePomodoroState,
      // Catch-up does NOT run here: it must wait until the stores it credits have
      // hydrated too (see hooks/use-pomodoro-lifecycle.ts).
    }),
  ),
);

/**
 * v0 → v1: drops `notificationId`, adds `chainIndex`, and clamps values that older
 * versions could persist (negative pause totals, remaining > total).
 */
export function migratePomodoroState(persisted: unknown): PersistedPomodoroState {
  const input = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>;
  const timer = sanitizeTimerState(input.timer);
  const currentSession = input.currentSession;
  return {
    timer,
    sessions: Array.isArray(input.sessions) ? (input.sessions as PomodoroSession[]) : [],
    currentSession:
      timer.state !== 'stopped' && currentSession && typeof currentSession === 'object'
        ? (currentSession as PomodoroSession)
        : null,
  };
}

// Keep the display in step with every timer change, whatever caused it.
usePomodoroStore.subscribe((state, previous) => {
  if (state.timer !== previous.timer) publishRemaining(state.timer);
});
