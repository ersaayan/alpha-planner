import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  getAlertPermissions,
  type AlertPermissions,
} from '@/services/notifications/alert-permissions';
import { useSettingsStore } from '@/stores';

/**
 * Current notification / exact-alarm / channel status. Re-checked whenever the app
 * returns to the foreground, e.g. after the user changed something in system settings.
 * `permissions` is null until the first check finishes.
 */
export function useAlertPermissions() {
  const soundEnabled = useSettingsStore((state) => state.settings.soundEnabled);
  const vibrationEnabled = useSettingsStore((state) => state.pomodoroSettings.vibrationEnabled);
  const [permissions, setPermissions] = useState<AlertPermissions | null>(null);

  const load = useCallback(
    () => getAlertPermissions({ soundEnabled, vibrationEnabled }),
    [soundEnabled, vibrationEnabled],
  );

  const refresh = useCallback(() => {
    return load().then(setPermissions, () => undefined);
  }, [load]);

  useEffect(() => {
    let active = true;
    const check = () => {
      load().then(
        (next) => {
          if (active) setPermissions(next);
        },
        () => undefined,
      );
    };
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [load]);

  return { permissions, refresh };
}
