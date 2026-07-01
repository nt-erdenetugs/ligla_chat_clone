import { InputType, Field } from '@nestjs/graphql';

import { Type } from 'class-transformer';
import {
  IsOptional,
  ValidateNested,
  IsString,
  IsArray,
  MaxLength,
  MinLength,
} from 'class-validator';

import { IsValidNestedDepth } from '@/modules/chat-assignment-rule/validators/nested-depth.validator';

import { FilterTargetType, LogicalOperator } from '../enums';

import { CreateConditionGroupInput } from './create-chat-assign-condition.input';

@InputType()
export class CreateFilterGroupInput {
  @Field(() => LogicalOperator)
  logicalOperator: LogicalOperator;

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  filterIds: string[];

  @Field(() => [CreateFilterGroupInput], { nullable: true })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateFilterGroupInput)
  subGroups?: CreateFilterGroupInput[];
}

@InputType()
export class CreateChatAssignFilterInput {
  @Field()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @Field(() => FilterTargetType)
  targetTable: FilterTargetType;

  @Field({ nullable: true })
  @IsOptional()
  @MaxLength(255)
  note?: string;

  @Field(() => CreateConditionGroupInput)
  @ValidateNested({ each: true })
  @IsValidNestedDepth()
  @Type(() => CreateConditionGroupInput)
  rootConditionGroup: CreateConditionGroupInput;
}
