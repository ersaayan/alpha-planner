import { useColorScheme as useRNColorScheme } from 'react-native';
import { useSettingsStore } from '@/stores';

export function useColorScheme(): 'light' | 'dark' {
  const deviceScheme = useRNColorScheme();
  const theme = useSettingsStore((state) => state.settings.theme);

  if (theme === 'light' || theme === 'dark') {
    return theme;
  }

  // React Native reports 'unspecified' (or null) when the OS has no preference
  return deviceScheme === 'dark' ? 'dark' : 'light';
}
