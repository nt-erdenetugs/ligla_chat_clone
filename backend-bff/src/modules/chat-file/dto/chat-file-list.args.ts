import { ArgsType, Field } from '@nestjs/graphql';

import { IsNotEmpty } from 'class-validator';

@ArgsType()
export class ChatFileListArgs {
  @Field()
  @IsNotEmpty()
  chatId!: string;

  @Field()
  @IsNotEmpty()
  endUserId!: string;
}
