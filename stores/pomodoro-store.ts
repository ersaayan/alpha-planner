import { cancelScheduledTimerNotifications, registerPomodoroBackgroundTask, scheduleTimerNotification, unregisterPomodoroBackgroundTask } from '@/services/background';
import { notificationService } from '@/services/notifications';
import type { PomodoroPhase, PomodoroSession, PomodoroSettings, PomodoroTimerState } from '@/types';
import { INITIAL_TIMER_STATE } from '@/types';
import { generateId } from '@/utils/uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useGamificationStore } from './gamification-store';
import { useSettingsStore } from './settings-store';
import { useTodoStore } from './todo-store';

// Global interval reference - outside React lifecycle.
// Managed exclusively by _startTicking/_stopTicking. Always idempotent.
let timerInterval: ReturnType<typeof setInterval> | null = null;
let autoStartTimeout: ReturnType<typeof setTimeout> | null = null;

const getPhaseDuration = (phase: PomodoroPhase, settings: PomodoroSettings) => {
  if (phase === 'focus') return settings.focusDuration;
  if (phase === 'short_break') return settings.shortBreakDuration;
  if (phase === 'long_break') return settings.longBreakDuration;
  return settings.focusDuration;
};

const getNextPhase = (
  phase: PomodoroPhase,
  sessionsCompleted: number,
  settings: PomodoroSettings
): PomodoroPhase => {
  if (phase === 'focus') {
    return (sessionsCompleted > 0 && sessionsCompleted % settings.sessionsUntilLongBreak === 0)
      ? 'long_break'
      : 'short_break';
  }
  return 'focus';
};

const calculateRemainingTime = (timer: PomodoroTimerState, nowMs: number): number => {
  if (!timer.startedAt) return timer.remainingTime;
  const completionTimeMs = timer.startedAt + (timer.totalTime * 1000) + (timer.totalPausedDuration * 1000);
  return Math.max(0, Math.floor((completionTimeMs - nowMs) / 1000));
};

const calculateCompletionTimeMs = (timer: PomodoroTimerState): number => {
  if (!timer.startedAt) return Date.now() + timer.remainingTime * 1000;
  return timer.startedAt + (timer.totalTime * 1000) + (timer.totalPausedDuration * 1000);
};

interface PomodoroState {
  timer: PomodoroTimerState;
  sessions: PomodoroSession[];
  currentSession: PomodoroSession | null;

  // Timer actions
  startTimer: (linkedTodoId?: string | null) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  resetTimer: () => void;
  tick: () => void;
  syncTimer: (options?: { now?: number; fromBackground?: boolean }) => void;

  // Internal timer management
  _startTicking: () => void;
  _stopTicking: () => void;
  _handleCompletion: (options?: { shouldNotify?: boolean; _isSyncing?: boolean; _syncState?: PomodoroTimerState }) => void;

  // Phase management
  setPhase: (phase: PomodoroPhase) => void;
  skipToNextPhase: () => void;

  // Session management
  completeSession: () => void;
  linkTodo: (todoId: string | null) => void;

  // Utility
  getProgress: () => number;
  formatTime: () => string;
  applySettingsToTimer: (settings?: PomodoroSettings) => void;
}

