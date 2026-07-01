import { ObjectType, Field } from '@nestjs/graphql';

import { ChatAssignFilterGroup } from '@/modules/chat-assignment-rule/chat-assignment-filter/entities/chat-assign-filter.entity';
import { BaseTeam } from '@/modules/team/entities/team.entity';

@ObjectType()
export class ChatAssignRule {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field(() => String, { nullable: true })
  note?: Nullable<string>;

  @Field(() => Boolean)
  isActive: boolean;

  @Field()
  createdAt: Date;

  @Field(() => String, { nullable: true })
  updatedAt?: Nullable<Date>;

  @Field(() => [BaseTeam])
  targetTeams: BaseTeam[];

  @Field(() => ChatAssignFilterGroup)
  rootFilterGroup: ChatAssignFilterGroup;
}
