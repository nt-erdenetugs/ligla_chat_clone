import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import chat_en from './en/chat.json';
import common_en from './en/common.json';
import error_en from './en/errors.json';
import management_en from './en/management.json';
import toast_en from './en/toasts.json';
import chat_ja from './ja/chat.json';
import common_ja from './ja/common.json';
import error_ja from './ja/errors.json';
import management_ja from './ja/management.json';
import toast_ja from './ja/toasts.json';

export const LOCALE_JA = 'ja';
export const LOCALE_EN = 'en';

const resources = {
  [LOCALE_JA]: {
    chat: chat_ja,
    common: common_ja,
    management: management_ja,
    errors: error_ja,
    toasts: toast_ja,
  },
  [LOCALE_EN]: {
    chat: chat_en,
    common: common_en,
    management: management_en,
    errors: error_en,
    toasts: toast_en,
  },
};

export const languages = [
  { key: LOCALE_JA, label: '日本語' },
  { key: LOCALE_EN, label: 'English' },
] as const;

i18n
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    resources,
    fallbackLng: LOCALE_EN,
    returnEmptyString: false,
    nsSeparator: '::',
    debug: false,
    detection: {
      order: ['localStorage', 'navigator'],
    },
    interpolation: {
      escapeValue: false,
    },
  });
