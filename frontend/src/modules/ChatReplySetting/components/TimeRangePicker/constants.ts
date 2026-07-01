import { ChatReplyScheduleType } from '~/generated/graphql/types';

import { type Schedule } from '.';

export const weekdays: ChatReplyScheduleType[] = [
  ChatReplyScheduleType.Monday,
  ChatReplyScheduleType.Tuesday,
  ChatReplyScheduleType.Wednesday,
  ChatReplyScheduleType.Thursday,
  ChatReplyScheduleType.Friday,
  ChatReplyScheduleType.Saturday,
  ChatReplyScheduleType.Sunday,
];

export const specialDays: ChatReplyScheduleType[] = [
  ChatReplyScheduleType.Holidays,
  ChatReplyScheduleType.CustomDate,
];

export const defaultSchedules: Schedule[] = [
  ...weekdays.map((scheduleType): Schedule => ({ scheduleType, timeRanges: [] })),
  ...specialDays.map(
    (scheduleType): Schedule => ({ scheduleType, timeRanges: [], isSpecialDay: true }),
  ),
];

export const labelColumnWidth = 70;
