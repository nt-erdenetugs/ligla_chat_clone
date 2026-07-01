import { ObjectType, Field, Int } from '@nestjs/graphql';

import { Team } from '../entities/team.entity';

@ObjectType()
export class TeamsWithCount {
  @Field(() => [Team])
  items: Team[];

  @Field(() => Int)
  count: number;
}
