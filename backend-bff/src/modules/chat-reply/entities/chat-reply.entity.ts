import { Field, ObjectType, ID } from '@nestjs/graphql';

import { ChatMessageType } from '@/modules/chat/enums';
import { ChatReplyTimeRangeType } from '@/modules/chat-reply/enums';
import { Organization } from '@/modules/organization/entities/organization.entity';
import { User } from '@/modules/user/entities/user.entity';

import { ChatReplySchedule } from './chat-reply-schedule.entity';

@ObjectType()
export class ChatReplySetting {
  @Field(() => ID)
  id: string;

  @Field()
  isActive: boolean;

  @Field(() => String, { nullable: true })
  updatedBy: string | null;

  @Field(() => [ChatReplySchedule])
  chatReplySchedules: ChatReplySchedule[];

  @Field(() => [ChatReplySettingMessage])
  chatReplySettingMessages: ChatReplySettingMessage[];
}

@ObjectType()
export class OrganizationChatReplySetting {
  @Field(() => ChatReplySetting)
  chatReplySetting: ChatReplySetting;

  @Field(() => Organization)
  organization: Organization;
}

@ObjectType()
export class UserChatReplySetting {
  @Field(() => ChatReplySetting)
  chatReplySetting: ChatReplySetting;

  @Field(() => User)
  user: User;
}

@ObjectType()
export class ChatReplyMessageTemplate {
  @Field(() => ID)
  id: string;

  @Field(() => ChatMessageType)
  type: ChatMessageType;

  @Field()
  content: string;

  @Field(() => String, { nullable: true })
  contentUrl: string | null;

  @Field(() => String, { nullable: true })
  previewImageUrl: string | null;

  @Field(() => String, { nullable: true })
  updatedBy: string | null;
}

@ObjectType()
export class ChatReplySettingMessage {
  @Field(() => ChatReplyTimeRangeType)
  timeRangeType: ChatReplyTimeRangeType;

  @Field(() => ChatReplyMessageTemplate)
  chatReplyMessageTemplate: ChatReplyMessageTemplate;
}
