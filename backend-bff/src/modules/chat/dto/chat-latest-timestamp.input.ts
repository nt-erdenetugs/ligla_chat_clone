import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class ChatLatestReadInput {
  @Field()
  chatId: string;

  @Field(() => Date)
  timestamp: Date;
}
