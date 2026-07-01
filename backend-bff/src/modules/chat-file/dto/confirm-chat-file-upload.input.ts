import { InputType, Field } from '@nestjs/graphql';

import { IsNotEmpty } from 'class-validator';

@InputType()
export class ConfirmChatFileUploadInput {
  @Field()
  @IsNotEmpty()
  fileId: string;
}
