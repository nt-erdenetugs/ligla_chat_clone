import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class Tag {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field(() => Boolean)
  isActive: boolean;

  @Field(() => Date)
  createdAt: Date;
}
