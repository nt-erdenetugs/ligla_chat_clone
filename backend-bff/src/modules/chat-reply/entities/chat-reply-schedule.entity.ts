import { Field, ObjectType, ID } from '@nestjs/graphql';

import { ChatReplyScheduleType, ChatReplyTimeRangeType } from '@/modules/chat-reply/enums';

@ObjectType()
export class ChatReplySchedule {
  @Field(() => ID)
  id: string;

  @Field(() => ChatReplyScheduleType)
  scheduleType: ChatReplyScheduleType;

  @Field(() => [Date])
  chatReplyScheduleCustomDates: Date[];

  @Field(() => [ChatReplyScheduleTimeRange])
  chatReplyScheduleTimeRanges: ChatReplyScheduleTimeRange[];
}

@ObjectType()
export class ChatReplyScheduleTimeRange {
  @Field()
  startTime: string;

  @Field()
  endTime: string;

  @Field(() => ChatReplyTimeRangeType)
  timeRangeType: ChatReplyTimeRangeType;
}
