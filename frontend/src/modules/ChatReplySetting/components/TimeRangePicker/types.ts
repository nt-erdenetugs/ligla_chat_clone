import { type ChatReplyScheduleType } from '~/generated/graphql/types';

export type TimeRange = { start: string; end: string };

export type Schedule = {
  scheduleType: ChatReplyScheduleType;
  timeRanges: TimeRange[];
  isSpecialDay?: boolean;
};

export type Weekend = ChatReplyScheduleType.Saturday | ChatReplyScheduleType.Sunday;
