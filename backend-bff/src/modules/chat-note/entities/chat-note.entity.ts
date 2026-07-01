import { ObjectType, Field } from '@nestjs/graphql';

import { BaseUser } from '@/modules/user/entities/user.entity';

@ObjectType()
export class ChatNote {
  @Field()
  id: string;

  @Field()
  userId: string;

  @Field()
  chatId: string;

  @Field()
  noteValue: string;

  @Field(() => BaseUser)
  user: BaseUser;

  @Field()
  isActive: boolean;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date, { nullable: true })
  updatedAt: Date | null;
}
