import { ObjectType, Field, Int } from '@nestjs/graphql';

import { Tag } from '../entities/tag.entity';

@ObjectType()
export class TagsWithCount {
  @Field(() => [Tag])
  items: Tag[];

  @Field(() => Int)
  count: number;
}
