import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  backupKey,
  createPersistOptions,
  isHydrationFailed,
  mergeWithDefaults,
} from '@/stores/persist';

type Storage = { __INTERNAL_MOCK_STORAGE__: Record<string, string> };
const disk = () => (AsyncStorage as unknown as Storage).__INTERNAL_MOCK_STORAGE__;

interface TestState {
  items: string[];
  prefs: { color: string; size: number; nested: { on: boolean } };
  add: (item: string) => void;
}

let counter = 0;

function createTestStore(options: { migrate?: (persisted: unknown, version: number) => unknown; version?: number } = {}) {
  counter += 1;
  const name = `test-store-${counter}`;
  const useStore = create<TestState>()(
    persist(
      (set) => ({
        items: [],
        prefs: { color: 'green', size: 2, nested: { on: true } },
        add: (item) => set((state) => ({ items: [...state.items, item] })),
      }),
      createPersistOptions<TestState, Pick<TestState, 'items' | 'prefs'>>({
        name,
        version: options.version ?? 1,
        partialize: (state) => ({ items: state.items, prefs: state.prefs }),
        migrate: options.migrate ?? ((persisted) => persisted),
      })
    )
  );
  return { name, useStore };
}

function nextName() {
  return `test-store-${counter + 1}`;
}

async function flush() {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('mergeWithDefaults', () => {
  const defaults = {
    list: [1, 2],
    obj: { a: 1, b: { c: 'x' } },
    nullable: null as string | null,
    flag: true,
    action: () => 'real',
  };

  it('fills fields missing from storage with their defaults (deep)', () => {
    const merged = mergeWithDefaults(defaults, { obj: { b: {} } });
    expect(merged.obj).toEqual({ a: 1, b: { c: 'x' } });
    expect(merged.list).toEqual([1, 2]);
    expect(merged.flag).toBe(true);
  });

  it('takes arrays and primitives from storage', () => {
    const merged = mergeWithDefaults(defaults, { list: [9], flag: false, nullable: 'set' });
    expect(merged.list).toEqual([9]);
    expect(merged.flag).toBe(false);
    expect(merged.nullable).toBe('set');
  });

  it('keeps stored keys the defaults do not know about', () => {
    expect(mergeWithDefaults(defaults, { extra: 5 })).toHaveProperty('extra', 5);
  });

  it('falls back to the default when the stored value has the wrong kind', () => {
    const merged = mergeWithDefaults(defaults, { obj: 'oops', list: { 0: 1 }, flag: 'yes' });
    expect(merged.obj).toEqual(defaults.obj);
    expect(merged.list).toEqual(defaults.list);
    expect(merged.flag).toBe(true);
  });

  it('never replaces actions and ignores prototype keys', () => {
    const merged = mergeWithDefaults(defaults, JSON.parse('{"action": 1, "__proto__": {"polluted": true}}'));
    expect(merged.action()).toBe('real');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
  });

  it('returns the defaults for undefined storage', () => {
    expect(mergeWithDefaults(defaults, undefined)).toBe(defaults);
  });
});

describe('createPersistOptions', () => {
  it('does not write to disk before the stored data has been loaded', async () => {
    const name = nextName();
    disk()[name] = JSON.stringify({ state: { items: ['stored'], prefs: { color: 'red', size: 1, nested: { on: false } } }, version: 1 });

    const { useStore } = createTestStore();
    // Simulates startup code that runs before hydration (e.g. default data).
    useStore.getState().add('early-default');
    expect(JSON.parse(disk()[name]).state.items).toEqual(['stored']);

    await flush();

    expect(useStore.persist.hasHydrated()).toBe(true);
    expect(useStore.getState().items).toEqual(['stored']);
    expect(JSON.parse(disk()[name]).state.items).toEqual(['stored']);

    useStore.getState().add('after');
    expect(JSON.parse(disk()[name]).state.items).toEqual(['stored', 'after']);
  });

  it('deep-merges stored data with defaults added in a later version', async () => {
    const name = nextName();
    disk()[name] = JSON.stringify({ state: { items: ['a'], prefs: { color: 'red' } }, version: 1 });

    const { useStore } = createTestStore();
    await flush();

    expect(useStore.getState().prefs).toEqual({ color: 'red', size: 2, nested: { on: true } });
    expect(typeof useStore.getState().add).toBe('function');
  });

  it('backs up unreadable data before falling back to defaults', async () => {
    const name = nextName();
    disk()[name] = '{"state": {"items": ["half';

    const { useStore } = createTestStore();
    await flush();

    expect(useStore.persist.hasHydrated()).toBe(true);
    expect(useStore.getState().items).toEqual([]);
    expect(disk()[backupKey(name)]).toBe('{"state": {"items": ["half');
  });

  it('runs migrate for an older version and saves the result', async () => {
    const name = nextName();
    disk()[name] = JSON.stringify({ state: { list: ['old'] }, version: 0 });
    const migrate = jest.fn((persisted: unknown) => ({ items: (persisted as { list: string[] }).list }));

    const { useStore } = createTestStore({ migrate });
    await flush();

    expect(migrate).toHaveBeenCalledWith({ list: ['old'] }, 0);
    expect(useStore.getState().items).toEqual(['old']);
    const saved = JSON.parse(disk()[name]);
    expect(saved.version).toBe(1);
    expect(saved.state.items).toEqual(['old']);
  });

  it('keeps a backup and merges as-is when migrate throws', async () => {
    const name = nextName();
    disk()[name] = JSON.stringify({ state: { items: ['keep'] }, version: 0 });

    const { useStore } = createTestStore({
      migrate: () => {
        throw new Error('bug in migration');
      },
    });
    await flush();

    expect(useStore.persist.hasHydrated()).toBe(true);
    expect(useStore.getState().items).toEqual(['keep']);
    expect(JSON.parse(disk()[backupKey(name)]).state.items).toEqual(['keep']);
  });

  it('a storage read error marks the store failed and never overwrites the stored copy', async () => {
    const name = nextName();
    const stored = JSON.stringify({ state: { items: ['precious'] }, version: 1 });
    disk()[name] = stored;
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk I/O'));

    const { useStore } = createTestStore();
    await flush();

    expect(isHydrationFailed(name)).toBe(true);
    expect(useStore.persist.hasHydrated()).toBe(false);

    useStore.getState().add('session-only');
    await flush();
    expect(useStore.getState().items).toEqual(['session-only']);
    expect(disk()[name]).toBe(stored);
  });
});
