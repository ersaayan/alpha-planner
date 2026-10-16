import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// Sync is optional. Store builds ship without these variables, so the app must
// work (and never touch the network) when either of them is missing.
// Keep the direct `process.env.EXPO_PUBLIC_*` reads: Expo only inlines them in that form.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim() ?? '';

function createSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) return null;
  try {
    return createClient(supabaseUrl, supabaseKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        // No `lock` option: deprecated since auth-js 2.118, which coordinates refreshes itself.
      },
    });
  } catch (error) {
    // A malformed URL must not crash the app at import time; fall back to local-only.
    console.warn('[sync] Supabase is configured but the client could not be created; sync is disabled.', error);
    return null;
  }
}

/** The Supabase client, or `null` when sync is not configured for this build. */
export const supabase: SupabaseClient | null = createSupabaseClient();

/** True only when BOTH EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY are set (and valid). */
export const isSyncConfigured: boolean = supabase !== null;
