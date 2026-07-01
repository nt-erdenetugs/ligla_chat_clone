import { ObjectType, Field, Int } from '@nestjs/graphql';

import { User } from '../entities/user.entity';

@ObjectType()
export class UsersWithCount {
  @Field(() => [User])
  items: User[];

  @Field(() => Int)
  count: number;
}
