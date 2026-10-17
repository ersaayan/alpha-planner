import type { Category } from '@/types';
import { DEFAULT_CATEGORIES } from '@/types';
import { DEFAULT_CATEGORY_IDS } from '@/constants/defaults';
import { Palette } from '@/constants/theme';
import { generateId } from '@/utils/uuid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { asRecord, asRecordArray, createPersistOptions } from './persist';
import { useSyncStore } from './sync-store';
import { useTodoStore } from './todo-store';

interface CategoryState {
  categories: Category[];
  isInitialized: boolean;

  // Actions
  initializeCategories: () => void;
  addCategory: (category: Omit<Category, 'id' | 'createdAt' | 'isDefault'>) => Category;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (categoryIds: string[]) => void;
  /** Keeps only the specified categories and permanently deletes the rest. Use during onboarding only. */
  keepOnlyCategories: (categoryIds: string[]) => void;

  // Utility
  getCategoryById: (id: string) => Category | undefined;
  getCategoryColor: (id: string | null) => string;
}

export const useCategoryStore = create<CategoryState>()(
  persist(
    (set, get) => ({
      categories: [],
      isInitialized: false,

      initializeCategories: () => {
        if (get().isInitialized) return;

        const stableIds = Object.values(DEFAULT_CATEGORY_IDS);
        const now = new Date().toISOString();
        const defaultCategories: Category[] = DEFAULT_CATEGORIES.map((cat, index) => ({
          ...cat,
          id: stableIds[index] ?? generateId(),
          createdAt: now,
        }));

        set({
          categories: defaultCategories,
          isInitialized: true,
        });
      },

      addCategory: (categoryData) => {
        const now = new Date().toISOString();
        const newCategory: Category = {
          ...categoryData,
          id: generateId(),
          isDefault: false,
          createdAt: now,
        };

        set((state) => ({
          categories: [...state.categories, newCategory],
        }));
        // "Create 5 categories" / "5 colors" achievements. Lazy: gamification reads this store.
        try {
          const { useGamificationStore } = require('./gamification-store') as typeof import('./gamification-store');
          useGamificationStore.getState().checkAchievements();
        } catch {
          // Achievements are a nicety.
        }

        useSyncStore.getState().enqueue('categories', 'insert', {
          id: newCategory.id,
          name: newCategory.name,
          color: newCategory.color,
          icon: newCategory.icon ?? null,
          is_default: newCategory.isDefault,
          order: newCategory.order,
          created_at: newCategory.createdAt,
          updated_at: newCategory.createdAt,
        });

        return newCategory;
      },

      updateCategory: (id, updates) => {
        set((state) => ({
          categories: state.categories.map((category) =>
            category.id === id ? { ...category, ...updates } : category
          ),
        }));

        const updated = get().categories.find((c) => c.id === id);
        if (updated) {
          useSyncStore.getState().enqueue('categories', 'update', {
            id: updated.id,
            name: updated.name,
            color: updated.color,
            icon: updated.icon ?? null,
            order: updated.order,
            updated_at: new Date().toISOString(),
          });
        }
      },

      deleteCategory: (id) => {
        const category = get().categories.find((c) => c.id === id);
        // Don't delete default categories
        if (category?.isDefault) return;

        // Soft delete sync
        useSyncStore.getState().enqueue('categories', 'update', {
          id,
          deleted_at: new Date().toISOString(),
        });

        set((state) => ({
          categories: state.categories.filter((c) => c.id !== id),
        }));

        // Clean up orphaned categoryId references on todos in a single batch
        const todoStore = useTodoStore.getState();
        const affectedTodos = todoStore.todos.filter((todo) => todo.categoryId === id);
        if (affectedTodos.length > 0) {
          useTodoStore.setState((state) => ({
            todos: state.todos.map((todo) =>
              todo.categoryId === id ? { ...todo, categoryId: null, updatedAt: new Date().toISOString() } : todo
            ),
          }));
        }

        // Clear todo filter if filtering by deleted category
        const todoState = useTodoStore.getState();
        if (todoState.filter?.categoryId === id) {
          useTodoStore.setState({
            filter: { ...todoState.filter, categoryId: undefined },
          });
        }
      },

      reorderCategories: (categoryIds) => {
        set((state) => ({
          categories: state.categories.map((category) => {
            const newOrder = categoryIds.indexOf(category.id);
            return newOrder !== -1 ? { ...category, order: newOrder } : category;
          }),
        }));
      },

      /** Keeps only the specified categories and permanently deletes the rest. Use during onboarding only. */
      keepOnlyCategories: (categoryIds) => {
        const selected = new Set(categoryIds);
        set((state) => ({
          categories: state.categories
            .filter((category) => selected.has(category.id))
            .map((category, index) => ({ ...category, order: index })),
        }));
      },

      getCategoryById: (id) => {
        return get().categories.find((category) => category.id === id);
      },

      getCategoryColor: (id) => {
        if (!id) return Palette.sage;
        const category = get().categories.find((c) => c.id === id);
        return category?.color ?? Palette.sage;
      },
    }),
    createPersistOptions<CategoryState, Pick<CategoryState, 'categories' | 'isInitialized'>>({
      name: 'category-storage',
      version: 1,
      partialize: (state) => ({ categories: state.categories, isInitialized: state.isInitialized }),
      migrate: migrateCategoryState,
    })
  )
);

export function migrateCategoryState(persisted: unknown, _fromVersion: number) {
  const state = asRecord(persisted);
  const categories = asRecordArray(state.categories).filter(
    (category) => typeof category.id === 'string' && category.id.length > 0
  ) as unknown as Category[];
  return {
    categories,
    // Stored categories mean the defaults were already created once; never re-create them on top.
    isInitialized: state.isInitialized === true || categories.length > 0,
  };
}
