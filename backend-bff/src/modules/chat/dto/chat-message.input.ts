import { Field, InputType } from '@nestjs/graphql';

import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { GraphQLJSONObject } from 'graphql-scalars';

import { ChatMessageType } from '../enums';

@InputType()
export class FlexMessageInput {
  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(400)
  altText: string;

  @Field(() => GraphQLJSONObject)
  contents: Record<string, any>;
}

@InputType()
export class ChatMessageToEndUser {
  @Field(() => ChatMessageType)
  type: ChatMessageType;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(5000)
  text?: string;

  @Field(() => FlexMessageInput, { nullable: true })
  @IsOptional()
  flex?: FlexMessageInput;
}

@InputType()
export class ChatMessageInput {
  @Field()
  chatId: string;

  @Field()
  message: ChatMessageToEndUser;
}

@InputType()
export class RetryMessageInput {
  @Field()
  chatId: string;

  @Field()
  messageId: string;
}

@InputType()
export class DeleteMessageInput extends RetryMessageInput {}
