import { InputType, Field } from '@nestjs/graphql';

import { IsUUID } from 'class-validator';

import { CreateChatNoteInput } from './create-chat-note.input';

@InputType()
export class UpdateChatNoteInput extends CreateChatNoteInput {
  @Field()
  @IsUUID()
  id: string;
}
