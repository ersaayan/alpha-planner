import '@/services/i18n/i18n-config';
import * as eva from '@ui-kitten/eva';
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { ApplicationProvider } from '@ui-kitten/components';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import 'react-native-reanimated';

import { ErrorBoundary } from '@/components/error-boundary';
import { alphaDarkTheme, alphaTheme } from '@/constants/eva-theme';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { cancelScheduledTimerNotifications, scheduleTimerNotification } from '@/services/background';
import { notificationService } from '@/services/notifications';
import { useSync } from '@/hooks/use-sync';
import { useCategoryStore, useGamificationStore, usePomodoroStore, useSettingsStore } from '@/stores';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

// Custom navigation themes with our color palette
const AlphaLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.primary,
    background: Colors.light.background,
    card: Colors.light.card,
    text: Colors.light.text,
    border: Colors.light.border,
    notification: Colors.light.primary,
  },
};

const AlphaDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.primary,
    background: Colors.dark.background,
    card: Colors.dark.card,
    text: Colors.dark.text,
    border: Colors.dark.border,
    notification: Colors.dark.primary,
  },
};

function usePomodoroBackgroundSync() {
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;

      // App coming to foreground
      if (nextAppState === 'active') {
        const store = usePomodoroStore.getState();
        const currentTimer = store.timer;

        if (currentTimer.state === 'running' && currentTimer.startedAt) {
          // Sync remaining time — catches up all elapsed seconds
          store.syncTimer({ fromBackground: previousState !== 'active' });

          // Restart the ticking interval if timer is still running after sync
          if (usePomodoroStore.getState().timer.state === 'running') {
            store._startTicking();
          }
        }

        // Dismiss ongoing notification & cancel scheduled completion notification
        // (the foreground interval will handle everything from here)
        notificationService.dismissTimerNotification();
        cancelScheduledTimerNotifications();
      } else if (nextAppState === 'background') {
        // ── App going into background ──
        const store = usePomodoroStore.getState();
        const currentTimer = store.timer;
        const { settings, pomodoroSettings } = useSettingsStore.getState();

        if (currentTimer.state === 'running' && currentTimer.startedAt) {
          // Stop internal interval to save battery
          store._stopTicking();

          // Show ongoing notification with countdown
          if (settings.notificationsEnabled) {
            notificationService.showTimerNotification(
              currentTimer.phase as 'focus' | 'short_break' | 'long_break',
              currentTimer.remainingTime,
              currentTimer.totalTime,
              false,
            );
          }

          // Schedule exact completion notification using absolute timestamp
          const completionMs = currentTimer.startedAt
            + (currentTimer.totalTime * 1000)
            + ((currentTimer.totalPausedDuration ?? 0) * 1000);
          scheduleTimerNotification(
            currentTimer.phase as 'focus' | 'short_break' | 'long_break',
            completionMs,
            {
              soundEnabled: settings.soundEnabled,
              vibrationEnabled: pomodoroSettings.vibrationEnabled,
              isAbsoluteMs: true,
            },
          );
        } else if (currentTimer.state === 'paused' && settings.notificationsEnabled) {
          // Show paused state in notification shade
          notificationService.showTimerNotification(
            currentTimer.phase as 'focus' | 'short_break' | 'long_break',
            currentTimer.remainingTime,
            currentTimer.totalTime,
            true,
          );
        }
      }
    });

    return () => subscription.remove();
  }, []);
}

/**
 * Handles recovery after the app has been killed and restarted.
 * Zustand rehydrates the timer state from AsyncStorage; this hook
 * detects a previously-running timer and syncs it forward.
 */
function usePomodoroRehydrationSync() {
  useEffect(() => {
    const unsubscribe = usePomodoroStore.persist.onFinishHydration((state) => {
      if (state.timer.state === 'running' && state.timer.startedAt) {
        // Timer was running when the app was killed — catch up
        usePomodoroStore.getState().syncTimer({ fromBackground: true });

        // If timer is still running after sync, restart ticking
        const synced = usePomodoroStore.getState();
        if (synced.timer.state === 'running') {
          synced._startTicking();
        }
      }
    });

    return () => unsubscribe();
  }, []);
}

