import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import * as eva from '@eva-design/eva';
import { ApplicationProvider } from '@ui-kitten/components';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { alphaTheme, alphaDarkTheme } from '@/constants/eva-theme';
import { migrateDbIfNeeded } from '@/services/database';
import { notificationService } from '@/services/notifications';
import { useCategoryStore } from '@/stores';
import { Colors } from '@/constants/theme';

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

  useEffect(() => {
    // Initialize default categories on first launch
    initializeCategories();
    // Initialize notifications
    notificationService.initialize();
  }, [initializeCategories]);

  const isDark = colorScheme === 'dark';
  const evaTheme = isDark ? { ...eva.dark, ...alphaDarkTheme } : { ...eva.light, ...alphaTheme };
  const navigationTheme = isDark ? AlphaDarkTheme : AlphaLightTheme;

  return (
    <SQLiteProvider databaseName="alphaplanner.db" onInit={migrateDbIfNeeded}>
        <ApplicationProvider {...eva} theme={evaTheme}>
          <ThemeProvider value={navigationTheme}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="todo/[id]"
                options={{
                  presentation: 'modal',
                  headerShown: true,
                  title: 'Todo Details',
                }}
              />
              <Stack.Screen
                name="todo/create"
                options={{
                  presentation: 'modal',
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
      </SQLiteProvider>
  );
}
