import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PomodoroTimerState, PomodoroSession, PomodoroPhase } from '@/types';
import { INITIAL_TIMER_STATE } from '@/types';
import { generateId } from '@/utils/uuid';
import { useSettingsStore } from './settings-store';
import { scheduleTimerNotification, cancelScheduledTimerNotifications } from '@/services/background';

// Global interval reference - outside of React lifecycle
let timerInterval: ReturnType<typeof setInterval> | null = null;

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

  // Internal timer management
  _startTicking: () => void;
  _stopTicking: () => void;

  // Phase management
  setPhase: (phase: PomodoroPhase) => void;
  skipToNextPhase: () => void;

  // Session management
  completeSession: () => void;
  linkTodo: (todoId: string | null) => void;

  // Utility
  getProgress: () => number;
  formatTime: () => string;
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
          // Get current state to check if still running
          const currentState = get();

          if (currentState.timer.state !== 'running') {
            // Safety check - stop interval if not running
            if (timerInterval) {
              clearInterval(timerInterval);
              timerInterval = null;
            }
            return;
          }

          // Use functional form of set() to ensure we always have the latest state
          // This is critical for intervals - closure over state variables causes stale updates
          set((state) => ({
            timer: {
              ...state.timer,
              remainingTime: Math.max(0, state.timer.remainingTime - 1),
            },
          }));
        }, 1000);
      },

      // Internal: Stop the ticking interval
      _stopTicking: () => {
        if (timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }
      },

      startTimer: (linkedTodoId) => {
        const { pomodoroSettings } = useSettingsStore.getState();
        const { timer, _startTicking } = get();

        const phase = timer.phase === 'idle' ? 'focus' : timer.phase;
        const totalTime =
          phase === 'focus'
            ? pomodoroSettings.focusDuration
            : phase === 'short_break'
              ? pomodoroSettings.shortBreakDuration
              : pomodoroSettings.longBreakDuration;

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
          },
          currentSession: newSession,
        });

        // Start the interval after state is set
        _startTicking();

        // Schedule background notification for when timer completes
        scheduleTimerNotification(phase as 'focus' | 'short_break' | 'long_break', remainingTime)
          .catch((error) => {
            console.warn('Failed to schedule timer notification:', error);
          });
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

        // Reschedule notification with remaining time
        scheduleTimerNotification(
          timer.phase as 'focus' | 'short_break' | 'long_break',
          timer.remainingTime
        );

        set({
          timer: {
            ...timer,
            state: 'running',
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

        set({
          timer: INITIAL_TIMER_STATE,
          currentSession: null,
        });
      },

      tick: () => {
        // This is now only used for manual ticking if needed
        // The interval handles automatic ticking
        const { timer } = get();
        if (timer.state !== 'running') return;

        const newRemainingTime = timer.remainingTime - 1;

        set({
          timer: {
            ...timer,
            remainingTime: Math.max(0, newRemainingTime),
          },
        });
      },

      setPhase: (phase) => {
        const { pomodoroSettings } = useSettingsStore.getState();

        const totalTime =
          phase === 'focus'
            ? pomodoroSettings.focusDuration
            : phase === 'short_break'
              ? pomodoroSettings.shortBreakDuration
              : phase === 'long_break'
                ? pomodoroSettings.longBreakDuration
                : pomodoroSettings.focusDuration;

        set((state) => ({
          timer: {
            ...state.timer,
            phase,
            remainingTime: totalTime,
            totalTime,
            state: 'stopped',
          },
        }));
      },

      skipToNextPhase: () => {
        const { timer, _stopTicking } = get();
        const { pomodoroSettings } = useSettingsStore.getState();

        // Stop any running interval first
        _stopTicking();

        // Cancel any scheduled notifications
        cancelScheduledTimerNotifications();

        let nextPhase: PomodoroPhase;
        let newSessionsCompleted = timer.sessionsCompleted;

        if (timer.phase === 'focus') {
          newSessionsCompleted += 1;
          nextPhase =
            newSessionsCompleted % pomodoroSettings.sessionsUntilLongBreak === 0
              ? 'long_break'
              : 'short_break';
        } else {
          nextPhase = 'focus';
        }

        get().setPhase(nextPhase);

        set((state) => ({
          timer: {
            ...state.timer,
            sessionsCompleted: newSessionsCompleted,
          },
        }));
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
