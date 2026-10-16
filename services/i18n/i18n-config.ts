import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import tr from '@/locales/tr.json';
import en from '@/locales/en.json';

export type LanguageSetting = 'tr' | 'en' | 'system';

/** The device language if we support it, English otherwise. */
export function getSystemLanguage(): 'tr' | 'en' {
  return getLocales()[0]?.languageCode === 'tr' ? 'tr' : 'en';
}

export function resolveLanguage(setting: LanguageSetting | undefined): 'tr' | 'en' {
  return setting === 'tr' || setting === 'en' ? setting : getSystemLanguage();
}

// Starts in the device language; the saved setting is applied once the settings
// store has hydrated (see hooks/use-app-bootstrap.ts).
i18n
  .use(initReactI18next)
  .init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
    },
    lng: getSystemLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: 'v4',
  });

export default i18n;

/**
 * Change the app language. Call from settings, and with the saved setting at startup.
 */
export function changeLanguage(lang: LanguageSetting): void {
  const resolved = resolveLanguage(lang);
  if (i18n.language !== resolved) {
    void i18n.changeLanguage(resolved);
  }
}
