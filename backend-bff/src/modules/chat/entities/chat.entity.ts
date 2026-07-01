import { ObjectType, Field, registerEnumType, Int } from '@nestjs/graphql';

import { inferEnum, InferEnumType } from '@/drizzle/utils';
import { AttributeValue } from '@/modules/attribute/entities/attribute-value.entity';
import { ChatTeamAssignment } from '@/modules/chat-assignment/entities/chat-assignee.entity';
import { EndUser, User } from '@/modules/user/entities/user.entity';
import { chatStatus } from '@@/drizzle/schema';

import { ChatActivity } from './chat-activity.entity';
import { ChatMessage } from './chat-message.entity';
import { ChatTag } from './chat-tag.entity';

export const ChatStatus = inferEnum(chatStatus);
export type ChatStatus = InferEnumType<typeof chatStatus.enumValues>;

registerEnumType(ChatStatus, {
  name: 'ChatStatus',
});

@ObjectType()
export class Chat {
  @Field()
  id: string;

  @Field(() => ChatStatus)
  chatStatus: ChatStatus;

  @Field()
  endUserId: string;

  @Field(() => EndUser)
  endUser: EndUser;

  @Field(() => String, { nullable: true })
  assignedUserId: string | null;

  @Field(() => User, { nullable: true })
  assignedUser: User | null;

  @Field(() => Date, { nullable: true })
  latestMessageTimestamp: Date | null;

  @Field(() => Date, { nullable: true })
  latestReadTimestamp: Date | null;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => [ChatMessage])
  chatMessages: ChatMessage[];

  @Field(() => [ChatActivity])
  chatActivities: ChatActivity[];

  @Field(() => Int)
  chatUnreadCount: number;

  @Field(() => [ChatTag])
  chatTags: ChatTag[];

  @Field(() => [ChatTeamAssignment])
  chatTeamAssignment: ChatTeamAssignment[];

  @Field(() => [AttributeValue])
  chatAttributeValues: AttributeValue[];

  @Field(() => Boolean)
  sessionActive: boolean;

  @Field(() => Boolean)
  isUserBlocked: boolean;
}
