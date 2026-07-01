import { ObjectType, Field } from '@nestjs/graphql';

import { FilterTargetType, LogicalOperator } from '../enums';

import { ChatAssignConditionGroup } from './chat-assign-condition.entity';

@ObjectType()
export class ChatAssignFilter {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field(() => FilterTargetType)
  targetTable: FilterTargetType;

  @Field(() => String, { nullable: true })
  note?: Nullable<string>;

  @Field(() => Boolean)
  isActive: boolean;

  @Field()
  createdAt: Date;

  @Field(() => String, { nullable: true })
  updatedAt?: Nullable<Date>;

  @Field(() => ChatAssignConditionGroup)
  rootConditionGroup: ChatAssignConditionGroup;
}

@ObjectType()
export class ChatAssignFilterItem {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field(() => FilterTargetType)
  targetTable: FilterTargetType;
}

@ObjectType()
export class ChatAssignFilterGroup {
  @Field()
  id: string;

  @Field(() => LogicalOperator)
  logicalOperator: LogicalOperator;

  @Field(() => [ChatAssignFilterItem])
  filters: ChatAssignFilterItem[];

  @Field(() => [ChatAssignFilterGroup], { nullable: true })
  subGroups?: Nullable<ChatAssignFilterGroup[]>;
}
