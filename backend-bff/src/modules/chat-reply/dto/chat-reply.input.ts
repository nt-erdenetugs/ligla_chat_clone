import { Field, InputType } from '@nestjs/graphql';

import { ChatMessageToEndUser } from '@/modules/chat/dto/chat-message.input';
import { ChatReplyScheduleType, ChatReplyTimeRangeType } from '@/modules/chat-reply/enums';

@InputType()
export class CreateChatReplySettingMessageInput {
  @Field(() => ChatMessageToEndUser)
  messageTemplate: ChatMessageToEndUser;

  @Field(() => ChatReplyTimeRangeType)
  timeRangeType: ChatReplyTimeRangeType;
}

@InputType()
export class CreateChatReplyScheduleTimeRangeInput {
  @Field()
  startTime: string;

  @Field()
  endTime: string;

  @Field(() => ChatReplyTimeRangeType)
  timeRangeType: ChatReplyTimeRangeType;
}

@InputType()
export class CreateChatReplyScheduleInput {
  @Field(() => ChatReplyScheduleType)
  scheduleType: ChatReplyScheduleType;

  @Field(() => [Date], { nullable: true })
  customDates?: Date[];

  @Field(() => [CreateChatReplyScheduleTimeRangeInput])
  timeRanges: CreateChatReplyScheduleTimeRangeInput[];
}

@InputType()
export class CreateChatReplySettingInput {
  @Field()
  isActive: boolean;

  @Field(() => [CreateChatReplyScheduleInput])
  schedules: CreateChatReplyScheduleInput[];

  @Field(() => [CreateChatReplySettingMessageInput])
  messages: CreateChatReplySettingMessageInput[];
}

@InputType()
export class UpdateChatReplySettingInput extends CreateChatReplySettingInput {
  @Field()
  id: string;
}
