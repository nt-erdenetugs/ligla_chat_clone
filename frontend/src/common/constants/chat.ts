import { ChatStatus } from '~/generated/graphql/types';

export const AllChatStatus = [ChatStatus.Pending, ChatStatus.Addressing, ChatStatus.Done];
export const AddressingDoneStatuses = [ChatStatus.Addressing, ChatStatus.Done];

const CHAT_STATUS_LABELS: Record<ChatStatus, string> = {
  [ChatStatus.Pending]: 'pending',
  [ChatStatus.Addressing]: 'addressing',
  [ChatStatus.Done]: 'done',
};

export const getChatStatusLabel = (status: ChatStatus): string => {
  return CHAT_STATUS_LABELS[status];
};

export const CHAT_FILTER_STORAGE_KEY = 'chatFilters';
export const CHAT_LIST_DRAWER_OPEN_STORAGE_KEY = 'chatListDrawerOpen';
export const CHAT_DETAIL_DRAWER_OPEN_STORAGE_KEY = 'chatDetailDrawerOpen';
export const CHAT_LIST_ITEM_SIZE = 80;
export const CHAT_ROOM_ITEMS_PER_PAGE = 40;
export const CHAT_FILE_UPLOADER = 'ファイルの確認・共有はこちら';
export const CHAT_FILE_MAX_SIZE_BYTES = 200 * 1024 * 1024;

// This list is the same as the one in backend-bff/src/common/constants/index.ts
// TODO: make it DRY
export const ACCEPTED_DOCUMENT_MIME_TYPES = [
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

export const ACCEPTED_ARCHIVE_MIME_TYPES = ['application/zip', 'application/x-zip-compressed'];

export const CHAT_FILE_ACCEPTED_MIME_TYPES = [
  ...ACCEPTED_DOCUMENT_MIME_TYPES,
  ...ACCEPTED_IMAGE_MIME_TYPES,
  ...ACCEPTED_VIDEO_MIME_TYPES,
  ...ACCEPTED_AUDIO_MIME_TYPES,
  ...ACCEPTED_ARCHIVE_MIME_TYPES,
];

export const CHAT_FILE_ACCEPTED_LIST = CHAT_FILE_ACCEPTED_MIME_TYPES.join(',');

export type AttributeOption = { label: string; value: string };
export const ATTRIBUTE_OPTIONS: AttributeOption[] = [
  { label: 'String', value: 'string' },
  { label: 'Boolean', value: 'boolean' },
  { label: 'Date', value: 'date' },
  { label: 'Datetime', value: 'datetime' },
  { label: 'Time', value: 'time' },
  { label: 'Number', value: 'number' },
  { label: 'Selection', value: 'selection' },
];
