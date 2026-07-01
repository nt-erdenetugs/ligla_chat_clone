import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class ChatTeamAssignInput {
  @Field()
  chatId: string;

  @Field()
  teamId: string;
}