export default function RootLayout() {
  usePomodoroBackgroundSync();
  usePomodoroRehydrationSync();
  useSync();

  const colorScheme = useColorScheme();
  const initializeCategories = useCategoryStore((state) => state.initializeCategories);
  const pomodoroSettings = useSettingsStore((state) => state.pomodoroSettings);

  // Load Inter fonts
  const [fontsLoaded, fontError] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  // Hide splash screen when fonts are loaded
  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  useEffect(() => {
    // Initialize default categories on first launch
    initializeCategories();

    // Gamification startup checks (lazy generation)
    const { applyPrestigeWithRewards } = require('@/services/gamification/prestige-service');
    const { useDailyQuestsStore } = require('@/stores/daily-quests-store');
    const { useWeeklyGoalsStore } = require('@/stores/weekly-goals-store');

    // Check prestige reset (new month?)
    applyPrestigeWithRewards();

    // Generate today's quests if needed
    useDailyQuestsStore.getState().ensureTodayQuests();

    // Generate this week's goals if needed
    useWeeklyGoalsStore.getState().ensureThisWeekGoals();
  }, [initializeCategories]);

  useEffect(() => {
    // Always initialize notification service for permission check, channel setup, and action callbacks.
    // This ensures hasPermission is up-to-date and channels are created even if notifications
    // were disabled at first launch and enabled later.
    notificationService.initialize().then(() => {
      // Wire notification action callbacks so pause/resume/stop work from notification shade
      notificationService.setActionCallbacks({
        onPause: () => usePomodoroStore.getState().pauseTimer(),
        onResume: () => usePomodoroStore.getState().resumeTimer(),
        onStop: () => usePomodoroStore.getState().stopTimer(),
      });

      // Schedule daily summary notification at 23:00
      notificationService.scheduleDailySummaryNotification();
    }).catch((error) => {
      console.warn('Notification initialization failed:', error);
    });
  }, []);

  // Achievement celebration — show a brief alert when achievements are unlocked
  const pendingNotifications = useGamificationStore((state) => state.pendingNotifications);
  const dismissNotification = useGamificationStore((state) => state.dismissNotification);
  const [currentAchievementId, setCurrentAchievementId] = useState<string | null>(null);

  useEffect(() => {
    if (pendingNotifications.length > 0 && !currentAchievementId) {
      const achievement = pendingNotifications[0];
      setCurrentAchievementId(achievement.id);
      Alert.alert(
        `🏆 Achievement Unlocked!`,
        `${achievement.name}\n${achievement.description}\n+${achievement.xpReward} XP`,
        [{ text: 'Awesome!', onPress: () => {
          dismissNotification(achievement.id);
          setCurrentAchievementId(null);
        }}],
        { cancelable: false }
      );
    }
  }, [pendingNotifications, currentAchievementId, dismissNotification]);

  useEffect(() => {
    usePomodoroStore.getState().applySettingsToTimer(pomodoroSettings);
  }, [pomodoroSettings]);

  const isDark = colorScheme === 'dark';
  const evaTheme = isDark ? { ...eva.dark, ...alphaDarkTheme } : { ...eva.light, ...alphaTheme };
  const navigationTheme = isDark ? AlphaDarkTheme : AlphaLightTheme;

  // Don't render until fonts are loaded
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ErrorBoundary>
      <ApplicationProvider {...eva} theme={evaTheme}>
        <ThemeProvider value={navigationTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="todo/[id]"
              options={{
                headerShown: true,
                title: 'Todo Details',
              }}
            />
            <Stack.Screen
              name="todo/create"
              options={{
                headerShown: true,
                title: 'New Todo',
              }}
            />

            <Stack.Screen name="views/kanban" options={{ headerShown: false }} />
            <Stack.Screen name="views/calendar" options={{ headerShown: false }} />
            <Stack.Screen name="views/timeline" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style={isDark ? 'light' : 'dark'} />
        </ThemeProvider>
      </ApplicationProvider>
    </ErrorBoundary>
  );
}
