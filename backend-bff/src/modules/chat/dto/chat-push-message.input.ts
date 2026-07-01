import { Field, InputType } from '@nestjs/graphql';

import { GraphQLJSONObject } from 'graphql-scalars';

@InputType()
class EmojiInput {
  @Field()
  index: number;

  @Field()
  length: number;

  @Field()
  productId: string;

  @Field()
  emojiId: string;
}
@InputType()
export class ChatPushMessageInput {
  @Field()
  operatorId: string;

  @Field()
  userId: string;

  @Field()
  type: string;

  @Field({ nullable: true })
  text?: string;

  @Field(() => [GraphQLJSONObject], { nullable: true })
  messages?: Record<string, any>[];

  @Field()
  messageId: string;

  @Field({ nullable: true })
  quoteToken?: string;

  @Field(() => [EmojiInput], { nullable: true })
  emojis?: EmojiInput[];

  @Field(() => Boolean, { nullable: true })
  closeChat?: boolean;
}
