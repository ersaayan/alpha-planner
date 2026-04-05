jest.mock('@/stores/todo-store', () => ({
  useTodoStore: {
    getState: jest.fn(() => ({ todos: [], filter: {} })),
    setState: jest.fn(),
  },
}));

jest.mock('@/stores/sync-store', () => ({
  useSyncStore: {
    getState: jest.fn(() => ({ enqueue: jest.fn() })),
  },
}));

import { useCategoryStore } from '@/stores/category-store';
import { useTodoStore } from '@/stores/todo-store';
import { useSyncStore } from '@/stores/sync-store';
import { DEFAULT_CATEGORY_IDS } from '@/constants/defaults';
import { Palette } from '@/constants/theme';

const INITIAL_STATE = {
  categories: [],
  isInitialized: false,
};

beforeEach(() => {
  useCategoryStore.setState(INITIAL_STATE);
  jest.clearAllMocks();
});

describe('useCategoryStore', () => {
  // ── initializeCategories ──────────────────────────────────────────────

  it('initializeCategories: creates 5 default categories', () => {
    useCategoryStore.getState().initializeCategories();

    const { categories, isInitialized } = useCategoryStore.getState();
    expect(categories).toHaveLength(5);
    expect(isInitialized).toBe(true);

    const names = categories.map((c) => c.name);
    expect(names).toEqual(['Work', 'Personal', 'Health', 'Learning', 'Shopping']);
  });

  it('initializeCategories: uses stable default IDs', () => {
    useCategoryStore.getState().initializeCategories();

    const { categories } = useCategoryStore.getState();
    const ids = categories.map((c) => c.id);
    const expectedIds = Object.values(DEFAULT_CATEGORY_IDS);
    expect(ids).toEqual(expectedIds);
  });

  it('initializeCategories: is idempotent (does not re-init)', () => {
    useCategoryStore.getState().initializeCategories();
    const firstCategories = useCategoryStore.getState().categories;

    useCategoryStore.getState().initializeCategories();
    const secondCategories = useCategoryStore.getState().categories;

    expect(secondCategories).toEqual(firstCategories);
  });

  // ── addCategory ───────────────────────────────────────────────────────

  it('addCategory: creates with correct fields', () => {
    const mockEnqueue = jest.fn();
    (useSyncStore.getState as jest.Mock).mockReturnValue({ enqueue: mockEnqueue });

    const result = useCategoryStore.getState().addCategory({
      name: 'Custom',
      color: '#FF0000',
      icon: 'star',
      order: 10,
    });

    expect(result.name).toBe('Custom');
    expect(result.color).toBe('#FF0000');
    expect(result.icon).toBe('star');
    expect(result.id).toBeDefined();
    expect(result.createdAt).toBeDefined();
    expect(mockEnqueue).toHaveBeenCalledWith('categories', 'insert', expect.objectContaining({
      name: 'Custom',
    }));
  });

  it('addCategory: sets isDefault to false', () => {
    const mockEnqueue = jest.fn();
    (useSyncStore.getState as jest.Mock).mockReturnValue({ enqueue: mockEnqueue });

    const result = useCategoryStore.getState().addCategory({
      name: 'New',
      color: '#000',
      icon: null,
      order: 5,
    });

    expect(result.isDefault).toBe(false);
  });

  // ── updateCategory ────────────────────────────────────────────────────

  it('updateCategory: updates specified fields', () => {
    const mockEnqueue = jest.fn();
    (useSyncStore.getState as jest.Mock).mockReturnValue({ enqueue: mockEnqueue });

    useCategoryStore.getState().initializeCategories();
    const catId = useCategoryStore.getState().categories[0].id;

    useCategoryStore.getState().updateCategory(catId, { name: 'Updated Work' });

    const updated = useCategoryStore.getState().categories.find((c) => c.id === catId);
    expect(updated?.name).toBe('Updated Work');
    expect(mockEnqueue).toHaveBeenCalledWith('categories', 'update', expect.objectContaining({
      name: 'Updated Work',
    }));
  });

  // ── deleteCategory ────────────────────────────────────────────────────

  it('deleteCategory: removes non-default category', () => {
    const mockEnqueue = jest.fn();
    (useSyncStore.getState as jest.Mock).mockReturnValue({ enqueue: mockEnqueue });
    (useTodoStore.getState as jest.Mock).mockReturnValue({ todos: [], filter: {} });

    // Add a non-default category, then delete it
    const cat = useCategoryStore.getState().addCategory({
      name: 'Temp',
      color: '#111',
      icon: null,
      order: 99,
    });

    const countBefore = useCategoryStore.getState().categories.length;
    useCategoryStore.getState().deleteCategory(cat.id);

    expect(useCategoryStore.getState().categories).toHaveLength(countBefore - 1);
    expect(useCategoryStore.getState().categories.find((c) => c.id === cat.id)).toBeUndefined();
  });

  it('deleteCategory: refuses to delete default category', () => {
    const mockEnqueue = jest.fn();
    (useSyncStore.getState as jest.Mock).mockReturnValue({ enqueue: mockEnqueue });

    useCategoryStore.getState().initializeCategories();
    const defaultCat = useCategoryStore.getState().categories[0];
    expect(defaultCat.isDefault).toBe(true);

    useCategoryStore.getState().deleteCategory(defaultCat.id);

    // Should still be present
    expect(useCategoryStore.getState().categories.find((c) => c.id === defaultCat.id)).toBeDefined();
  });

  it('deleteCategory: cleans up orphaned todo references', () => {
    const mockEnqueue = jest.fn();
    (useSyncStore.getState as jest.Mock).mockReturnValue({ enqueue: mockEnqueue });

    const cat = useCategoryStore.getState().addCategory({
      name: 'Temp2',
      color: '#222',
      icon: null,
      order: 1,
    });

    // Mock todos that reference this category
    (useTodoStore.getState as jest.Mock).mockReturnValue({
      todos: [{ id: 't1', categoryId: cat.id }],
      filter: {},
    });

    useCategoryStore.getState().deleteCategory(cat.id);

    expect(useTodoStore.setState).toHaveBeenCalled();
  });

  // ── reorderCategories ─────────────────────────────────────────────────

  it('reorderCategories: updates order field', () => {
    useCategoryStore.getState().initializeCategories();
    const cats = useCategoryStore.getState().categories;
    const reversed = [...cats].reverse().map((c) => c.id);

    useCategoryStore.getState().reorderCategories(reversed);

    const reordered = useCategoryStore.getState().categories;
    // The first category in reversed should now have order 0
    const first = reordered.find((c) => c.id === reversed[0]);
    expect(first?.order).toBe(0);
    const last = reordered.find((c) => c.id === reversed[reversed.length - 1]);
    expect(last?.order).toBe(reversed.length - 1);
  });

  // ── getCategoryById ───────────────────────────────────────────────────

  it('getCategoryById: returns correct category', () => {
    useCategoryStore.getState().initializeCategories();
    const cats = useCategoryStore.getState().categories;
    const target = cats[2]; // Health

    const result = useCategoryStore.getState().getCategoryById(target.id);
    expect(result).toEqual(target);
  });

  it('getCategoryById: returns undefined for unknown id', () => {
    useCategoryStore.getState().initializeCategories();
    const result = useCategoryStore.getState().getCategoryById('nonexistent');
    expect(result).toBeUndefined();
  });

  // ── getCategoryColor ──────────────────────────────────────────────────

  it('getCategoryColor: returns color for valid id', () => {
    useCategoryStore.getState().initializeCategories();
    const cat = useCategoryStore.getState().categories[0]; // Work

    const color = useCategoryStore.getState().getCategoryColor(cat.id);
    expect(color).toBe(cat.color);
  });

  it('getCategoryColor: returns fallback for null id', () => {
    const color = useCategoryStore.getState().getCategoryColor(null);
    expect(color).toBe(Palette.sage);
  });

  it('getCategoryColor: returns fallback for invalid id', () => {
    useCategoryStore.getState().initializeCategories();
    const color = useCategoryStore.getState().getCategoryColor('nonexistent');
    expect(color).toBe(Palette.sage);
  });

  // ── keepOnlyCategories ────────────────────────────────────────────────

  it('keepOnlyCategories: removes unselected categories', () => {
    useCategoryStore.getState().initializeCategories();
    const cats = useCategoryStore.getState().categories;
    const keep = [cats[0].id, cats[2].id]; // Work, Health

    useCategoryStore.getState().keepOnlyCategories(keep);

    const remaining = useCategoryStore.getState().categories;
    expect(remaining).toHaveLength(2);
    expect(remaining[0].name).toBe('Work');
    expect(remaining[1].name).toBe('Health');
    // order should be re-indexed
    expect(remaining[0].order).toBe(0);
    expect(remaining[1].order).toBe(1);
  });
});
