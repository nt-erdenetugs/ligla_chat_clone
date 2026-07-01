import { InputType, Field, PartialType } from '@nestjs/graphql';

import { CreateChatAssignFilterInput } from './create-chat-assign-filter.input';

@InputType()
export class UpdateChatAssignFilterInput extends PartialType(CreateChatAssignFilterInput) {
  @Field()
  id: string;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;
}
