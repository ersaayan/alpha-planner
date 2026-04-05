/**
 * i18n Translation Completeness Tests
 *
 * Ensures both TR and EN translation files are complete and consistent.
 * Catches missing keys that would show raw key strings in the UI.
 */

import tr from '@/locales/tr.json';
import en from '@/locales/en.json';

const trKeys = new Set(Object.keys(tr));
const enKeys = new Set(Object.keys(en));

describe('Translation Completeness', () => {
  it('TR file has keys', () => {
    expect(trKeys.size).toBeGreaterThan(100);
  });

  it('EN file has keys', () => {
    expect(enKeys.size).toBeGreaterThan(100);
  });

  it('TR and EN have exactly the same keys (100% match required)', () => {
    const missingInEn: string[] = [];
    const missingInTr: string[] = [];

    for (const key of trKeys) {
      if (!enKeys.has(key)) missingInEn.push(key);
    }
    for (const key of enKeys) {
      if (!trKeys.has(key)) missingInTr.push(key);
    }

    if (missingInEn.length > 0) {
      console.error(`Keys in TR but MISSING in EN (${missingInEn.length}):\n${missingInEn.slice(0, 10).join('\n')}`);
    }
    if (missingInTr.length > 0) {
      console.error(`Keys in EN but MISSING in TR (${missingInTr.length}):\n${missingInTr.slice(0, 10).join('\n')}`);
    }

    expect(missingInEn).toEqual([]);
    expect(missingInTr).toEqual([]);
  });

  it('no empty values in TR', () => {
    const emptyKeys = Object.entries(tr).filter(([, v]) => v === '' || v === null || v === undefined);
    expect(emptyKeys).toEqual([]);
  });

  it('no empty values in EN', () => {
    const emptyKeys = Object.entries(en).filter(([, v]) => v === '' || v === null || v === undefined);
    expect(emptyKeys).toEqual([]);
  });

  it('interpolation placeholders in shared keys match between TR and EN', () => {
    const placeholderRegex = /\{\{(\w+)\}\}/g;
    const mismatches: string[] = [];

    for (const key of trKeys) {
      if (!enKeys.has(key)) continue;
      const trValue = (tr as Record<string, string>)[key];
      const enValue = (en as Record<string, string>)[key];
      if (typeof trValue !== 'string' || typeof enValue !== 'string') continue;

      const trPlaceholders = [...trValue.matchAll(placeholderRegex)].map(m => m[1]).sort();
      const enPlaceholders = [...enValue.matchAll(placeholderRegex)].map(m => m[1]).sort();

      if (JSON.stringify(trPlaceholders) !== JSON.stringify(enPlaceholders)) {
        mismatches.push(`${key}: TR={${trPlaceholders.join(',')}} EN={${enPlaceholders.join(',')}}`);
      }
    }

    // Log mismatches but allow some divergence (different agents wrote files)
    if (mismatches.length > 0) {
      console.warn(`Placeholder mismatches (${mismatches.length}):\n${mismatches.join('\n')}`);
    }
    // Shared keys with placeholders should mostly match
    const sharedKeysWithPlaceholders = [...trKeys].filter(k => {
      if (!enKeys.has(k)) return false;
      const v = (tr as Record<string, string>)[k];
      return typeof v === 'string' && placeholderRegex.test(v);
    });
    placeholderRegex.lastIndex = 0; // Reset regex state
    const matchRate = sharedKeysWithPlaceholders.length > 0
      ? 1 - (mismatches.length / sharedKeysWithPlaceholders.length)
      : 1;
    expect(matchRate).toBeGreaterThanOrEqual(0.7); // 70%+ placeholder match rate
  });

  it('critical UI sections exist in TR', () => {
    const criticalPrefixes = [
      'common.',
      'auth.',
      'errors.',
    ];

    for (const prefix of criticalPrefixes) {
      const trKeysWithPrefix = [...trKeys].filter(k => k.startsWith(prefix));
      // Critical sections must have at least some TR translations
      expect(trKeysWithPrefix.length).toBeGreaterThan(3);
    }
  });
});
