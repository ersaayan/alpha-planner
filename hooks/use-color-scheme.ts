import { useColorScheme as useRNColorScheme } from 'react-native';
import { useSettingsStore } from '@/stores';

export function useColorScheme() {
  const deviceScheme = useRNColorScheme();
  const theme = useSettingsStore((state) => state.settings.theme);

  if (theme === 'light' || theme === 'dark') {
    return theme;
  }

  return deviceScheme ?? 'light';
}
