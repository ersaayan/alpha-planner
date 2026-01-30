import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PomodoroTimerState, PomodoroSession, PomodoroPhase, PomodoroSettings } from '@/types';
import { INITIAL_TIMER_STATE } from '@/types';
import { generateId } from '@/utils/uuid';
import { useSettingsStore } from './settings-store';
import { cancelScheduledTimerNotifications } from '@/services/background';
import { notificationService } from '@/services/notifications';
import { useGamificationStore } from './gamification-store';
import { useTodoStore } from './todo-store';
import { AppState } from 'react-native';

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
  _handleCompletion: (options?: { shouldNotify?: boolean }) => void;

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
        const startedAt = Date.now() - elapsedSeconds * 1000;

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

      },

      pauseTimer: () => {
        const { _stopTicking } = get();

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
        const elapsedSeconds = calculateElapsedSeconds(timer, nowMs);
        const newRemaining = Math.max(0, timer.totalTime - elapsedSeconds);

        if (newRemaining === timer.remainingTime) return;

        set({
          timer: {
            ...timer,
            remainingTime: newRemaining,
          },
        });

        if (newRemaining === 0) {
          get()._handleCompletion({ shouldNotify: !options?.fromBackground });
        }
      },

      setPhase: (phase) => {
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

      _handleCompletion: (options) => {
        const { timer, currentSession, sessions, _stopTicking } = get();
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
            linkedTodoId: null,
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

        if (shouldAutoStartBreak || shouldAutoStartFocus) {
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
        const { timer, currentSession, sessions } = get();

        if (currentSession) {
          const completedSession: PomodoroSession = {
            ...currentSession,
            endedAt: new Date().toISOString(),
            duration: timer.totalTime,
            wasCompleted: true,
          };

          set({
            sessions: [...sessions, completedSession],
            timer: {
              ...timer,
              sessionsCompleted:
                timer.phase === 'focus' ? timer.sessionsCompleted + 1 : timer.sessionsCompleted,
            },
          });
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
        const totalTime = getPhaseDuration(timer.phase, settings);

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
      partialize: (state) => ({
        sessions: state.sessions,
        // Only persist session count and linked todo, not the full timer state
        _persistedTimer: {
          sessionsCompleted: state.timer.sessionsCompleted,
          linkedTodoId: state.timer.linkedTodoId,
        },
      }),
      // Merge persisted partial state with initial state
      merge: (persistedState, currentState) => {
        const persisted = persistedState as {
          sessions?: PomodoroSession[];
          _persistedTimer?: { sessionsCompleted?: number; linkedTodoId?: string | null };
        };
        return {
          ...currentState,
          sessions: persisted?.sessions ?? [],
          timer: {
            ...INITIAL_TIMER_STATE,
            sessionsCompleted: persisted?._persistedTimer?.sessionsCompleted ?? 0,
            linkedTodoId: persisted?._persistedTimer?.linkedTodoId ?? null,
          },
        };
      },
    }
  )
);
