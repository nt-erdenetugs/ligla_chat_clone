import { ObjectType, Field } from '@nestjs/graphql';

import { Store } from '@/modules/store/entities/store.entity';
import { User } from '@/modules/user/entities/user.entity';

@ObjectType()
export class BaseTeam {
  @Field(() => String)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => Date)
  createdAt: Date;
}

@ObjectType()
export class Team extends BaseTeam {
  @Field(() => Boolean)
  isActive: boolean;

  @Field(() => Boolean)
  isDefault: boolean;

  @Field(() => [User])
  managers: User[];

  @Field(() => [User])
  operators: User[];

  @Field(() => [Store])
  stores: Store[];

  @Field(() => TeamSetting, { nullable: true })
  teamSetting: Nullable<TeamSetting>;
}

@ObjectType()
export class TeamChatSetting {
  @Field(() => String)
  id: string;

  @Field(() => String)
  teamSettingId: string;

  @Field(() => Boolean)
  viewAllChatsEnabled: boolean;
}

@ObjectType()
export class TeamSetting {
  @Field(() => String)
  id: string;

  @Field(() => String)
  teamId: string;

  @Field(() => TeamChatSetting, { nullable: true })
  teamChatSetting: Nullable<TeamChatSetting>;
}
@ObjectType()
export class SelectableTeam {
  @Field(() => String)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => Boolean)
  isDefault: boolean;
}
