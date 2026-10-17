import {
  validateTodoTitle,
  validateCategoryName,
  validateCategoryColor,
  validatePomodoroDuration,
  validateEmail,
  validatePassword,
  validateDisplayName,
} from '@/utils/validators';

describe('validateTodoTitle', () => {
  it('returns null for a valid title', () => {
    expect(validateTodoTitle('Buy groceries')).toBeNull();
  });

  it('returns error for empty string', () => {
    expect(validateTodoTitle('')).toBe('errors.titleRequired');
  });

  it('returns error for whitespace-only string', () => {
    expect(validateTodoTitle('   ')).toBe('errors.titleRequired');
  });

  it('returns error when title exceeds 500 characters', () => {
    const longTitle = 'a'.repeat(501);
    expect(validateTodoTitle(longTitle)).toBe('errors.titleTooLong');
  });

  it('returns null for exactly 500 characters', () => {
    expect(validateTodoTitle('a'.repeat(500))).toBeNull();
  });
});

describe('validateCategoryName', () => {
  it('returns null for a valid name', () => {
    expect(validateCategoryName('Work')).toBeNull();
  });

  it('returns error for empty string', () => {
    expect(validateCategoryName('')).toBe('errors.nameRequired');
  });

  it('returns error when name exceeds 100 characters', () => {
    expect(validateCategoryName('x'.repeat(101))).toBe('errors.nameTooLong');
  });

  it('returns null for exactly 100 characters', () => {
    expect(validateCategoryName('x'.repeat(100))).toBeNull();
  });
});

describe('validateCategoryColor', () => {
  it('returns null for a valid 6-digit hex color', () => {
    expect(validateCategoryColor('#FF5733')).toBeNull();
  });

  it('returns null for lowercase hex digits', () => {
    expect(validateCategoryColor('#abcdef')).toBeNull();
  });

  it('returns error for empty string', () => {
    expect(validateCategoryColor('')).toBe('errors.colorRequired');
  });

  it('returns error for 3-digit hex shorthand', () => {
    expect(validateCategoryColor('#F00')).toBe('errors.colorInvalid');
  });

  it('returns error for hex without leading hash', () => {
    expect(validateCategoryColor('FF5733')).toBe('errors.colorInvalid');
  });

  it('returns error for non-hex characters', () => {
    expect(validateCategoryColor('#GGGGGG')).toBe('errors.colorInvalid');
  });
});

describe('validatePomodoroDuration', () => {
  it('returns null for a typical duration (1500s = 25min)', () => {
    expect(validatePomodoroDuration(1500)).toBeNull();
  });

  it('returns error for zero', () => {
    expect(validatePomodoroDuration(0)).toBe('errors.durationPositive');
  });

  it('returns error for negative value', () => {
    expect(validatePomodoroDuration(-10)).toBe('errors.durationPositive');
  });

  it('returns error when exceeding 7200s (2 hours)', () => {
    expect(validatePomodoroDuration(7201)).toBe('errors.durationTooLong');
  });

  it('returns null for exactly 7200s', () => {
    expect(validatePomodoroDuration(7200)).toBeNull();
  });
});

describe('validateEmail', () => {
  it('returns null for a valid email', () => {
    expect(validateEmail('user@example.com')).toBeNull();
  });

  it('returns error for empty string', () => {
    expect(validateEmail('')).toBe('errors.emailRequired');
  });

  it('returns error for missing @ sign', () => {
    expect(validateEmail('userexample.com')).toBe('errors.emailInvalid');
  });

  it('returns error for missing domain', () => {
    expect(validateEmail('user@')).toBe('errors.emailInvalid');
  });
});

describe('validatePassword', () => {
  it('returns null for a valid password (6+ chars)', () => {
    expect(validatePassword('secret')).toBeNull();
  });

  it('returns error for empty string', () => {
    expect(validatePassword('')).toBe('errors.passwordRequired');
  });

  it('returns error for password shorter than 6 characters', () => {
    expect(validatePassword('abc')).toBe('errors.passwordTooShort');
  });

  it('returns null for exactly 6 characters', () => {
    expect(validatePassword('123456')).toBeNull();
  });
});

describe('validateDisplayName', () => {
  it('returns null for a valid display name', () => {
    expect(validateDisplayName('Eren')).toBeNull();
  });

  it('returns error for empty string', () => {
    expect(validateDisplayName('')).toBe('errors.nameRequired');
  });

  it('returns error for whitespace-only string', () => {
    expect(validateDisplayName('   ')).toBe('errors.nameRequired');
  });

  it('returns error when name exceeds 50 characters', () => {
    expect(validateDisplayName('a'.repeat(51))).toBe('errors.nameTooLong');
  });

  it('returns null for exactly 50 characters', () => {
    expect(validateDisplayName('a'.repeat(50))).toBeNull();
  });
});

describe('validator messages', () => {
  it('are i18n keys that exist in both locales', () => {
    const en = require('@/locales/en.json') as Record<string, string>;
    const tr = require('@/locales/tr.json') as Record<string, string>;
    const errors = [
      validateTodoTitle(''), validateTodoTitle('a'.repeat(501)),
      validateCategoryName(''), validateCategoryName('a'.repeat(101)),
      validateCategoryColor(''), validateCategoryColor('red'),
      validatePomodoroDuration(0), validatePomodoroDuration(7201),
      validateEmail(''), validateEmail('nope'),
      validatePassword(''), validatePassword('123'),
      validateDisplayName(''), validateDisplayName('a'.repeat(51)),
    ];
    for (const key of errors) {
      expect(key).toMatch(/^errors\./);
      expect(en[key!]).toBeDefined();
      expect(tr[key!]).toBeDefined();
    }
  });
});
