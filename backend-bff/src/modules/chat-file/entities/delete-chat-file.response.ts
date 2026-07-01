import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DeleteChatFileResponse {
  @Field()
  success: boolean;
}
