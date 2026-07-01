import { useEffect, useRef, useReducer, useCallback } from 'react';

import { useSnackbar } from 'notistack';

import { useResponsive } from '~/common/hooks';
import { useTranslation } from '~/locales/hooks';

import { PLATFORM_PATTERNS, PWA_DISPLAY_MODES } from '../constants';
import {
  type BeforeInstallPromptEvent,
  type NavigatorStandalone,
  type PWAState,
  type PWAAction,
} from '../types';
import {
  setHidePromptPreference,
  getHidePromptPreference,
  setPromptShownInSession,
  wasPromptShownInSession,
  type StorageResult,
} from '../utils/storage';

const initialState: PWAState = {
  open: false,
  isIOS: false,
  unsupported: false,
  dontShowAgain: false,
  loading: false,
};

const pwaReducer = (state: PWAState, action: PWAAction): PWAState => {
  switch (action.type) {
    case 'SET_PLATFORM':
      return { ...state, ...action.payload };
    case 'SHOW_PROMPT':
      return { ...state, open: true };
    case 'HIDE_PROMPT':
      return { ...state, open: false, loading: false };
    case 'SET_DONT_SHOW':
      return { ...state, dontShowAgain: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
};

export const usePWAInstallation = () => {
  const [state, dispatch] = useReducer(pwaReducer, initialState);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const isInitialLoad = useRef(true);
  const { isMobileOrTablet } = useResponsive();
  const { t_toasts } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const handleStorageError = useCallback(
    (error: StorageResult['error']) => {
      if (!error) return;

      let message = '';
      switch (error) {
        case 'quota_exceeded':
          message = t_toasts('pwa.storage.quotaExceeded');
          break;
        case 'storage_disabled':
          message = t_toasts('pwa.storage.disabled');
          break;
        default:
          message = t_toasts('pwa.storage.error');
      }

      enqueueSnackbar(message, { variant: 'warning' });
    },
    [t_toasts, enqueueSnackbar],
  );

  // Get preferences with error handling
  const hidePromptResult = getHidePromptPreference();
  const sessionPromptResult = wasPromptShownInSession();

  // Handle storage errors for reading preferences
  useEffect(() => {
    if (!hidePromptResult.success) {
      handleStorageError(hidePromptResult.error);
    }
    if (!sessionPromptResult.success) {
      handleStorageError(sessionPromptResult.error);
    }
  }, [
    hidePromptResult.success,
    sessionPromptResult.success,
    handleStorageError,
    hidePromptResult.error,
    sessionPromptResult.error,
  ]);

  const shouldShowPrompt = isMobileOrTablet && !hidePromptResult.data && !sessionPromptResult.data;

  const showPromptIfNeeded = useCallback(() => {
    if (!shouldShowPrompt || !isInitialLoad.current) return;

    dispatch({ type: 'SHOW_PROMPT' });

    const sessionResult = setPromptShownInSession();
    if (!sessionResult.success) {
      handleStorageError(sessionResult.error);
    }

    isInitialLoad.current = false;
  }, [shouldShowPrompt, handleStorageError]);

  useEffect(() => {
    if (!shouldShowPrompt) return;

    const ua = navigator.userAgent.toLowerCase();
    const isIOS = PLATFORM_PATTERNS.IOS.test(ua);

    const installed =
      window.matchMedia?.(PWA_DISPLAY_MODES.STANDALONE).matches ||
      (isIOS && (navigator as NavigatorStandalone).standalone === true);

    if (installed) return;

    const unsupported = !isIOS && !('onbeforeinstallprompt' in window);

    dispatch({
      type: 'SET_PLATFORM',
      payload: { isIOS, unsupported },
    });

    if (isIOS || unsupported) {
      showPromptIfNeeded();
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      showPromptIfNeeded();
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      deferredPrompt.current = null;
    };
  }, [shouldShowPrompt, showPromptIfNeeded]);

  const handleInstall = async (): Promise<void> => {
    if (!deferredPrompt.current) return;

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      await deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;

      enqueueSnackbar(
        t_toasts(outcome === 'accepted' ? 'pwa.installationSuccess' : 'pwa.installationDismissed'),
        { variant: outcome === 'accepted' ? 'success' : 'info' },
      );

      // Track installation attempt
      if (typeof window !== 'undefined' && (window as any).analytics) {
        (window as any).analytics.track('pwa_install_attempted', {
          platform: state.isIOS ? 'ios' : 'android',
          source: 'install_drawer',
          outcome,
        });
      }
    } catch (error) {
      console.error('PWA installation error:', error);
      enqueueSnackbar(t_toasts('pwa.installationError'), { variant: 'error' });
    } finally {
      if (state.dontShowAgain) {
        const hideResult = setHidePromptPreference(true);
        if (!hideResult.success) {
          handleStorageError(hideResult.error);
        }
      }
      deferredPrompt.current = null;
      dispatch({ type: 'HIDE_PROMPT' });
    }
  };

  const handleClose = (): void => {
    if (state.dontShowAgain) {
      const hideResult = setHidePromptPreference(true);
      if (!hideResult.success) {
        handleStorageError(hideResult.error);
      }
    }
    dispatch({ type: 'HIDE_PROMPT' });
  };

  const setDontShowAgain = (value: boolean): void => {
    dispatch({ type: 'SET_DONT_SHOW', payload: value });
  };

  const forceShowPrompt = useCallback(() => {
    const hideResult = getHidePromptPreference();
    if (!hideResult.success) {
      handleStorageError(hideResult.error);
    }

    if (!hideResult.data) {
      dispatch({ type: 'SHOW_PROMPT' });
      const sessionResult = setPromptShownInSession();
      if (!sessionResult.success) {
        handleStorageError(sessionResult.error);
      }
    }
  }, [handleStorageError]);

  return {
    ...state,
    handleInstall,
    handleClose,
    setDontShowAgain,
    forceShowPrompt,
    canInstall: !!deferredPrompt.current,
  };
};
