export const THROTTLE_LIMIT = 500; // 500 requests per minute
export const THROTTLE_TTL = 60 * 1000; // 1 minute in milliseconds

export const MAX_UPLOAD_ATTEMPTS_PER_TTL = 5; // Maximum profile upload attempts per minute
export const MAX_DOWNLOAD_ATTEMPTS_PER_TTL = 5; // Maximum download attempts per minute

export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  useExponentialBackoff: boolean;
  maxDelayMs: number;
  shouldRetry?: (error: Error) => boolean;
}

export const MAX_OPERATOR_INPUT_LIMIT = 1000000;

export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_INITIAL_DELAY_MS = 1000;
export const DEFAULT_USE_EXPONENTIAL_BACKOFF = true;
export const DEFAULT_MAX_DELAY_MS = 30000;
export const JITTER_MIN = 0.85;
export const JITTER_MAX = 1.15;

export const RESET_PASSWORD = 'reset-password';
export const INITIAL_LOGIN = 'initial-login';
export const MAX_LOGIN_ATTEMPTS = 5;

export const ONE_HOUR = 60 * 60 * 1000;
export const ONE_MINUTE = 60 * 1000;

export const MAX_SELECT_OPTION_STRING_LENGTH = 25;
export const MAX_SELECT_OPTION_LENGTH = 50;

export const API_PREFIXES = {
  GRAPHQL: 'api',
  HTTP: 'srv',
};

const ACCEPTED_DOCUMENT_MIME_TYPES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.presentation',

  'application/pdf',

  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet',

  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',

  'text/csv',
  'text/plain',
  'text/md',
];

const ACCEPTED_IMAGE_MIME_TYPES = ['image/*'];

const ACCEPTED_VIDEO_MIME_TYPES = ['video/*'];

const ACCEPTED_AUDIO_MIME_TYPES = [
  'audio/*',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/flac',
  'audio/midi',
  'audio/x-midi',
  'audio/amr',
  'audio/basic',
  'audio/aiff',
  'audio/x-aiff',
  'audio/x-matroska',
  'audio/opus',
  'audio/3gpp',
  'audio/3gpp2',
  'audio/x-ms-wma',
  'audio/x-pn-realaudio',
  'audio/vnd.rn-realaudio',
  'audio/ac3',
  'audio/eac3',
  'audio/mp3',
  'audio/x-mpeg',
  'audio/x-mp3',
  'audio/x-mpeg3',
  'audio/x-mpg',
  'audio/x-m4a',
  'audio/vnd.dlna.adts',
  'audio/x-wav',
  'audio/x-wave',
  'audio/vnd.wave',
  'audio/vnd.adobe.soundbooth',
];

const ACCEPTED_ARCHIVE_MIME_TYPES = ['application/zip', 'application/x-zip-compressed'];

export const CHAT_FILE_ACCEPTED_MIME_TYPES = [
  ...ACCEPTED_DOCUMENT_MIME_TYPES,
  ...ACCEPTED_IMAGE_MIME_TYPES,
  ...ACCEPTED_VIDEO_MIME_TYPES,
  ...ACCEPTED_AUDIO_MIME_TYPES,
  ...ACCEPTED_ARCHIVE_MIME_TYPES,
];

export const FILTER_ALLOWED_CONDITIONS = new Set([
  'contains',
  'does not contain',
  'equals',
  'not equals',
  'starts with',
  'ends with',
  'is blank',
  'is present',
  'gte',
  'lte',
]);

export const FILTER_EXTRA_ALLOWED_FIELDS = new Set([
  'status',
  'isActive',
  'isEncryptionEnabled',
  'type',
  'liglaStoreId',
  'createdAt',
  'maxOperator',
  'operatorCount',
  'roleType',
]);

export enum OrganizationSettingsType {
  SURVEY = 'survey',
  MEMBER_FEED = 'memberFeed',
  CHAT_REPLY = 'chatReply',
}
