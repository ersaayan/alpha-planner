import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useSettingsStore } from '@/stores';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
const subscribeNoop = () => () => {};

export function useColorScheme(): 'light' | 'dark' {
  // false while rendering on the server and hydrating, true once running on the client
  const hasHydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const theme = useSettingsStore((state) => state.settings.theme);

  const colorScheme = useRNColorScheme();

  if (theme === 'light' || theme === 'dark') {
    return theme;
  }

  if (hasHydrated) {
    return colorScheme === 'dark' ? 'dark' : 'light';
  }

  return 'light';
}
