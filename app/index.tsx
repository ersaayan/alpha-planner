import { Redirect } from 'expo-router';
import { useAuthStore, useSettingsStore } from '@/stores';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const settingsHydrated = useSettingsStore((state) => state._hasHydrated);
  const authHydrated = useAuthStore((state) => state.isHydrated);
  const session = useAuthStore((state) => state.session);
  const hasCompletedOnboarding = useSettingsStore((state) => state.settings.hasCompletedOnboarding);

  // Wait for all stores to rehydrate
  if (!settingsHydrated || !authHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // No auth session → login
  if (!session) {
    return <Redirect href={"/(auth)/login" as any} />;
  }

  // Auth OK but onboarding not done → onboarding
  if (!hasCompletedOnboarding) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  // All good → main app
  return <Redirect href="/(tabs)" />;
}
