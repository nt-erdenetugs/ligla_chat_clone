import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';

import { createCursorPaginatedResponse } from '@/common/dto/pagination.args';

import { ChatActivity } from './chat-activity.entity';
import { ChatMessage } from './chat-message.entity';

export enum ChatItemType {
  MESSAGE = 'MESSAGE',
  ACTIVITY = 'ACTIVITY',
}

registerEnumType(ChatItemType, {
  name: 'ChatItemType',
  description: 'Type of chat item (message or activity)',
});

@ObjectType('ChatItem')
export class ChatItem {
  @Field(() => ID)
  id: string;

  @Field()
  createdAt: Date;

  @Field(() => ChatMessage, { nullable: true })
  message?: ChatMessage | null;

  @Field(() => ChatActivity, { nullable: true })
  activity?: ChatActivity | null;

  @Field(() => ChatItemType)
  itemType: ChatItemType;
}

export class ChatItemCursorPaginatedResponse extends createCursorPaginatedResponse<ChatItem>(
  ChatItem,
) {}
