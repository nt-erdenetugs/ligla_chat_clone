import { HIDE_PWA_INSTALL_PROMPT_STORAGE_KEY } from '~/common/constants';

import { PWA_PROMPT_SHOWN_SESSION_KEY } from '../constants';

export type StorageResult<T = void> = {
  success: boolean;
  data?: T;
  error?: 'quota_exceeded' | 'storage_disabled' | 'unknown';
};

const isQuotaExceededError = (error: unknown): boolean => {
  return (
    error instanceof Error &&
    (error.name === 'QuotaExceededError' ||
      error.name === 'QUOTA_EXCEEDED_ERR' ||
      error.message.includes('quota') ||
      error.message.includes('storage'))
  );
};

const getStorageErrorType = (error: unknown): StorageResult['error'] => {
  if (isQuotaExceededError(error)) {
    return 'quota_exceeded';
  }
  if (error instanceof Error && error.message.includes('disabled')) {
    return 'storage_disabled';
  }
  return 'unknown';
};

export const setHidePromptPreference = (hide: boolean): StorageResult => {
  try {
    localStorage.setItem(HIDE_PWA_INSTALL_PROMPT_STORAGE_KEY, hide.toString());
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: getStorageErrorType(error),
    };
  }
};

export const getHidePromptPreference = (): StorageResult<boolean> => {
  try {
    const value = localStorage.getItem(HIDE_PWA_INSTALL_PROMPT_STORAGE_KEY) === 'true';
    return { success: true, data: value };
  } catch (error) {
    return {
      success: false,
      data: false, // Default to showing prompt if we can't read preference
      error: getStorageErrorType(error),
    };
  }
};

export const setPromptShownInSession = (): StorageResult => {
  try {
    sessionStorage.setItem(PWA_PROMPT_SHOWN_SESSION_KEY, 'true');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: getStorageErrorType(error),
    };
  }
};

export const wasPromptShownInSession = (): StorageResult<boolean> => {
  try {
    const value = sessionStorage.getItem(PWA_PROMPT_SHOWN_SESSION_KEY) === 'true';
    return { success: true, data: value };
  } catch (error) {
    return {
      success: false,
      data: false, // Default to not shown if we can't read session state
      error: getStorageErrorType(error),
    };
  }
};

export const clearSessionPromptState = (): StorageResult => {
  try {
    sessionStorage.removeItem(PWA_PROMPT_SHOWN_SESSION_KEY);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: getStorageErrorType(error),
    };
  }
};
