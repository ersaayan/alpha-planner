import { Redirect } from 'expo-router';
import { useSettingsStore } from '@/stores';

export default function Index() {
  const hasCompletedOnboarding = useSettingsStore((state) => state.settings.hasCompletedOnboarding);

  if (!hasCompletedOnboarding) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  return <Redirect href="/(tabs)" />;
}
