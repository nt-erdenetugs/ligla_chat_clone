import { InputType, Field } from '@nestjs/graphql';

import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

@InputType()
export class CreateChatNoteInput {
  @Field()
  @IsUUID()
  chatId: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(2000, { message: 'The text is too long' })
  noteValue: string;
}
