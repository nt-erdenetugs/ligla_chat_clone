import { Field, InputType } from '@nestjs/graphql';

import { AnyScalar } from '../scalars/any.scalar';

@InputType()
export class FilterOptionInput {
  @Field(() => String, { nullable: true })
  searchItem?: string;

  @Field(() => String, { nullable: true })
  condition?: string;

  @Field(() => AnyScalar, { nullable: true })
  value?: any;
}

@InputType()
export class FilterInput {
  @Field(() => [FilterOptionInput], { nullable: true })
  refineConditions?: FilterOptionInput[];

  @Field(() => String, { nullable: true })
  searchValue?: string;
}
