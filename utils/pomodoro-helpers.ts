/**
 * Pomodoro timer maths: the single source of truth for phase order, phase durations
 * and timestamp-based remaining time. Pure functions only. The store, the alert
 * scheduler and the screens all derive from these, so they always agree.
 */
import type { PomodoroPhase, PomodoroSettings, PomodoroState, PomodoroTimerState } from '@/types';
import { INITIAL_TIMER_STATE } from '@/types';

export type ActivePhase = Exclude<PomodoroPhase, 'idle'>;

/**
 * Most phase ends covered by one manual start. The alert chain pre-schedules at most
 * this many notifications (iOS keeps up to 64 pending), and unattended auto-start never
 * runs past it: after the last one the timer waits in the ready state of the next phase.
 */
export const ALERT_CHAIN_LIMIT = 8;

/** 'idle' means "ready to focus". */
export function toActivePhase(phase: PomodoroPhase): ActivePhase {
  return phase === 'idle' ? 'focus' : phase;
}

/** Duration in seconds of `phase` under `settings`. */
export function getPhaseDuration(phase: PomodoroPhase, settings: PomodoroSettings): number {
  switch (toActivePhase(phase)) {
    case 'short_break':
      return settings.shortBreakDuration;
    case 'long_break':
      return settings.longBreakDuration;
    default:
      return settings.focusDuration;
  }
}

/**
 * The phase that follows `phase`. `sessionsCompleted` is the focus count after `phase`
 * ended, so a long break follows every `sessionsUntilLongBreak`-th focus.
 */
export function getNextPhase(
  phase: PomodoroPhase,
  sessionsCompleted: number,
  settings: PomodoroSettings,
): ActivePhase {
  if (phase === 'focus') {
    const cycle = Math.max(1, Math.floor(settings.sessionsUntilLongBreak));
    return sessionsCompleted > 0 && sessionsCompleted % cycle === 0 ? 'long_break' : 'short_break';
  }
  return 'focus';
}

