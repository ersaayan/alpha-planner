import { Redirect } from 'expo-router';
import { useSettingsStore } from '@/stores';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const hasHydrated = useSettingsStore((state) => state._hasHydrated);
  const hasCompletedOnboarding = useSettingsStore((state) => state.settings.hasCompletedOnboarding);

  // Wait for store rehydration before rendering navigation
  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  return <Redirect href="/(tabs)" />;
}
