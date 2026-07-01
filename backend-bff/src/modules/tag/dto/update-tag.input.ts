import { Field, InputType } from '@nestjs/graphql';

import { CreateTagInput } from './create-tag.input';

@InputType()
export class UpdateTagInput extends CreateTagInput {
  @Field(() => String)
  id: string;

  @Field(() => Boolean)
  isActive: boolean;
}
