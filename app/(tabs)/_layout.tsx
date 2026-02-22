import { Icon } from '@/components/icon';
import { CustomTabBar } from '@/components/navigation';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { notificationService } from '@/services/notifications';
import { usePomodoroStore, useSettingsStore } from '@/stores';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';

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

  useEffect(() => {
    notificationService.setActionCallbacks({
      onPause: pauseTimer,
      onResume: resumeTimer,
      onStop: stopTimer,
    });
  }, [pauseTimer, resumeTimer, stopTimer]);

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
