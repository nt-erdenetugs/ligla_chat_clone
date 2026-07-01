import { ObjectType, Field } from '@nestjs/graphql';

import { MemberFeedColumnType } from '@/modules/member-feed/enums';

@ObjectType()
export class MemberFeedColumn {
  @Field(() => MemberFeedColumnType)
  name: MemberFeedColumnType;

  @Field()
  alias: string;

  @Field()
  isEnabled: boolean;
}

@ObjectType()
export class MemberFeed {
  @Field(() => MemberFeedColumnType)
  columnName: MemberFeedColumnType;

  @Field()
  columnAlias: string;

  @Field(() => String, { nullable: true })
  value: Nullable<string>;
}
