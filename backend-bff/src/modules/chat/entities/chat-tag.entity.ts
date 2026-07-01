import { ObjectType, Field } from '@nestjs/graphql';

import { Tag } from '@/modules/tag/entities/tag.entity';

@ObjectType()
export class ChatTag {
  @Field()
  id: string;

  @Field()
  chatId: string;

  @Field()
  tagId: string;

  @Field(() => Tag)
  tag: Tag;

  @Field(() => Date)
  createdAt: Date;
}
