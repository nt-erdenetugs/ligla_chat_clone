import { registerEnumType } from '@nestjs/graphql';

export const CHAT_REPLY_SCHEDULE_TYPES = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
  'HOLIDAYS',
  'CUSTOM_DATE',
] as const;

export const CHAT_REPLY_TIME_RANGE_TYPES = ['ACTIVE_TIME', 'DEFAULT'] as const;

// Runtime enum-like objects
export const ChatReplyScheduleType = Object.fromEntries(
  CHAT_REPLY_SCHEDULE_TYPES.map((v) => [v, v]),
) as { [K in (typeof CHAT_REPLY_SCHEDULE_TYPES)[number]]: K };

export const ChatReplyTimeRangeType = Object.fromEntries(
  CHAT_REPLY_TIME_RANGE_TYPES.map((v) => [v, v]),
) as { [K in (typeof CHAT_REPLY_TIME_RANGE_TYPES)[number]]: K };

// Type exports
export type ChatReplyScheduleType = (typeof CHAT_REPLY_SCHEDULE_TYPES)[number];
export type ChatReplyTimeRangeType = (typeof CHAT_REPLY_TIME_RANGE_TYPES)[number];

registerEnumType(ChatReplyScheduleType, { name: 'ChatReplyScheduleType' });
registerEnumType(ChatReplyTimeRangeType, { name: 'ChatReplyTimeRangeType' });
