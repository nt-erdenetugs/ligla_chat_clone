import { InputType, Field, PartialType } from '@nestjs/graphql';

import { CreateChatAssignRuleInput } from './create-chat-assign-rule.input';

@InputType()
export class UpdateChatAssignRuleInput extends PartialType(CreateChatAssignRuleInput) {
  @Field()
  id: string;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;
}
