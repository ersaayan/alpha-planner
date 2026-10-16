import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { isSyncConfigured } from '@/services/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { fullSync } from '@/services/sync';

const DEBOUNCE_MS = 2000; // Don't sync more than once per 2 seconds

/** Pushes queued changes on start and on every return to the foreground. Inert without sync. */
export function useSync() {
  const isSignedIn = useAuthStore((state) => state.status === 'signedIn');
  const lastSyncRef = useRef(0);

  useEffect(() => {
    if (!isSyncConfigured || !isSignedIn) return;

    // Sync on initial mount (app opened)
    const now = Date.now();
    if (now - lastSyncRef.current > DEBOUNCE_MS) {
      lastSyncRef.current = now;
      fullSync();
    }

    // Sync on foreground
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        const syncNow = Date.now();
        if (syncNow - lastSyncRef.current > DEBOUNCE_MS) {
          lastSyncRef.current = syncNow;
          fullSync();
        }
      }
    });

    return () => subscription.remove();
  }, [isSignedIn]);
}
