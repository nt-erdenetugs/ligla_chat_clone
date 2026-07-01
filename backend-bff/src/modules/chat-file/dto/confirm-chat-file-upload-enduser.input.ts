import { InputType, Field } from '@nestjs/graphql';

import { IsNotEmpty } from 'class-validator';

@InputType()
export class ConfirmChatFileUploadEndUserInput {
  @Field()
  @IsNotEmpty()
  fileId!: string;
}
