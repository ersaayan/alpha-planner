import { Tabs } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Icon } from '@/components/icon';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { CustomTabBar } from '@/components/navigation';
import { usePomodoroStore, useSettingsStore } from '@/stores';
import { notificationService } from '@/services/notifications';
import {
  cancelScheduledTimerNotifications,
  scheduleTimerNotification,
} from '@/services/background';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const notificationsEnabled = useSettingsStore((state) => state.settings.notificationsEnabled);
  const soundEnabled = useSettingsStore((state) => state.settings.soundEnabled);
  const vibrationEnabled = useSettingsStore((state) => state.pomodoroSettings.vibrationEnabled);

  const timerState = usePomodoroStore((state) => state.timer.state);
  const timerPhase = usePomodoroStore((state) => state.timer.phase);
  const timerStartedAt = usePomodoroStore((state) => state.timer.startedAt);
  const timerTotalTime = usePomodoroStore((state) => state.timer.totalTime);
  const pausedRemainingTime = usePomodoroStore((state) =>
    state.timer.state === 'paused' ? state.timer.remainingTime : null
  );
  const pauseTimer = usePomodoroStore((state) => state.pauseTimer);
  const resumeTimer = usePomodoroStore((state) => state.resumeTimer);
  const stopTimer = usePomodoroStore((state) => state.stopTimer);

  const [appState, setAppState] = useState(AppState.currentState);
  const previousTimerStateRef = useRef(timerState);
  const previousAppStateRef = useRef(appState);

  useEffect(() => {
    notificationService.setActionCallbacks({
      onPause: pauseTimer,
      onResume: resumeTimer,
      onStop: stopTimer,
    });
  }, [pauseTimer, resumeTimer, stopTimer]);

  // Handle app state for background/foreground transitions
  useEffect(() => {
    const appStateRef = { current: AppState.currentState };

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;
      setAppState(nextAppState);

      // Get fresh timer state and actions from store
      const store = usePomodoroStore.getState();
      const currentTimer = store.timer;

      // App coming to foreground - update timer and dismiss notification
      if (nextAppState === 'active') {
        if (currentTimer.state === 'running' && currentTimer.startedAt) {
          // Sync remaining time (accounts for pause-aware startedAt)
          store.syncTimer({ fromBackground: previousState !== 'active' });

          // Restart the interval (it may have been suspended in background)
          if (usePomodoroStore.getState().timer.state === 'running') {
            store._startTicking();
          }
        }

        // Dismiss the ongoing notification and cancel completion schedule
        notificationService.dismissTimerNotification();
        cancelScheduledTimerNotifications();
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const prevTimerState = previousTimerStateRef.current;
    const prevAppState = previousAppStateRef.current;
    const isActive = appState === 'active';

    if (!notificationsEnabled || isActive) {
      notificationService.dismissTimerNotification();
      cancelScheduledTimerNotifications();
    } else {
      if (timerPhase === 'idle' || timerState === 'stopped') {
        notificationService.dismissTimerNotification();
        cancelScheduledTimerNotifications();
      } else if (timerState === 'paused') {
        notificationService.showTimerNotification(
          timerPhase as 'focus' | 'short_break' | 'long_break',
          pausedRemainingTime ?? 0,
          timerTotalTime,
          true
        );
        cancelScheduledTimerNotifications();
      } else if (timerState === 'running' && timerStartedAt) {
        const elapsed = Math.floor((Date.now() - timerStartedAt) / 1000);
        const remaining = Math.max(0, timerTotalTime - elapsed);

        notificationService.showTimerNotification(
          timerPhase as 'focus' | 'short_break' | 'long_break',
          remaining,
          timerTotalTime,
          false
        );

        scheduleTimerNotification(
          timerPhase as 'focus' | 'short_break' | 'long_break',
          remaining,
          {
            soundEnabled,
            vibrationEnabled,
          }
        );

        const startedInBackground =
          prevTimerState === 'stopped' &&
          timerState === 'running' &&
          prevAppState !== 'active' &&
          appState !== 'active';

        if (startedInBackground) {
          notificationService.sendPhaseStartNotification(
            timerPhase as 'focus' | 'short_break' | 'long_break',
            {
              soundEnabled,
              vibrationEnabled,
            }
          );
        }
      }
    }

    previousTimerStateRef.current = timerState;
    previousAppStateRef.current = appState;
  }, [
    appState,
    notificationsEnabled,
    soundEnabled,
    vibrationEnabled,
    timerPhase,
    timerState,
    timerStartedAt,
    timerTotalTime,
    pausedRemainingTime,
  ]);

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: colors.tabIconSelected,
        tabBarInactiveTintColor: colors.tabIconDefault,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Icon
              name={focused ? 'home' : 'home-outline'}
              fill={color}
              style={{ width: 24, height: 24 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="todos"
        options={{
          title: 'Todos',
          tabBarIcon: ({ color, focused }) => (
            <Icon
              name={focused ? 'checkmark-square-2' : 'checkmark-square-2-outline'}
              fill={color}
              style={{ width: 24, height: 24 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="pomodoro"
        options={{
          title: 'Focus',
          tabBarIcon: ({ color, focused }) => (
            <Icon
              name={focused ? 'clock' : 'clock-outline'}
              fill={color}
              style={{ width: 24, height: 24 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color, focused }) => (
            <Icon
              name={focused ? 'bar-chart' : 'bar-chart-outline'}
              fill={color}
              style={{ width: 24, height: 24 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <Icon
              name={focused ? 'settings-2' : 'settings-2-outline'}
              fill={color}
              style={{ width: 24, height: 24 }}
            />
          ),
        }}
      />
    </Tabs>
  );
}
