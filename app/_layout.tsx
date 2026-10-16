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
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import 'react-native-reanimated';

import { ErrorBoundary } from '@/components/error-boundary';
import { alphaDarkTheme, alphaTheme } from '@/constants/eva-theme';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePomodoroLifecycle } from '@/hooks/use-pomodoro-lifecycle';
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

export default function RootLayout() {
  usePomodoroLifecycle();
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

  // Achievement celebration — show a brief alert when achievements are unlocked
  const pendingNotifications = useGamificationStore((state) => state.pendingNotifications);
  const dismissNotification = useGamificationStore((state) => state.dismissNotification);
  const [currentAchievementId, setCurrentAchievementId] = useState<string | null>(null);

  useEffect(() => {
    if (pendingNotifications.length > 0 && !currentAchievementId) {
      const achievement = pendingNotifications[0];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- guards against stacking Alert dialogs
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
