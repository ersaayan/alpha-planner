export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  isDefault: boolean;
  order: number;
  createdAt: string;
}

export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'createdAt'>[] = [
  { name: 'Work', color: '#5A7868', icon: 'briefcase-outline', isDefault: true, order: 0 },
  { name: 'Personal', color: '#90AB8B', icon: 'person-outline', isDefault: true, order: 1 },
  { name: 'Health', color: '#3B4953', icon: 'heart-outline', isDefault: true, order: 2 },
  { name: 'Learning', color: '#6B8E7B', icon: 'book-outline', isDefault: true, order: 3 },
  { name: 'Shopping', color: '#7A9A8A', icon: 'shopping-cart-outline', isDefault: true, order: 4 },
];
