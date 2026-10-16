import { Stack } from 'expo-router';
import { isSyncConfigured } from '@/services/supabase/client';
import { useSettingsStore } from '@/stores/settings-store';

/**
 * The root navigator. Access is decided by guards, not by redirects in screens, so
 * deep links, the Android back button and the iOS edge swipe all respect them:
 *
 * - Onboarding is reachable only until it is completed; everything else only after.
 *   Flipping `hasCompletedOnboarding` moves the user between the two automatically.
 * - The sign-in screens exist only in builds with sync configured. They are a modal
 *   opened from Settings and close themselves after a successful sign-in (guarding
 *   them on the auth status too would replace the modal with a second copy of the
 *   tabs instead of going back).
 *
 * Render this only after the stores have hydrated (see useAppBootstrap), otherwise
 * the default `hasCompletedOnboarding: false` would route a returning user to onboarding.
 */
export function RootStack() {
  const hasCompletedOnboarding = useSettingsStore((state) => state.settings.hasCompletedOnboarding);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Explicit redirects: the default fallback ("/(onboarding)") has no index route. */}
      <Stack.Protected guard={!hasCompletedOnboarding} redirectTo="/">
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>

      <Stack.Protected guard={hasCompletedOnboarding} redirectTo="/welcome">
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

        <Stack.Protected guard={isSyncConfigured} redirectTo="/">
          <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
        </Stack.Protected>
      </Stack.Protected>

      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