export const usePomodoroStore = create<PomodoroState>()(
  persist(
    (set, get) => ({
      timer: INITIAL_TIMER_STATE,
      sessions: [],
      currentSession: null,

      // Internal: Start the ticking interval
      _startTicking: () => {
        // Clear any existing interval first
        if (timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }

        // Start new interval
        timerInterval = setInterval(() => {
          get().tick();
        }, 1000);
      },

      // Internal: Stop the ticking interval and cancel pending auto-start
      _stopTicking: () => {
        if (timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }
        if (autoStartTimeout) {
          clearTimeout(autoStartTimeout);
          autoStartTimeout = null;
        }
      },

      startTimer: (linkedTodoId) => {
        const { timer } = get();
        // Prevent double-start
        if (timer.state === 'running') return;

        if (autoStartTimeout) {
          clearTimeout(autoStartTimeout);
          autoStartTimeout = null;
        }
        const { pomodoroSettings, settings } = useSettingsStore.getState();
        if (settings.notificationsEnabled) {
          notificationService.dismissTimerNotification();
        }
        const { _startTicking } = get();

        const phase = timer.phase === 'idle' ? 'focus' : timer.phase;
        const totalTime = getPhaseDuration(phase, pomodoroSettings);

        const sessionId = generateId();
        const now = Date.now();

        const newSession: PomodoroSession = {
          id: sessionId,
          todoId: linkedTodoId ?? timer.linkedTodoId,
          phase,
          startedAt: new Date(now).toISOString(),
          endedAt: null,
          pausedDuration: 0,
          wasCompleted: false,
          duration: 0,
          targetDuration: totalTime,
        };

        const remainingTime = timer.state === 'paused' ? timer.remainingTime : totalTime;

        // Update state FIRST before starting interval
        set({
          timer: {
            ...timer,
            phase,
            state: 'running',
            remainingTime,
            totalTime,
            linkedTodoId: linkedTodoId ?? timer.linkedTodoId,
            startedAt: now,
            pausedAt: null,
            currentSessionId: sessionId,
            totalPausedDuration: 0,
            notificationId: null,
          },
          currentSession: newSession,
        });

        // Start the interval after state is set
        _startTicking();

        // Schedule notification for completion & register background task
        if (settings.notificationsEnabled) {
          const { soundEnabled } = settings;
          const { vibrationEnabled } = pomodoroSettings;
          try {
            const completionMs = now + (remainingTime * 1000);
            scheduleTimerNotification(phase, completionMs, {
              soundEnabled,
              vibrationEnabled,
              isAbsoluteMs: true,
            });
          } catch (e) {
            console.warn('[Pomodoro] Failed to schedule notification:', e);
          }

          try {
            registerPomodoroBackgroundTask();
          } catch (e) {
            console.warn('[Pomodoro] Failed to register background task:', e);
          }
        }
      },

      pauseTimer: () => {
        const { timer, _stopTicking } = get();
        if (timer.state !== 'running') return;

        // Stop the interval
        _stopTicking();

        // Cancel scheduled notification when pausing
        cancelScheduledTimerNotifications();

        set((state) => ({
          timer: {
            ...state.timer,
            state: 'paused',
            pausedAt: Date.now(),
          },
        }));
      },

      resumeTimer: () => {
        const { timer, currentSession, _startTicking } = get();
        if (!timer.pausedAt || !currentSession) return;

        const pauseDeltaMs = Date.now() - timer.pausedAt;
        const pauseDeltaSec = Math.floor(pauseDeltaMs / 1000);
        const newTotalPaused = timer.totalPausedDuration + pauseDeltaSec;
        const newRemaining = calculateRemainingTime(
          { ...timer, totalPausedDuration: newTotalPaused, pausedAt: null },
          Date.now()
        );

        const { pomodoroSettings, settings } = useSettingsStore.getState();

        set({
          timer: {
            ...timer,
            state: 'running',
            totalPausedDuration: newTotalPaused,
            pausedAt: null,
            remainingTime: newRemaining,
          },
          currentSession: {
            ...currentSession,
            pausedDuration: currentSession.pausedDuration + pauseDeltaMs,
          },
        });

        _startTicking();

        // Reschedule notification with updated completion time
        if (settings.notificationsEnabled) {
          try {
            const updatedTimer = get().timer;
            const resumeCompletionMs = calculateCompletionTimeMs(updatedTimer);
            scheduleTimerNotification(
              timer.phase as 'focus' | 'short_break' | 'long_break',
              resumeCompletionMs,
              { soundEnabled: settings.soundEnabled, vibrationEnabled: pomodoroSettings.vibrationEnabled, isAbsoluteMs: true }
            );
          } catch (e) {
            console.warn('[Pomodoro] Failed to schedule notification:', e);
          }
          try {
            registerPomodoroBackgroundTask();
          } catch (e) {
            console.warn('[Pomodoro] Failed to register background task:', e);
          }
        }
      },

      stopTimer: () => {
        const { timer, currentSession, sessions, _stopTicking } = get();

        // Stop the interval
        _stopTicking();

        // Cancel any scheduled notifications
        cancelScheduledTimerNotifications();

        const { settings } = useSettingsStore.getState();
        if (settings.notificationsEnabled) {
          notificationService.dismissTimerNotification();
        }

        // Unregister background task since timer is stopped
        unregisterPomodoroBackgroundTask();

        if (currentSession) {
          const endedSession: PomodoroSession = {
            ...currentSession,
            endedAt: new Date().toISOString(),
            duration: timer.totalTime - timer.remainingTime,
            wasCompleted: timer.remainingTime <= 0,
          };

          set({
            sessions: [...sessions, endedSession],
            currentSession: null,
            timer: {
              ...INITIAL_TIMER_STATE,
              sessionsCompleted: timer.sessionsCompleted,
            },
          });
        } else {
          set({
            timer: {
              ...INITIAL_TIMER_STATE,
              sessionsCompleted: timer.sessionsCompleted,
            },
          });
        }
      },

      resetTimer: () => {
        const { _stopTicking } = get();
        _stopTicking();

        // Cancel notifications and background task
        cancelScheduledTimerNotifications();
        unregisterPomodoroBackgroundTask();

        const { pomodoroSettings } = useSettingsStore.getState();
        const focusDuration = pomodoroSettings.focusDuration;

        set({
          timer: {
            ...INITIAL_TIMER_STATE,
            remainingTime: focusDuration,
            totalTime: focusDuration,
          },
          currentSession: null,
        });
      },

      tick: () => {
        const { timer } = get();
        if (timer.state !== 'running') {
          get()._stopTicking();
          return;
        }

        const newRemainingTime = calculateRemainingTime(timer, Date.now());

        set({
          timer: {
            ...timer,
            remainingTime: newRemainingTime,
          },
        });

        if (newRemainingTime === 0) {
          get()._handleCompletion();
        }
      },

      syncTimer: (options) => {
        const { timer } = get();
        if (timer.state !== 'running' || !timer.startedAt) return;

        const nowMs = options?.now ?? Date.now();
        const { pomodoroSettings } = useSettingsStore.getState();

        let currentTimer = { ...timer };
        // Calculate elapsed seconds accounting for totalPausedDuration
        let elapsedSeconds = Math.max(0, Math.floor((nowMs - currentTimer.startedAt!) / 1000) - currentTimer.totalPausedDuration);

        // Process completed phases during the background period (cap at 50 to prevent freeze)
        const MAX_SYNC_ITERATIONS = 50;
        let syncIterations = 0;
        while (elapsedSeconds >= currentTimer.remainingTime) {
          if (currentTimer.remainingTime <= 0) break;
          if (syncIterations >= MAX_SYNC_ITERATIONS) break;
          syncIterations++;
          elapsedSeconds -= currentTimer.remainingTime;

          const isFocus = currentTimer.phase === 'focus';
          const newSessionsCompleted = isFocus
            ? currentTimer.sessionsCompleted + 1
            : currentTimer.sessionsCompleted;
          const nextPhase = getNextPhase(
            currentTimer.phase,
            newSessionsCompleted,
            pomodoroSettings
          );

          // Force Gamification Updates for missed phases
          if (isFocus) {
            const completionAtMs = calculateCompletionTimeMs(currentTimer);
            const { incrementPomodoro } = useGamificationStore.getState();
            const { incrementPomodoroCount } = useTodoStore.getState();
            incrementPomodoro(pomodoroSettings.focusDuration, new Date(completionAtMs));
            if (currentTimer.linkedTodoId) {
              incrementPomodoroCount(currentTimer.linkedTodoId);
            }
          }

          const shouldAutoContinue =
            (isFocus && pomodoroSettings.autoStartBreaks) ||
            (!isFocus && pomodoroSettings.autoStartFocus);

          if (!shouldAutoContinue) {
            // Reached a phase that requires manual start. End catch-up here.
            get()._handleCompletion({ shouldNotify: false, _isSyncing: true, _syncState: { ...currentTimer, sessionsCompleted: newSessionsCompleted } });
            return; 
          }

          // Advance to next phase — capture completed phase duration BEFORE updating
          const completedPhaseDuration = currentTimer.totalTime;
          const nextDuration = getPhaseDuration(nextPhase, pomodoroSettings);
          // Recalculate startedAt moving forward in time (include paused duration from completed phase)
          const nextStartedAt = currentTimer.startedAt! + completedPhaseDuration * 1000 + currentTimer.totalPausedDuration * 1000;

          currentTimer = {
            ...currentTimer,
            phase: nextPhase,
            remainingTime: nextDuration,
            totalTime: nextDuration,
            sessionsCompleted: newSessionsCompleted,
            startedAt: nextStartedAt,
            totalPausedDuration: 0,
          };
          let newSessions = get().sessions;
          if (get().currentSession) {
            const completedSession: PomodoroSession = {
                ...get().currentSession!,
                endedAt: new Date(nextStartedAt).toISOString(),
                duration: completedPhaseDuration,
                wasCompleted: true,
            };
            newSessions = [...newSessions, completedSession];
            
            // Create next session
            const newSession: PomodoroSession = {
              id: generateId(),
              todoId: currentTimer.linkedTodoId,
              phase: nextPhase,
              startedAt: new Date(nextStartedAt).toISOString(),
              endedAt: null,
              pausedDuration: 0,
              wasCompleted: false,
              duration: 0,
              targetDuration: nextDuration,
            };
            set({ sessions: newSessions, currentSession: newSession });
          }
        }

        // Apply remaining time using the single-source-of-truth formula
        const newRemaining = calculateRemainingTime(currentTimer, nowMs);
        
        // If we skipped phases, update the store fully
        if (currentTimer.phase !== timer.phase || newRemaining !== timer.remainingTime) {
          set({
            timer: {
              ...currentTimer,
              remainingTime: newRemaining,
            },
          });
          
          if (currentTimer.phase !== timer.phase) {
            // Need to reschedule notification for the newly entered phase
            const { settings } = useSettingsStore.getState();
            try {
              const syncCompletionMs = calculateCompletionTimeMs(get().timer);
              scheduleTimerNotification(
                currentTimer.phase as 'focus' | 'short_break' | 'long_break',
                syncCompletionMs,
                { soundEnabled: settings.soundEnabled, vibrationEnabled: pomodoroSettings.vibrationEnabled, isAbsoluteMs: true }
              );
            } catch {
              // Notification scheduling is non-critical during sync
            }
          }
        }

        // Restart ticking if timer is still running (idempotent: stop first)
        if (get().timer.state === 'running') {
          get()._stopTicking();
          get()._startTicking();
        }
      },

      setPhase: (phase) => {
        const { _stopTicking } = get();
        _stopTicking();
        cancelScheduledTimerNotifications();

        const { pomodoroSettings, settings } = useSettingsStore.getState();

        const totalTime = getPhaseDuration(phase, pomodoroSettings);

        set((state) => ({
          timer: {
            ...state.timer,
            phase,
            remainingTime: totalTime,
            totalTime,
            state: 'stopped',
            startedAt: null,
            pausedAt: null,
            currentSessionId: null,
          },
        }));
      },

      skipToNextPhase: () => {
        const { timer, currentSession, sessions, _stopTicking } = get();
        const { pomodoroSettings } = useSettingsStore.getState();

        // Stop any running interval first
        _stopTicking();

        // Cancel any scheduled notifications
        cancelScheduledTimerNotifications();

        // Unregister background task since timer is being stopped
        unregisterPomodoroBackgroundTask();

        const { settings } = useSettingsStore.getState();
        if (settings.notificationsEnabled) {
          notificationService.dismissTimerNotification();
        }

        let nextPhase: PomodoroPhase;
        let newSessionsCompleted = timer.sessionsCompleted;

        if (timer.phase === 'focus') {
          newSessionsCompleted += 1;
          nextPhase = getNextPhase(timer.phase, newSessionsCompleted, pomodoroSettings);
        } else {
          nextPhase = 'focus';
        }

        let updatedSessions = sessions;
        if (currentSession) {
          const endedSession: PomodoroSession = {
            ...currentSession,
            endedAt: new Date().toISOString(),
            duration: timer.totalTime - timer.remainingTime,
            wasCompleted: false,
          };
          updatedSessions = [...sessions, endedSession];
        }

        const nextDuration = getPhaseDuration(nextPhase, pomodoroSettings);

        set({
          sessions: updatedSessions,
          currentSession: null,
          timer: {
            ...timer,
            phase: nextPhase,
            state: 'stopped',
            remainingTime: nextDuration,
            totalTime: nextDuration,
            sessionsCompleted: newSessionsCompleted,
            startedAt: null,
            pausedAt: null,
            currentSessionId: null,
          },
        });
      },

      _handleCompletion: (options?: { shouldNotify?: boolean; _isSyncing?: boolean; _syncState?: PomodoroTimerState }) => {
        const { timer: originalTimer, currentSession, sessions, _stopTicking } = get();
        const timer = options?._syncState ?? originalTimer;
        if (timer.state !== 'running') return;

        _stopTicking();
        cancelScheduledTimerNotifications();

        const { pomodoroSettings } = useSettingsStore.getState();

        const isFocus = timer.phase === 'focus';
        const newSessionsCompleted = isFocus ? timer.sessionsCompleted + 1 : timer.sessionsCompleted;
        const nextPhase = getNextPhase(timer.phase, newSessionsCompleted, pomodoroSettings);
        const nextDuration = getPhaseDuration(nextPhase, pomodoroSettings);

        const completionAtMs = calculateCompletionTimeMs(timer);
        const completionIso = new Date(completionAtMs).toISOString();

        let updatedSessions = sessions;
        if (currentSession) {
          const completedSession: PomodoroSession = {
            ...currentSession,
            endedAt: completionIso,
            duration: timer.totalTime,
            wasCompleted: true,
          };
          updatedSessions = [...sessions, completedSession];

          // Sync session to Supabase
          try {
            const { useSyncStore } = require('./sync-store');
            useSyncStore.getState().enqueue('pomodoro_sessions', 'insert', {
              id: completedSession.id,
              todo_id: completedSession.todoId ?? null,
              phase: completedSession.phase,
              duration: completedSession.duration,
              target_duration: completedSession.targetDuration,
              was_completed: completedSession.wasCompleted,
              started_at: completedSession.startedAt,
              ended_at: completedSession.endedAt,
              paused_duration: completedSession.pausedDuration,
            });
          } catch {
            // Sync enqueue failure is non-fatal
          }
        }

        set({
          sessions: updatedSessions,
          currentSession: null,
          timer: {
            ...timer,
            phase: nextPhase,
            state: 'stopped',
            remainingTime: nextDuration,
            totalTime: nextDuration,
            sessionsCompleted: newSessionsCompleted,
            startedAt: null,
            pausedAt: null,
            currentSessionId: null,
            linkedTodoId: timer.linkedTodoId,
            totalPausedDuration: 0,
            notificationId: null,
          },
        });

        if (isFocus) {
          const { incrementPomodoro } = useGamificationStore.getState();
          const { incrementPomodoroCount } = useTodoStore.getState();
          incrementPomodoro(pomodoroSettings.focusDuration, new Date(completionAtMs));
          if (timer.linkedTodoId) {
            incrementPomodoroCount(timer.linkedTodoId);
          }
        }

        const { settings } = useSettingsStore.getState();
        const isAppActive = AppState.currentState === 'active';
        if (options?.shouldNotify !== false && settings.notificationsEnabled && !isAppActive) {
          notificationService.sendTimerCompleteNotification(
            timer.phase as 'focus' | 'short_break' | 'long_break',
            {
              soundEnabled: settings.soundEnabled,
              vibrationEnabled: pomodoroSettings.vibrationEnabled,
            }
          );
        }

        const shouldAutoStartBreak = pomodoroSettings.autoStartBreaks && timer.phase === 'focus';
        const shouldAutoStartFocus =
          pomodoroSettings.autoStartFocus &&
          (timer.phase === 'short_break' || timer.phase === 'long_break');

        if ((shouldAutoStartBreak || shouldAutoStartFocus) && !options?._isSyncing) {
          // Clear any existing auto-start timeout before setting a new one
          if (autoStartTimeout) {
            clearTimeout(autoStartTimeout);
          }
          autoStartTimeout = setTimeout(() => {
            autoStartTimeout = null;
            get().startTimer();
          }, 1500);
        }
      },

      completeSession: () => {
        // Delegate to _handleCompletion to avoid duplicated logic (B3 fix)
        const { timer, currentSession } = get();
        if (!currentSession) return;
        if (timer.state === 'running') {
          get()._handleCompletion();
        }
      },

      linkTodo: (todoId) => {
        set((state) => ({
          timer: {
            ...state.timer,
            linkedTodoId: todoId,
          },
        }));
      },

      getProgress: () => {
        const { timer } = get();
        if (timer.totalTime === 0) return 0;
        return 1 - timer.remainingTime / timer.totalTime;
      },

      formatTime: () => {
        const { timer } = get();
        const remaining = timer.remainingTime ?? INITIAL_TIMER_STATE.remainingTime;
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      },

      applySettingsToTimer: (settingsOverride) => {
        const { timer } = get();
        if (timer.state !== 'stopped') return;

        const settings = settingsOverride ?? useSettingsStore.getState().pomodoroSettings;
        // Treat 'idle' phase as 'focus' for duration lookup
        const phase = timer.phase === 'idle' ? 'focus' : timer.phase;
        const totalTime = getPhaseDuration(phase, settings);

        if (timer.remainingTime === totalTime && timer.totalTime === totalTime) return;

        set({
          timer: {
            ...timer,
            remainingTime: totalTime,
            totalTime,
          },
        });
      },
    }),
    {
      name: 'pomodoro-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => {
        // Prune sessions older than 90 days to prevent unbounded growth
        const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
        const recentSessions = state.sessions.filter((s) => {
          const startedAt = new Date(s.startedAt).getTime();
          return startedAt >= ninetyDaysAgo;
        });
        return {
          sessions: recentSessions,
          timer: state.timer,
          currentSession: state.currentSession,
        };
      },
      // Merge persisted state — restores full timer state for app-kill recovery
      merge: (persistedState, currentState) => {
        const persisted = persistedState as {
          sessions?: PomodoroSession[];
          timer?: PomodoroTimerState;
          currentSession?: PomodoroSession | null;
        };
        return {
          ...currentState,
          sessions: persisted?.sessions ?? [],
          timer: persisted?.timer ?? INITIAL_TIMER_STATE,
          currentSession: persisted?.currentSession ?? null,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const { timer, syncTimer, _startTicking } = state;
        if (timer.state === 'running' && timer.startedAt) {
          // Sync timer to catch up with elapsed time during app kill
          syncTimer({ now: Date.now() });
        }
      },
    }
  )
);
