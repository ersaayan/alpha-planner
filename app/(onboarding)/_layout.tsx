import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="pomodoro-setup" />
      <Stack.Screen name="category-selection" />
    </Stack>
  );
}
