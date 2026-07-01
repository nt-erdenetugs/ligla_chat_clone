import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class Store {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field(() => Boolean)
  isActive: boolean;

  @Field(() => Number, { nullable: true })
  liglaStoreId: number;

  @Field(() => String, { nullable: true })
  areaName?: string | null;

  @Field(() => String, { nullable: true })
  typeName?: string | null;

  @Field(() => String, { nullable: true })
  note?: string | null;

  @Field(() => Date, { nullable: true })
  startsAt?: Date | null;

  @Field(() => Date, { nullable: true })
  endsAt?: Date | null;

  @Field(() => Date)
  createdAt: Date;
}
