import { Field, InputType } from '@nestjs/graphql';

import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

@InputType()
export class ChatAssignRuleFilterInput {
  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  createdAtFrom?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  createdAtTo?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetTeamIds?: string[];
}
