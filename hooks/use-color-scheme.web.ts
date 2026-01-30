import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useSettingsStore } from '@/stores';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const theme = useSettingsStore((state) => state.settings.theme);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (theme === 'light' || theme === 'dark') {
    return theme;
  }

  if (hasHydrated) {
    return colorScheme ?? 'light';
  }

  return 'light';
}
