import { ObjectType, Field } from '@nestjs/graphql';

import { BaseUser } from '@/modules/user/entities/user.entity';

@ObjectType()
export class AttributeValue {
  @Field()
  id: string;

  @Field()
  value: string;

  @Field()
  chatId: string;

  @Field()
  userId: string;

  @Field()
  attributeId: string;

  @Field(() => BaseUser)
  user: BaseUser;

  @Field(() => Date)
  createdAt: Date;
}
