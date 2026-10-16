import { act, renderHook } from '@testing-library/react-native';
import { areStoresHydrated, useStoresHydrated, whenStoresHydrated } from '@/stores/hydration';
import { useCategoryStore } from '@/stores/category-store';

describe('store hydration', () => {
  it('whenStoresHydrated resolves once every store has loaded', async () => {
    await whenStoresHydrated();
    expect(areStoresHydrated()).toBe(true);
    expect(useCategoryStore.persist.hasHydrated()).toBe(true);
  });

  it('whenStoresHydrated resolves immediately when hydration already finished', async () => {
    await whenStoresHydrated();
    await expect(whenStoresHydrated()).resolves.toBeUndefined();
    await expect(whenStoresHydrated([useCategoryStore])).resolves.toBeUndefined();
  });

  it('useStoresHydrated reports true after hydration', async () => {
    const { result } = await renderHook(() => useStoresHydrated());
    await act(async () => {
      await whenStoresHydrated();
    });
    expect(result.current).toBe(true);
  });

  it('waits for a store that is rehydrating again', async () => {
    let resolved = false;
    const rehydration = useCategoryStore.persist.rehydrate();
    expect(useCategoryStore.persist.hasHydrated()).toBe(false);
    const waiting = whenStoresHydrated([useCategoryStore]).then(() => {
      resolved = true;
    });
    expect(resolved).toBe(false);
    await rehydration;
    await waiting;
    expect(resolved).toBe(true);
  });
});
