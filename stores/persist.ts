import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistOptions, PersistStorage, StorageValue } from 'zustand/middleware';

/**
 * Shared persistence setup for every Zustand store (except pomodoro-store, which
 * keeps its own options). It guarantees three things:
 *
 * 1. Nothing is written to disk before a store has loaded what is already there.
 *    Zustand's persist middleware saves on every set(), even before rehydration,
 *    so an early write (e.g. default categories) could overwrite the user's data.
 * 2. Stored data that cannot be read or migrated is copied to `<name>:backup`
 *    before the store falls back to defaults, so it is never silently destroyed.
 * 3. Stored data is deep-merged over the current defaults, so fields added in a
 *    later release get their default value instead of `undefined`.
 */

const writableStores = new Set<string>();
const failedStores = new Set<string>();
const failureListeners = new Set<() => void>();

export const BACKUP_SUFFIX = ':backup';

export function backupKey(name: string): string {
  return `${name}${BACKUP_SUFFIX}`;
}

/** True when a store could not load its stored data at all (e.g. a storage read error). */
export function isHydrationFailed(name: string): boolean {
  return failedStores.has(name);
}

export function onHydrationFailure(listener: () => void): () => void {
  failureListeners.add(listener);
  return () => {
    failureListeners.delete(listener);
  };
}

async function backupRawValue(name: string, raw: string, reason: string): Promise<void> {
  console.warn(`[persist] Stored data for "${name}" is ${reason}; a copy was kept in "${backupKey(name)}".`);
  try {
    await AsyncStorage.setItem(backupKey(name), raw);
  } catch (error) {
    console.warn(`[persist] Could not back up "${name}".`, error);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Migration helper: the value as an object, or `{}`. */
export function asRecord(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

/** Migration helper: the plain-object items of an array, or `[]`. */
export function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isPlainObject) : [];
}

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Deep-merges stored data over defaults. Plain objects merge key by key; arrays and
 * primitives come from storage; a stored value of the wrong kind (e.g. a string where
 * an object is expected) falls back to the default. Functions in `defaults` (store
 * actions) are never replaced.
 */
export function mergeWithDefaults<T>(defaults: T, persisted: unknown): T {
  if (persisted === undefined) return defaults;

  if (isPlainObject(defaults)) {
    if (!isPlainObject(persisted)) return defaults;
    const result: Record<string, unknown> = { ...defaults };
    for (const [key, value] of Object.entries(persisted)) {
      if (UNSAFE_KEYS.has(key)) continue;
      const defaultValue = (defaults as Record<string, unknown>)[key];
      if (typeof defaultValue === 'function') continue;
      result[key] = key in defaults ? mergeWithDefaults(defaultValue, value) : value;
    }
    return result as T;
  }

  if (Array.isArray(defaults)) {
    return (Array.isArray(persisted) ? persisted : defaults) as T;
  }

  if (
    defaults !== null &&
    persisted !== null &&
    (typeof defaults === 'string' || typeof defaults === 'number' || typeof defaults === 'boolean') &&
    typeof persisted !== typeof defaults
  ) {
    return defaults;
  }

  return persisted as T;
}

function createGuardedStorage<P>(name: string): PersistStorage<P> {
  return {
    getItem: async (key) => {
      // A read error propagates: the store is then marked as failed and keeps
      // its stored copy untouched (see onRehydrateStorage below).
      const raw = await AsyncStorage.getItem(key);
      if (raw === null) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isPlainObject(parsed) && 'state' in parsed) {
          return parsed as unknown as StorageValue<P>;
        }
      } catch {
        // fall through to the backup below
      }
      await backupRawValue(key, raw, 'unreadable');
      return null;
    },
    setItem: async (key, value) => {
      if (!writableStores.has(name)) return;
      try {
        await AsyncStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.warn(`[persist] Could not save "${name}".`, error);
      }
    },
    removeItem: (key) => AsyncStorage.removeItem(key),
  };
}

export interface AppPersistConfig<S, P> {
  name: string;
  version: number;
  partialize: (state: S) => P;
  /**
   * Converts data stored by an older (or newer) app version into the current
   * persisted shape. Receives untrusted input; missing fields may be left out,
   * the deep merge with defaults fills them in.
   */
  migrate: (persisted: unknown, fromVersion: number) => unknown;
  /**
   * Optional clean-up applied to stored data on every load (not only on version
   * changes), before the deep merge. Must be idempotent.
   */
  normalize?: (persisted: unknown) => unknown;
}

export function createPersistOptions<S, P>(config: AppPersistConfig<S, P>): PersistOptions<S, P> {
  const { name, version, partialize, migrate, normalize } = config;
  return {
    name,
    version,
    partialize,
    storage: createGuardedStorage<P>(name),
    migrate: (persisted, fromVersion) => {
      try {
        return migrate(persisted, fromVersion) as P;
      } catch (error) {
        console.warn(`[persist] Migrating "${name}" from v${fromVersion} failed; merging the stored data as-is.`, error);
        let raw: string | undefined;
        try {
          raw = JSON.stringify({ state: persisted, version: fromVersion });
        } catch {
          raw = undefined;
        }
        if (raw !== undefined) void backupRawValue(name, raw, 'from an unsupported version');
        return persisted as P;
      }
    },
    merge: (persisted, current) => {
      const cleaned = normalize && persisted !== undefined ? normalize(persisted) : persisted;
      const merged = mergeWithDefaults(current, cleaned);
      // From here on the in-memory state contains the stored data, so saving is safe.
      writableStores.add(name);
      return merged;
    },
    onRehydrateStorage: () => (_state, error) => {
      if (!error) return;
      failedStores.add(name);
      console.warn(
        `[persist] Could not load "${name}". The stored copy is left untouched and changes are not saved this session.`,
        error
      );
      failureListeners.forEach((listener) => listener());
    },
  };
}

/** Lets a store save again after its data was deliberately replaced (used by "Reset all data"). */
export function markStoreWritable(name: string): void {
  failedStores.delete(name);
  writableStores.add(name);
}

/** Test helper: forgets which stores were hydrated or failed. */
export function __resetPersistStateForTests(): void {
  writableStores.clear();
  failedStores.clear();
}
