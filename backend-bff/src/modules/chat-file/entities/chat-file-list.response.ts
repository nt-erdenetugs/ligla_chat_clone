import { Field, Int, ObjectType } from '@nestjs/graphql';

import { ChatFile } from './chat-file.entity';

@ObjectType()
export class ChatFileListResponse {
  @Field(() => [ChatFile])
  items!: ChatFile[];

  @Field(() => String, { nullable: true })
  nextCursorId!: string | null;

  @Field(() => Date, { nullable: true })
  nextCursorCreatedAt!: Date | null;

  @Field()
  hasMore!: boolean;

  @Field(() => Int)
  totalCount!: number;
}
