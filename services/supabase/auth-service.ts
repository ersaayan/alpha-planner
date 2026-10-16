import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import type { UserProfile } from '@/types/auth.types';
import { SyncNotConfiguredError } from './auth-errors';
import { supabase } from './client';

function requireClient(): SupabaseClient {
  if (!supabase) throw new SyncNotConfiguredError();
  return supabase;
}

export async function signUp(email: string, password: string, displayName: string) {
  const { data, error } = await requireClient().auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await requireClient().auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

/**
 * Signs out on this device only. Never throws: offline or server errors still
 * remove the local session (auth-js does that for `scope: 'local'`), and the
 * caller clears its own state regardless.
 */
export async function signOut(): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) console.warn('[auth] Sign-out reported an error; the local session was removed anyway.', error);
  } catch (error) {
    console.warn('[auth] Sign-out failed; continuing with local sign-out.', error);
  }
}

/**
 * Permanently deletes the signed-in account on the server (see
 * supabase/migrations/0002_delete_account.sql). Server rows cascade.
 */
export async function deleteAccount(): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc('delete_account');
  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getProfile(): Promise<UserProfile | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, locale, prestige_count, created_at')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    locale: data.locale,
    prestigeCount: data.prestige_count,
    createdAt: data.created_at,
  };
}

export async function updateProfile(
  updates: Partial<Pick<UserProfile, 'displayName' | 'avatarUrl' | 'locale'>>
) {
  const client = requireClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const dbUpdates: Record<string, unknown> = {};
  if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
  if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
  if (updates.locale !== undefined) dbUpdates.locale = updates.locale;

  const { error } = await client
    .from('profiles')
    .update(dbUpdates)
    .eq('id', user.id);

  if (error) throw error;
}

/** Subscribes to auth events. Returns a no-op unsubscribe when sync is not configured. */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

/** Token auto-refresh should only run while the app is in the foreground (Supabase RN guidance). */
export function setAutoRefresh(enabled: boolean): void {
  if (!supabase) return;
  if (enabled) {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
}