/** Whether the phase after `phase` starts by itself. */
export function autoStartsNext(phase: PomodoroPhase, settings: PomodoroSettings): boolean {
  if (phase === 'focus') return settings.autoStartBreaks;
  if (phase === 'short_break' || phase === 'long_break') return settings.autoStartFocus;
  return false;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Absolute end of the current phase (epoch ms), or null if it has not started. */
export function getPhaseEndMs(timer: PomodoroTimerState): number | null {
  if (timer.startedAt === null) return null;
  const pausedSeconds = Math.max(0, timer.totalPausedDuration || 0);
  return Math.round(timer.startedAt + (timer.totalTime + pausedSeconds) * 1000);
}

/** Remaining milliseconds of the current phase, clamped to [0, totalTime]. */
export function getRemainingMs(timer: PomodoroTimerState, nowMs: number): number {
  const totalMs = Math.max(0, timer.totalTime) * 1000;
  const endMs = getPhaseEndMs(timer);
  if (timer.state === 'stopped' || endMs === null) return totalMs;
  const at = timer.state === 'paused' && timer.pausedAt !== null ? timer.pausedAt : nowMs;
  return clamp(endMs - at, 0, totalMs);
}

/** Remaining whole seconds for display (rounded up, so a fresh 25:00 phase shows 25:00). */
export function getRemainingSeconds(timer: PomodoroTimerState, nowMs: number): number {
  return Math.ceil(getRemainingMs(timer, nowMs) / 1000);
}

/** "MM:SS" for a number of seconds. */
export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes.toString().padStart(2, '0')}:${rest.toString().padStart(2, '0')}`;
}

/** Stopped timer waiting for a manual start of `phase`. */
export function readyTimer(
  base: PomodoroTimerState,
  phase: PomodoroPhase,
  settings: PomodoroSettings,
  sessionsCompleted: number,
): PomodoroTimerState {
  const totalTime = getPhaseDuration(phase, settings);
  return {
    ...base,
    phase,
    state: 'stopped',
    totalTime,
    remainingTime: totalTime,
    sessionsCompleted,
    currentSessionId: null,
    startedAt: null,
    pausedAt: null,
    totalPausedDuration: 0,
    chainIndex: 0,
  };
}

// ── Auto-start chain ────────────────────────────────────────────────────

interface ChainCursor {
  phase: ActivePhase;
  startedAt: number;
  totalTime: number;
  pausedSeconds: number;
  chainIndex: number;
  sessionsCompleted: number;
}

interface PhaseEnd extends ChainCursor {
  endMs: number;
  /** Focus count after this phase ended. */
  sessionsAfter: number;
  nextPhase: ActivePhase;
  /** The next phase starts automatically at `endMs`. */
  continues: boolean;
  /** Auto-start is on, but the chain limit stops the timer here. */
  chainLimitReached: boolean;
}

function cursorOf(timer: PomodoroTimerState, limit: number): ChainCursor | null {
  if (timer.state !== 'running' || timer.startedAt === null) return null;
  return {
    phase: toActivePhase(timer.phase),
    startedAt: timer.startedAt,
    totalTime: timer.totalTime,
    pausedSeconds: Math.max(0, timer.totalPausedDuration || 0),
    chainIndex: clamp(Math.floor(timer.chainIndex || 0), 0, limit - 1),
    sessionsCompleted: timer.sessionsCompleted,
  };
}

function endOf(cursor: ChainCursor, settings: PomodoroSettings, limit: number): PhaseEnd {
  const endMs = Math.round(cursor.startedAt + (cursor.totalTime + cursor.pausedSeconds) * 1000);
  const sessionsAfter = cursor.phase === 'focus' ? cursor.sessionsCompleted + 1 : cursor.sessionsCompleted;
  const auto = autoStartsNext(cursor.phase, settings);
  const continues = auto && cursor.chainIndex + 1 < limit;
  return {
    ...cursor,
    endMs,
    sessionsAfter,
    nextPhase: getNextPhase(cursor.phase, sessionsAfter, settings),
    continues,
    chainLimitReached: auto && !continues,
  };
}

function cursorAfter(end: PhaseEnd, settings: PomodoroSettings): ChainCursor {
  return {
    phase: end.nextPhase,
    startedAt: end.endMs,
    totalTime: getPhaseDuration(end.nextPhase, settings),
    pausedSeconds: 0,
    chainIndex: end.chainIndex + 1,
    sessionsCompleted: end.sessionsAfter,
  };
}

/** A phase-end notification the alert chain should have pending. */
export interface PlannedAlert {
  chainIndex: number;
  phase: ActivePhase;
  endMs: number;
  nextPhase: ActivePhase;
  continues: boolean;
  chainLimitReached: boolean;
}

/**
 * Every phase end from the running phase up to the next manual-start boundary (or the
 * chain limit). Empty unless the timer is running.
 */
export function planAlerts(
  timer: PomodoroTimerState,
  settings: PomodoroSettings,
  limit: number = ALERT_CHAIN_LIMIT,
): PlannedAlert[] {
  const plan: PlannedAlert[] = [];
  let cursor = cursorOf(timer, limit);
  while (cursor) {
    const end = endOf(cursor, settings, limit);
    plan.push({
      chainIndex: end.chainIndex,
      phase: end.phase,
      endMs: end.endMs,
      nextPhase: end.nextPhase,
      continues: end.continues,
      chainLimitReached: end.chainLimitReached,
    });
    cursor = end.continues ? cursorAfter(end, settings) : null;
  }
  return plan;
}

/** A phase that ended, as reported by `reconcileTimer`. */
export interface CompletedPhase {
  phase: ActivePhase;
  startedAt: number;
  completedAt: number;
  /** The phase's own length in seconds (not the current setting). */
  totalTime: number;
  pausedSeconds: number;
  chainIndex: number;
}

export interface ReconcileResult {
  timer: PomodoroTimerState;
  completed: CompletedPhase[];
}

/**
 * Advances a running timer to `nowMs`. Every phase whose absolute end is at or before
 * `nowMs` is reported exactly once, following the auto-start settings up to the chain
 * limit; the timer then either runs the phase containing `nowMs` or waits in the ready
 * state of the next phase. Only timestamps are read, never `remainingTime`.
 */
export function reconcileTimer(
  timer: PomodoroTimerState,
  settings: PomodoroSettings,
  nowMs: number,
  limit: number = ALERT_CHAIN_LIMIT,
): ReconcileResult {
  let cursor = cursorOf(timer, limit);
  if (!cursor) return { timer, completed: [] };

  const completed: CompletedPhase[] = [];
  // `continues` needs chainIndex + 1 < limit, so this ends within `limit` steps.
  while (true) {
    const end = endOf(cursor, settings, limit);
    if (end.endMs > nowMs) break;
    completed.push({
      phase: end.phase,
      startedAt: end.startedAt,
      completedAt: end.endMs,
      totalTime: end.totalTime,
      pausedSeconds: end.pausedSeconds,
      chainIndex: end.chainIndex,
    });
    if (!end.continues) {
      return { timer: readyTimer(timer, end.nextPhase, settings, end.sessionsAfter), completed };
    }
    cursor = cursorAfter(end, settings);
  }

  if (completed.length === 0) return { timer, completed };
  return {
    timer: {
      ...timer,
      phase: cursor.phase,
      state: 'running',
      totalTime: cursor.totalTime,
      remainingTime: cursor.totalTime,
      sessionsCompleted: cursor.sessionsCompleted,
      currentSessionId: null,
      startedAt: cursor.startedAt,
      pausedAt: null,
      totalPausedDuration: 0,
      chainIndex: cursor.chainIndex,
    },
    completed,
  };
}

// ── Persistence ─────────────────────────────────────────────────────────

const PHASES: readonly PomodoroPhase[] = ['focus', 'short_break', 'long_break', 'idle'];
const STATES: readonly PomodoroState[] = ['running', 'paused', 'stopped'];

const finite = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** Repairs a persisted timer: fills missing fields, clamps numbers, drops impossible states. */
export function sanitizeTimerState(raw: unknown): PomodoroTimerState {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const phase = PHASES.includes(input.phase as PomodoroPhase)
    ? (input.phase as PomodoroPhase)
    : INITIAL_TIMER_STATE.phase;
  let state = STATES.includes(input.state as PomodoroState)
    ? (input.state as PomodoroState)
    : 'stopped';
  const totalTime = finite(input.totalTime, 0) > 0 ? finite(input.totalTime, 0) : INITIAL_TIMER_STATE.totalTime;
  const startedAt = typeof input.startedAt === 'number' ? input.startedAt : null;
  const pausedAt = typeof input.pausedAt === 'number' ? input.pausedAt : null;
  if (state !== 'stopped' && startedAt === null) state = 'stopped';
  if (state === 'paused' && pausedAt === null) state = 'stopped';

  return {
    phase,
    state,
    totalTime,
    remainingTime: state === 'stopped' ? totalTime : clamp(finite(input.remainingTime, totalTime), 0, totalTime),
    sessionsCompleted: Math.max(0, Math.floor(finite(input.sessionsCompleted, 0))),
    currentSessionId: typeof input.currentSessionId === 'string' ? input.currentSessionId : null,
    linkedTodoId: typeof input.linkedTodoId === 'string' ? input.linkedTodoId : null,
    startedAt: state === 'stopped' ? null : startedAt,
    pausedAt: state === 'paused' ? pausedAt : null,
    totalPausedDuration: state === 'stopped' ? 0 : Math.max(0, finite(input.totalPausedDuration, 0)),
    chainIndex: clamp(Math.floor(finite(input.chainIndex, 0)), 0, ALERT_CHAIN_LIMIT - 1),
  };
}
