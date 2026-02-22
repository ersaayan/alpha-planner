import * as eva from '@eva-design/eva';
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { ApplicationProvider } from '@ui-kitten/components';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import 'react-native-reanimated';

import { alphaDarkTheme, alphaTheme } from '@/constants/eva-theme';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { notificationService } from '@/services/notifications';
import { useCategoryStore, usePomodoroStore, useSettingsStore } from '@/stores';

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
          // Sync remaining time
          store.syncTimer({ fromBackground: previousState !== 'active' });

          // Restart the ticking interval if it's still running
          if (usePomodoroStore.getState().timer.state === 'running') {
            store._startTicking();
          }
        }

        // Always dismiss the ongoing background notification when opening the app
        notificationService.dismissTimerNotification();
      } else if (nextAppState === 'background') {
        // App going into background
        const store = usePomodoroStore.getState();
        const currentTimer = store.timer;
        if (currentTimer.state === 'running' && currentTimer.startedAt) {
          // Stop internal interval to save battery, rely on syncTimer when reopening
          store._stopTicking();

          // Re-affirm the completion notification is scheduled
          const { settings, pomodoroSettings } = useSettingsStore.getState();
          import('@/services/background').then(({ scheduleTimerNotification }) => {
            scheduleTimerNotification(
              currentTimer.phase as 'focus' | 'short_break' | 'long_break',
              currentTimer.remainingTime,
              { soundEnabled: settings.soundEnabled, vibrationEnabled: pomodoroSettings.vibrationEnabled }
            );
          });
        }
      }
    });

    return () => subscription.remove();
  }, []);
}

export default function RootLayout() {
  usePomodoroBackgroundSync();

  const colorScheme = useColorScheme();
  const initializeCategories = useCategoryStore((state) => state.initializeCategories);
  const notificationsEnabled = useSettingsStore(
    (state) => state.settings.notificationsEnabled
  );
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
  }, [initializeCategories]);

  useEffect(() => {
    if (notificationsEnabled) {
      notificationService.initialize();
    }
  }, [notificationsEnabled]);

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
    <ApplicationProvider {...eva} theme={evaTheme}>
      <ThemeProvider value={navigationTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
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
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen name="views/kanban" options={{ headerShown: false }} />
          <Stack.Screen name="views/calendar" options={{ headerShown: false }} />
          <Stack.Screen name="views/timeline" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </ThemeProvider>
    </ApplicationProvider>
  );
}
