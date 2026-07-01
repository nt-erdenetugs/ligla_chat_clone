import { ObjectType, Field } from '@nestjs/graphql';

import { BaseTeam } from '@/modules/team/entities/team.entity';

@ObjectType()
export class ChatTeamAssignment {
  @Field()
  id: string;

  @Field()
  chatId: string;

  @Field()
  teamId: string;

  @Field(() => BaseTeam)
  team: BaseTeam;

  @Field(() => Date, { nullable: true })
  createdAt: Nullable<Date>;
}
