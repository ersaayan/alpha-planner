import type { Category } from '@/types';
import { DEFAULT_CATEGORIES } from '@/types';
import { DEFAULT_CATEGORY_IDS } from '@/constants/defaults';
import { generateId } from '@/utils/uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
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

        return newCategory;
      },

      updateCategory: (id, updates) => {
        set((state) => ({
          categories: state.categories.map((category) =>
            category.id === id ? { ...category, ...updates } : category
          ),
        }));
      },

      deleteCategory: (id) => {
        const category = get().categories.find((c) => c.id === id);
        // Don't delete default categories
        if (category?.isDefault) return;

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
        if (!id) return '#90AB8B'; // Default sage color
        const category = get().categories.find((c) => c.id === id);
        return category?.color ?? '#90AB8B';
      },
    }),
    {
      name: 'category-storage',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persistedState: unknown, version: number) => {
        return persistedState as CategoryState;
      },
    }
  )
);
