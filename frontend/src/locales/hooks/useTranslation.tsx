import { useCallback, useEffect } from 'react';

import dayjs from 'dayjs';
import 'dayjs/locale/ja';
import 'dayjs/locale/en';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslation as i18nextUseTranslation } from 'react-i18next';

import { BASE_NS } from '../constants';

dayjs.extend(relativeTime);

const getDayjsLocale = (i18nLanguage: string) => {
  switch (i18nLanguage) {
    case 'ja':
      return 'ja';
    default:
      return 'en';
  }
};

export const useTranslation = () => {
  const [COMMON, ERRORS, TOASTS, CHAT, MANAGEMENT] = BASE_NS;
  const namespaces = [COMMON];

  const { t, i18n } = i18nextUseTranslation(namespaces);

  useEffect(() => {
    dayjs.locale(getDayjsLocale(i18n.language));

    const handleLangChange = (lng: string) => {
      dayjs.locale(getDayjsLocale(lng));
    };

    i18n.on('languageChanged', handleLangChange);

    return () => {
      i18n.off('languageChanged', handleLangChange);
    };
  }, [i18n]);

  const t_errors = useCallback(
    (key: string, config?: object) => {
      return t(key, { ns: ERRORS, ...config });
    },
    [ERRORS, t],
  );

  const t_toasts = useCallback(
    (key: string, config?: object) => {
      return t(key, { ns: TOASTS, ...config });
    },
    [TOASTS, t],
  );

  const t_chat = useCallback(
    (key: string, config?: object) => {
      return t(key, { ns: CHAT, ...config });
    },
    [CHAT, t],
  );

  const t_management = useCallback(
    (key: string, config?: object) => {
      return t(key, { ns: MANAGEMENT, ...config });
    },
    [MANAGEMENT, t],
  );

  return { t, t_errors, t_toasts, t_chat, t_management, i18n };
};
