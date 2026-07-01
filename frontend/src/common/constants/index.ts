export * from './chat';
export * from './roles';
export * from './routes';
export * from './searchParams';

export const API_PREFIXES = {
  GRAPHQL: 'api',
  HTTP: 'srv',
};

export const ACCESS_TOKEN_COOKIE = 'accessToken';
export const HYPERVISOR_ACCESS_TOKEN_COOKIE = 'hypervisorAccessToken';

export const ORGANIZATION_MAX_OPERATOR = 1000000;
export const ORGANIZATION_DEFAULT_MAX_OPERATOR = 10;

export const SHOW_USERS_LIMIT = 5;
export const SHOW_STORES_LIMIT = 2;
export const SHOW_TEAMS_LIMIT = 2;
export const SHOW_ADMINISTRATORS_EMAIL_LIMIT = 5;
export const TAG_NAME_MAX_LENGTH = 20;
export const LIST_FILTER_MAX_LENGTH = 5;

export enum UserStatusType {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
  LOCKED = 'LOCKED',
}

export const USER_DEFAULT_PICTURE_URL = `${import.meta.env.VITE_BACKEND_URL}/media/shared/images/default-avatar.png`;

export const DISPLAY_NAME_MAX_CHAR_LIMIT = 20;

export const FILE_SIZE = {
  MB: 1048576,
} as const;

export enum ListFilterCondition {
  EQUALS = 'equals',
  NOT_EQUALS = 'not equals',
  CONTAINS = 'contains',
  DOES_NOT_CONTAIN = 'does not contain',
  STARTS_WITH = 'starts with',
  ENDS_WITH = 'ends with',
  IS_BLANK = 'is blank',
  IS_PRESENT = 'is present',
}

export const LIST_FILTER_CONDITIONS: ListFilterCondition[] = [
  ListFilterCondition.EQUALS,
  ListFilterCondition.NOT_EQUALS,
  ListFilterCondition.CONTAINS,
  ListFilterCondition.DOES_NOT_CONTAIN,
  ListFilterCondition.STARTS_WITH,
  ListFilterCondition.ENDS_WITH,
  ListFilterCondition.IS_BLANK,
  ListFilterCondition.IS_PRESENT,
];

export const NOTIFICATION_DISABLED_KEY = 'notification-disabled';

export const HIDE_PWA_INSTALL_PROMPT_STORAGE_KEY = 'pwa-install-hidden';
