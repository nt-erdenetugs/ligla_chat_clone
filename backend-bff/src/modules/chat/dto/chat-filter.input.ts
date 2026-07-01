import { Field, InputType } from '@nestjs/graphql';

import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { ChatStatus } from '../entities/chat.entity';

@InputType()
export class ChatFilterInput {
  @Field(() => [String], { nullable: true })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  teamIds?: string[];

  @Field(() => [String], { nullable: true })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  userIds?: string[];

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  includeUnassigned?: boolean;

  @Field(() => [ChatStatus], { nullable: true })
  @IsArray()
  @IsEnum(ChatStatus, { each: true })
  @IsOptional()
  statuses?: ChatStatus[];

  @Field(() => [String], { nullable: true })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds?: string[];
}
