export const LIFF_INIT_STATUS = {
  NOT_INITIALIZED: 'not-initialized',
  INITIALIZING: 'initializing',
  LOGGED_OUT: 'logged-out',
  INITIALIZED: 'initialized',
  ERROR: 'error',
} as const;

export type LiffInitStatus = (typeof LIFF_INIT_STATUS)[keyof typeof LIFF_INIT_STATUS];
