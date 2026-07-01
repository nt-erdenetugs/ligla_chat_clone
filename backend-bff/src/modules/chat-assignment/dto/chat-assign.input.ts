import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class ChatAssignInput {
  @Field()
  chatId: string;

  @Field()
  assignedUserId: string;
}
