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

// Global interval reference - outside of React lifecycle
let timerInterval: ReturnType<typeof setInterval> | null = null;
// Timeout for auto-starting next phase
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
    return sessionsCompleted % settings.sessionsUntilLongBreak === 0 ? 'long_break' : 'short_break';
  }
  return 'focus';
};

const calculateElapsedSeconds = (timer: PomodoroTimerState, nowMs: number) => {
  if (!timer.startedAt) return 0;
  return Math.max(0, Math.floor((nowMs - timer.startedAt) / 1000));
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
        if (autoStartTimeout) {
          clearTimeout(autoStartTimeout);
          autoStartTimeout = null;
        }
        const { pomodoroSettings, settings } = useSettingsStore.getState();
        if (settings.notificationsEnabled) {
          notificationService.dismissTimerNotification();
        }
        const { timer, _startTicking } = get();

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
        const elapsedSeconds = Math.max(0, totalTime - remainingTime);
        const startedAt = now - elapsedSeconds * 1000;

        // Update state FIRST before starting interval
        set({
          timer: {
            ...timer,
            phase,
            state: 'running',
            remainingTime,
            totalTime,
            linkedTodoId: linkedTodoId ?? timer.linkedTodoId,
            startedAt,
            pausedAt: null,
            currentSessionId: sessionId,
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
            scheduleTimerNotification(phase, remainingTime, {
              soundEnabled,
              vibrationEnabled,
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

        const pausedDuration = Date.now() - timer.pausedAt;
        const elapsedSeconds = Math.max(0, timer.totalTime - timer.remainingTime);
        const startedAt = Date.now() - elapsedSeconds * 1000;

        const { pomodoroSettings, settings } = useSettingsStore.getState();

        set({
          timer: {
            ...timer,
            state: 'running',
            startedAt,
            pausedAt: null,
          },
          currentSession: {
            ...currentSession,
            pausedDuration: currentSession.pausedDuration + pausedDuration,
          },
        });

        // Start the interval after state is set
        _startTicking();

        // Reschedule notification
        if (useSettingsStore.getState().settings.notificationsEnabled) {
          const { soundEnabled } = settings;
          const { vibrationEnabled } = pomodoroSettings;
          const newRemaining = Math.max(0, timer.totalTime - elapsedSeconds);
          try {
            scheduleTimerNotification(timer.phase as 'focus' | 'short_break' | 'long_break', newRemaining, {
              soundEnabled,
              vibrationEnabled,
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
          });
        }

        set({
          timer: {
            ...INITIAL_TIMER_STATE,
            sessionsCompleted: timer.sessionsCompleted,
          },
        });
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
        // This is now only used for manual ticking if needed
        // The interval handles automatic ticking
        const { timer } = get();
        if (timer.state !== 'running') {
          get()._stopTicking();
          return;
        }

        const newRemainingTime = Math.max(0, timer.remainingTime - 1);

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
        let elapsedSeconds = calculateElapsedSeconds(currentTimer, nowMs);

        // Process completed phases during the background period
        while (elapsedSeconds >= currentTimer.remainingTime) {
          if (currentTimer.remainingTime <= 0) break;
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
            const completionAtMs = currentTimer.startedAt! + currentTimer.totalTime * 1000;
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
          // Recalculate startedAt moving forward in time
          const nextStartedAt = currentTimer.startedAt! + completedPhaseDuration * 1000;

          currentTimer = {
            ...currentTimer,
            phase: nextPhase,
            remainingTime: nextDuration,
            totalTime: nextDuration,
            sessionsCompleted: newSessionsCompleted,
            startedAt: nextStartedAt,
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

        // Apply remaining time
        const newRemaining = Math.max(0, currentTimer.totalTime - elapsedSeconds);
        
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
            scheduleTimerNotification(
              currentTimer.phase as 'focus' | 'short_break' | 'long_break',
              newRemaining,
              { soundEnabled: settings.soundEnabled, vibrationEnabled: pomodoroSettings.vibrationEnabled }
            );
          }
        }

        // Restart ticking if timer is still running
        if (get().timer.state === 'running') {
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

        const completionAtMs = timer.startedAt
          ? timer.startedAt + timer.totalTime * 1000
          : Date.now();
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
        const { timer, currentSession, sessions, _stopTicking } = get();
        if (!currentSession) return;

        _stopTicking();
        cancelScheduledTimerNotifications();

        const completedSession: PomodoroSession = {
          ...currentSession,
          endedAt: new Date().toISOString(),
          duration: timer.totalTime - timer.remainingTime,
          wasCompleted: true,
        };

        const newSessionsCompleted =
          timer.phase === 'focus' ? timer.sessionsCompleted + 1 : timer.sessionsCompleted;

        set({
          sessions: [...sessions, completedSession],
          currentSession: null,
          timer: {
            ...timer,
            state: 'stopped',
            sessionsCompleted: newSessionsCompleted,
            startedAt: null,
            pausedAt: null,
            currentSessionId: null,
          },
        });
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
