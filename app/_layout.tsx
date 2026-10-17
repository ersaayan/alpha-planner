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
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import 'react-native-reanimated';

import { ErrorBoundary } from '@/components/error-boundary';
import { CelebrationHost } from '@/components/gamification/celebration-host';
import { RootStack } from '@/components/navigation/root-stack';
import { alphaDarkTheme, alphaTheme } from '@/constants/eva-theme';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePomodoroLifecycle } from '@/hooks/use-pomodoro-lifecycle';
import { useSync } from '@/hooks/use-sync';
import { useAppBootstrap } from '@/hooks/use-app-bootstrap';
import { useGamificationStore, usePomodoroStore, useSettingsStore } from '@/stores';
import { useStoresHydrated } from '@/stores/hydration';

// Keep the splash screen up until fonts and stored data are loaded (see useAppBootstrap)
SplashScreen.preventAutoHideAsync();

// Deep links open on top of the tabs, so "back" lands in the app instead of exiting.
// The anchor is guarded like any screen: during onboarding it is skipped and cleared.
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
  const isReady = useAppBootstrap();
  const storesHydrated = useStoresHydrated();
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

  // Hide the splash screen once fonts and stored data are loaded
  const onLayoutRootView = useCallback(async () => {
    if ((fontsLoaded || fontError) && isReady) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isReady]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  // Startup tasks (default categories, quests, goals, prestige) run in useAppBootstrap, after hydration.

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
    // Not before hydration: default settings must not overwrite a stored timer.
    if (!storesHydrated) return;
    usePomodoroStore.getState().applySettingsToTimer(pomodoroSettings);
  }, [pomodoroSettings, storesHydrated]);

  const isDark = colorScheme === 'dark';
  const evaTheme = isDark ? { ...eva.dark, ...alphaDarkTheme } : { ...eva.light, ...alphaTheme };
  const navigationTheme = isDark ? AlphaDarkTheme : AlphaLightTheme;

  // Don't render until fonts and stored data are loaded: the navigation guards
  // depend on stored settings (e.g. whether onboarding was completed).
  if ((!fontsLoaded && !fontError) || !isReady) {
    return null;
  }

  return (
    <ErrorBoundary>
      <ApplicationProvider {...eva} theme={evaTheme}>
        <ThemeProvider value={navigationTheme}>
          <RootStack />
          <CelebrationHost />
          <StatusBar style={isDark ? 'light' : 'dark'} />
        </ThemeProvider>
      </ApplicationProvider>
    </ErrorBoundary>
  );
}
