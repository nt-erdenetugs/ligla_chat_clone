import { ObjectType, Field, Int } from '@nestjs/graphql';

import { Organization } from '../entities/organization.entity';

@ObjectType()
export class OrganizationsWithCount {
  @Field(() => Int)
  count: number;

  @Field(() => [Organization])
  items: Organization[];
}
