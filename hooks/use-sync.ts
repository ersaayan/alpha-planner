import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '@/stores/auth-store';
import { fullSync } from '@/services/sync';

const DEBOUNCE_MS = 2000; // Don't sync more than once per 2 seconds

export function useSync() {
  const session = useAuthStore((state) => state.session);
  const lastSyncRef = useRef(0);

  useEffect(() => {
    if (!session) return;

    // Sync on initial mount (app opened)
    const now = Date.now();
    if (now - lastSyncRef.current > DEBOUNCE_MS) {
      lastSyncRef.current = now;
      fullSync();
    }

    // Sync on foreground
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && session) {
        const syncNow = Date.now();
        if (syncNow - lastSyncRef.current > DEBOUNCE_MS) {
          lastSyncRef.current = syncNow;
          fullSync();
        }
      }
    });

    return () => subscription.remove();
  }, [session]);
}
