import { InputType, Field } from '@nestjs/graphql';

import { Type } from 'class-transformer';
import {
  IsOptional,
  ValidateNested,
  IsArray,
  ArrayNotEmpty,
  MaxLength,
  MinLength,
} from 'class-validator';

import { IsValidNestedDepth } from '@/modules/chat-assignment-rule/validators/nested-depth.validator';

import { CreateFilterGroupInput } from '../chat-assignment-filter/dto/create-chat-assign-filter.input';

@InputType()
export class CreateChatAssignRuleInput {
  @Field()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @MaxLength(255)
  note?: string;

  @Field(() => [String])
  @IsArray()
  @ArrayNotEmpty()
  targetTeamIds: string[];

  @Field(() => CreateFilterGroupInput)
  @ValidateNested({ each: true })
  @IsValidNestedDepth()
  @Type(() => CreateFilterGroupInput)
  rootFilterGroup: CreateFilterGroupInput;
}
