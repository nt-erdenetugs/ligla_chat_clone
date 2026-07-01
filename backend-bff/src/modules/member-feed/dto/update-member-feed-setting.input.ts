import { Field, InputType } from '@nestjs/graphql';

import { MemberFeedColumnType } from '@/modules/member-feed/enums';

@InputType()
export class UpdateMemberFeedSettingInput {
  @Field(() => [MemberFeedColumnType])
  enabledColumns: MemberFeedColumnType[];
}
