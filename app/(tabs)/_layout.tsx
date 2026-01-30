import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Icon } from '@/components/icon';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { HapticTab } from '@/components/haptic-tab';
import { usePomodoroStore, useSettingsStore } from '@/stores';
import { notificationService } from '@/services/notifications';
import { cancelScheduledTimerNotifications } from '@/services/background';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const notificationsEnabled = useSettingsStore(
    (state) => state.settings.notificationsEnabled
  );

  // Handle app state for background/foreground transitions
  useEffect(() => {
    const appStateRef = { current: AppState.currentState };

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;

      // Get fresh timer state and actions from store
      const store = usePomodoroStore.getState();
      const currentTimer = store.timer;

      // App going to background - show ongoing notification
      if (
        previousState === 'active' &&
        (nextAppState === 'background' || nextAppState === 'inactive') &&
        currentTimer.state === 'running' &&
        currentTimer.startedAt
      ) {
        if (!notificationsEnabled) return;
        const elapsed = Math.floor((Date.now() - currentTimer.startedAt) / 1000);
        const currentRemaining = Math.max(0, currentTimer.totalTime - elapsed);

        if (currentTimer.phase !== 'idle') {
          notificationService.showTimerNotification(
            currentTimer.phase as 'focus' | 'short_break' | 'long_break',
            currentRemaining,
            currentTimer.totalTime
          );
        }
      }

      // App coming to foreground - update timer and dismiss notification
      if (
        nextAppState === 'active' &&
        currentTimer.state === 'running' &&
        currentTimer.startedAt
      ) {
        // Sync remaining time (accounts for pause-aware startedAt)
        store.syncTimer({ fromBackground: previousState !== 'active' });

        // Restart the interval (it may have been suspended in background)
        if (usePomodoroStore.getState().timer.state === 'running') {
          store._startTicking();
        }

        // Dismiss the ongoing notification
        notificationService.dismissTimerNotification();
      }
    });

    return () => subscription.remove();
  }, [notificationsEnabled]);

  useEffect(() => {
    if (!notificationsEnabled) {
      notificationService.dismissTimerNotification();
      cancelScheduledTimerNotifications();
    }
  }, [notificationsEnabled]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tabIconSelected,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        headerShown: false,
        tabBarButton: HapticTab,
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
