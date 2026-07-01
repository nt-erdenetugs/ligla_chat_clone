import { InputType, Field } from '@nestjs/graphql';

import { MaxLength } from 'class-validator';

@InputType()
export class CreateChatAttributeValueInput {
  @Field()
  chatId: string;

  @Field()
  attributeId: string;

  @Field()
  @MaxLength(500, { message: 'The text is too long' })
  value: string;
}
