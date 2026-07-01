import { InputType, Field, OmitType } from '@nestjs/graphql';

import { CreateAttributeInput } from './create-attribute.input';

@InputType()
export class UpdateAttributeInput extends OmitType(CreateAttributeInput, [
  'isEncryptionEnabled',
] as const) {
  @Field()
  id: string;

  @Field(() => Boolean)
  isActive: boolean;
}
