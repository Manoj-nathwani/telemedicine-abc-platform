import i18n, { i18n as I18NextInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import all translation files directly
import en from './locales/en';
import fr from './locales/fr';

// Create translation resources object with proper namespace structure
const resources: Record<string, any> = {
  en: {
    translation: en
  },
  fr: {
    translation: fr
  }
};

const createI18nInstance = (): I18NextInstance => {
  const instance = i18n.createInstance();

  instance
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      fallbackLng: 'fr',
      debug: false,

      // Language detection configuration
      detection: {
        order: ['localStorage', 'navigator', 'htmlTag'],
        lookupLocalStorage: 'i18nextLng',
        caches: ['localStorage']
      },

      // Resources configuration
      resources,
      defaultNS: 'translation',
      ns: ['translation'],

      interpolation: {
        escapeValue: false,
      },

      // Language support
      supportedLngs: ['en', 'fr'],
      cleanCode: true
    });

  return instance;
};

// Single unified i18n instance
export const i18nInstance = createI18nInstance(); 