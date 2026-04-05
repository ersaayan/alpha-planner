export function validateTodoTitle(title: string): string | null {
  if (!title || title.trim().length === 0) return 'Title is required';
  if (title.trim().length > 500) return 'Title is too long';
  return null;
}

export function validateCategoryName(name: string): string | null {
  if (!name || name.trim().length === 0) return 'Name is required';
  if (name.trim().length > 100) return 'Name is too long';
  return null;
}

export function validateCategoryColor(color: string): string | null {
  if (!color) return 'Color is required';
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return 'Invalid hex color';
  return null;
}

export function validatePomodoroDuration(seconds: number): string | null {
  if (seconds <= 0) return 'Duration must be positive';
  if (seconds > 7200) return 'Duration cannot exceed 2 hours';
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters';
  return null;
}

export function validateDisplayName(name: string): string | null {
  if (!name || name.trim().length === 0) return 'Name is required';
  if (name.trim().length > 50) return 'Name is too long';
  return null;
}
