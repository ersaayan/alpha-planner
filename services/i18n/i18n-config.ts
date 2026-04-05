import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import tr from '@/locales/tr.json';
import en from '@/locales/en.json';

const deviceLocale = getLocales()[0]?.languageCode ?? 'en';
const defaultLng = deviceLocale === 'tr' ? 'tr' : 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
    },
    lng: defaultLng,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: 'v4',
  });

export default i18n;

/**
 * Change the app language. Call from settings.
 */
export function changeLanguage(lang: 'tr' | 'en' | 'system'): void {
  if (lang === 'system') {
    const systemLocale = getLocales()[0]?.languageCode ?? 'en';
    i18n.changeLanguage(systemLocale === 'tr' ? 'tr' : 'en');
  } else {
    i18n.changeLanguage(lang);
  }
}
