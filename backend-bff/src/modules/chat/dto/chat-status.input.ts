import { Field, InputType } from '@nestjs/graphql';

import { ChatStatus } from '../entities/chat.entity';

@InputType()
export class ChatStatusInput {
  @Field()
  chatId: string;

  @Field(() => ChatStatus)
  status: ChatStatus;
}
