import { Field, InputType } from '@nestjs/graphql';

import { IsArray, IsString } from 'class-validator';

@InputType()
export class ChatTagInput {
  @Field()
  chatId: string;

  @Field()
  tagId: string;
}

@InputType()
export class UpdateChatTagsInput {
  @Field()
  chatId: string;

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  tagIds: string[];
}
