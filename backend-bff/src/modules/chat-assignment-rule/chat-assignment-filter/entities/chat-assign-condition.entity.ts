import { ObjectType, Field } from '@nestjs/graphql';

import { LogicalOperator, ConditionOperator, ValueType } from '../enums';

@ObjectType()
export class ConditionValue {
  @Field()
  id: string;

  @Field()
  name: string;
}

@ObjectType()
export class ChatAssignCondition {
  @Field()
  field: string;

  @Field(() => ConditionOperator)
  operator: ConditionOperator;

  @Field(() => String, { nullable: true })
  value?: Nullable<string>;

  @Field(() => [ConditionValue], { nullable: true })
  valueObjects?: Nullable<ConditionValue[]>;

  @Field(() => ValueType)
  valueType: ValueType;
}

@ObjectType()
export class ChatAssignConditionGroup {
  @Field(() => LogicalOperator)
  logicalOperator: LogicalOperator;

  @Field(() => [ChatAssignCondition])
  conditions: ChatAssignCondition[];

  @Field(() => [ChatAssignConditionGroup], { nullable: true })
  subGroups?: Nullable<ChatAssignConditionGroup[]>;
}
