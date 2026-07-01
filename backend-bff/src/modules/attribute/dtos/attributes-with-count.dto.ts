import { ObjectType, Field, Int } from '@nestjs/graphql';

import { Attribute } from '../entities/attribute.entity';

@ObjectType()
export class AttributesWithCount {
  @Field(() => [Attribute])
  items: Attribute[];

  @Field(() => Int)
  count: number;
}
