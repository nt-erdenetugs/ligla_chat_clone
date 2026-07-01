import { ObjectType, Field, Int } from '@nestjs/graphql';

import { Store } from '../entities/store.entity';

@ObjectType()
export class StoresWithCount {
  @Field(() => [Store])
  items: Store[];

  @Field(() => Int)
  count: number;
}
