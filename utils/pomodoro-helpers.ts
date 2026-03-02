/**
 * Shared Pomodoro helper functions.
 *
 * These are duplicated in stores/pomodoro-store.ts and
 * services/background/background-task.ts. This file provides a single
 * source of truth for future refactoring — existing call-sites are left
 * unchanged for now to avoid a larger migration.
 */
import type { PomodoroPhase, PomodoroSettings } from '@/types';

/** Return the duration (in seconds) for the given phase. */
export function getPhaseDuration(
  phase: PomodoroPhase,
  settings: PomodoroSettings,
): number {
  if (phase === 'focus') return settings.focusDuration;
  if (phase === 'short_break') return settings.shortBreakDuration;
  if (phase === 'long_break') return settings.longBreakDuration;
  return 0; // idle phase has no duration
}

/** Determine which phase comes after the current one. */
export function getNextPhase(
  phase: PomodoroPhase,
  sessionsCompleted: number,
  settings: PomodoroSettings,
): PomodoroPhase {
  if (phase === 'focus') {
    return (sessionsCompleted > 0 && sessionsCompleted % settings.sessionsUntilLongBreak === 0)
      ? 'long_break'
      : 'short_break';
  }
  return 'focus';
}
