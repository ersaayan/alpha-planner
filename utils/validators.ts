/**
 * Form validators. Each returns null when the value is valid, otherwise the i18n key
 * of the message to show (`t(error)`), so no English text leaks into the UI.
 */

export function validateTodoTitle(title: string): string | null {
  if (!title || title.trim().length === 0) return 'errors.titleRequired';
  if (title.trim().length > 500) return 'errors.titleTooLong';
  return null;
}

export function validateCategoryName(name: string): string | null {
  if (!name || name.trim().length === 0) return 'errors.nameRequired';
  if (name.trim().length > 100) return 'errors.nameTooLong';
  return null;
}

export function validateCategoryColor(color: string): string | null {
  if (!color) return 'errors.colorRequired';
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return 'errors.colorInvalid';
  return null;
}

export function validatePomodoroDuration(seconds: number): string | null {
  if (seconds <= 0) return 'errors.durationPositive';
  if (seconds > 7200) return 'errors.durationTooLong';
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email) return 'errors.emailRequired';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'errors.emailInvalid';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'errors.passwordRequired';
  if (password.length < 6) return 'errors.passwordTooShort';
  return null;
}

export function validateDisplayName(name: string): string | null {
  if (!name || name.trim().length === 0) return 'errors.nameRequired';
  if (name.trim().length > 50) return 'errors.nameTooLong';
  return null;
}
