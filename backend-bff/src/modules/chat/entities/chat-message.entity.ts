import { ObjectType, Field, registerEnumType } from '@nestjs/graphql';

import { inferEnum, InferEnumType } from '@/drizzle/utils';
import { ChatMessageType } from '@/modules/chat/enums';
import { Sender } from '@/modules/user/entities/user.entity';
import { sendertype } from '@@/drizzle/schema';

export const SenderType = inferEnum(sendertype);
export type SenderType = InferEnumType<typeof sendertype.enumValues>;

registerEnumType(SenderType, {
  name: 'SenderType',
  description: 'Defines whether the sender is an end-user or operator',
});

@ObjectType()
export class ChatMessage {
  @Field()
  id: string;

  @Field()
  chatId: string;

  @Field()
  senderId: string;

  @Field(() => Sender)
  sender: Sender;

  @Field(() => SenderType)
  senderType: SenderType;

  @Field(() => ChatMessageType)
  type: ChatMessageType;

  @Field()
  content: string;

  @Field(() => String, { nullable: true })
  messageId: string | null;

  @Field()
  isUnsent: boolean;

  @Field()
  isDelivered: boolean;

  @Field(() => String, { nullable: true })
  previewImageUrl: string | null;

  @Field(() => String, { nullable: true })
  contentUrl: string | null;

  @Field(() => Number, { nullable: true })
  duration: number | null;

  @Field(() => Number, { nullable: true })
  latitude: number | null;

  @Field(() => Number, { nullable: true })
  longitude: number | null;

  @Field(() => String, { nullable: true })
  quoteToken: string | null;

  @Field(() => String, { nullable: true })
  quotedMessageId: string | null;

  @Field(() => String, { nullable: true })
  markAsReadToken: string | null;

  @Field(() => Date)
  createdAt: Date;
}

@ObjectType()
export class ChatMessageUpdatePayload {
  @Field()
  chatId: string;

  @Field()
  messageId: string;

  @Field()
  isDelivered: boolean;
}
