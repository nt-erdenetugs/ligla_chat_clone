import { ObjectType, Field, registerEnumType } from '@nestjs/graphql';

import { inferEnum, InferEnumType } from '@/drizzle/utils';
import { ChatTeamAssignActionsType } from '@/modules/chat-assignment/enums';
import { activitytype, chatactivityactortype } from '@@/drizzle/schema';

import { ChatStatus } from './chat.entity';

export const ActivityType = inferEnum(activitytype);
export type ActivityType = InferEnumType<typeof activitytype.enumValues>;

export const ChatActivityActorType = inferEnum(chatactivityactortype);
export type ChatActivityActorType = InferEnumType<typeof chatactivityactortype.enumValues>;

registerEnumType(ActivityType, {
  name: 'ActivityType',
  description: 'Defines whether the chat activity is a status change or an assignee change',
});

registerEnumType(ChatActivityActorType, {
  name: 'ActorType',
  description: 'Defines whether the chat activity actor is system or user',
});

@ObjectType()
export class ChatActivity {
  @Field()
  id: string;

  @Field()
  chatId: string;

  @Field(() => ActivityType)
  activityType: ActivityType;

  @Field(() => ChatActivityActorType)
  actorType: ChatActivityActorType;

  @Field(() => String, { nullable: true })
  actorId: Nullable<string>;

  @Field(() => String, { nullable: true })
  actorUserName: Nullable<string>;

  @Field(() => ChatStatus, { nullable: true })
  oldStatus: Nullable<ChatStatus>;

  @Field(() => ChatStatus, { nullable: true })
  newStatus: Nullable<ChatStatus>;

  @Field(() => String, { nullable: true })
  oldUserId: Nullable<string>;

  @Field(() => String, { nullable: true })
  newUserId: Nullable<string>;

  @Field(() => String, { nullable: true })
  oldUserName: Nullable<string>;

  @Field(() => String, { nullable: true })
  newUserName: Nullable<string>;

  @Field(() => String, { nullable: true })
  changedTeamId: Nullable<string>;

  @Field(() => String, { nullable: true })
  changedTeamName: Nullable<string>;

  @Field(() => ChatTeamAssignActionsType, { nullable: true })
  teamAssignAction: Nullable<ChatTeamAssignActionsType>;

  @Field(() => Date)
  createdAt: Date;
}
