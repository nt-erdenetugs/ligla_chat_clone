import { ObjectType, Field, Int } from '@nestjs/graphql';

import { ChatAssignFilter } from '../entities/chat-assign-filter.entity';

@ObjectType()
export class ChatAssignFiltersWithCount {
  @Field(() => [ChatAssignFilter])
  items: ChatAssignFilter[];

  @Field(() => Int)
  count: number;
}
