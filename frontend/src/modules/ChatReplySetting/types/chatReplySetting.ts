import {
  type ChatMessageType,
  type ChatReplyScheduleType,
  type ChatReplyTimeRangeType,
} from '~/generated/graphql/types';

export interface IChatReplySetting {
  id: string;
  isActive: boolean;
  updatedBy?: Nullable<string>;
  chatReplySchedules: IChatReplySchedule[];
  chatReplySettingMessages: IChatReplySettingMessage[];
}

export interface IChatReplySettingMessage {
  timeRangeType: ChatReplyTimeRangeType;
  chatReplyMessageTemplate: IChatReplyMessageTemplate;
}

export interface IChatReplyMessageTemplate {
  type: ChatMessageType;
  content: string;
  updatedBy?: Nullable<string>;
  contentUrl?: Nullable<string>;
  previewImageUrl?: Nullable<string>;
}

export interface IChatReplySchedule {
  scheduleType: ChatReplyScheduleType;
  chatReplyScheduleCustomDates: string[];
  chatReplyScheduleTimeRanges: IChatReplyScheduleTimeRange[];
}

export interface IChatReplyScheduleTimeRange {
  startTime: string;
  endTime: string;
  timeRangeType: ChatReplyTimeRangeType;
}
