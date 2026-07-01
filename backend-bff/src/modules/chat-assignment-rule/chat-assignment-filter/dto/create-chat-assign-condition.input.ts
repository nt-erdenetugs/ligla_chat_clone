import { InputType, Field } from '@nestjs/graphql';

import { Type } from 'class-transformer';
import { IsOptional, ValidateNested, IsIn, MaxLength } from 'class-validator';

import { SurveyColumnType } from '@/modules/survey/enums';

import { STORE_IDS_FIELD } from '../constants';
import { LogicalOperator, ConditionOperator, ValueType } from '../enums';

@InputType()
export class CreateConditionInput {
  @Field()
  @IsIn([STORE_IDS_FIELD, ...Object.values(SurveyColumnType)])
  field: string;

  @Field(() => ConditionOperator)
  operator: ConditionOperator;

  @Field({ nullable: true })
  @IsOptional()
  @MaxLength(255)
  value?: string;

  @Field(() => ValueType)
  valueType: ValueType;
}

@InputType()
export class CreateConditionGroupInput {
  @Field(() => LogicalOperator)
  logicalOperator: LogicalOperator;

  @Field(() => [CreateConditionInput])
  @ValidateNested({ each: true })
  @Type(() => CreateConditionInput)
  conditions: CreateConditionInput[];

  @Field(() => [CreateConditionGroupInput], { nullable: true })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateConditionGroupInput)
  subGroups?: CreateConditionGroupInput[];
}
