import { useEffect, useCallback } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as eva from '@eva-design/eva';
import { ApplicationProvider } from '@ui-kitten/components';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { alphaTheme, alphaDarkTheme } from '@/constants/eva-theme';
import { notificationService } from '@/services/notifications';
import { useCategoryStore, usePomodoroStore, useSettingsStore } from '@/stores';
import { Colors } from '@/constants/theme';

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
