import { InputType, Field, PartialType } from '@nestjs/graphql';

import { CreateTeamInput } from './create-team.input';

@InputType()
export class UpdateTeamInput extends PartialType(CreateTeamInput) {
  @Field(() => String)
  id: string;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;
}
