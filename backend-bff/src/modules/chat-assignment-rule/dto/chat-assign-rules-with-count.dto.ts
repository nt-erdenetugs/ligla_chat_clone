import { ObjectType, Field, Int } from '@nestjs/graphql';

import { ChatAssignRule } from '../entities/chat-assign-rule.entity';

@ObjectType()
export class ChatAssignRulesWithCount {
  @Field(() => [ChatAssignRule])
  items: ChatAssignRule[];

  @Field(() => Int)
  count: number;
}
