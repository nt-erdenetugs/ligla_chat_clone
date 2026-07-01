import { ObjectType, Field } from '@nestjs/graphql';

import { BaseOrganization } from '@/modules/organization/entities/organization.entity';
import { BaseTeam } from '@/modules/team/entities/team.entity';
import { SystemUserType } from '@/modules/user/enums';

@ObjectType()
export class BaseUser {
  @Field()
  id: string;

  @Field(() => String)
  displayName: string;

  @Field(() => String, { nullable: true })
  senderName?: string | null;
}

@ObjectType()
export class User extends BaseUser {
  @Field()
  email: string;

  @Field(() => String, { nullable: true })
  pictureUrl: string | null;

  @Field(() => String, { nullable: true })
  qrUrl?: string | null;

  @Field(() => String)
  roleType: string;

  @Field(() => SystemUserType)
  systemUserType: SystemUserType;

  @Field(() => String)
  status: string;

  @Field(() => BaseOrganization, { nullable: true })
  organization?: BaseOrganization;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => [BaseTeam], { nullable: true })
  teams?: BaseTeam[] | null;
}

@ObjectType()
export class EndUser {
  @Field()
  userId: string;

  @Field(() => String, { nullable: true })
  clientUserId?: string | null;

  @Field(() => String, { nullable: true })
  displayName: string | null;

  @Field(() => String, { nullable: true })
  pictureUrl: string | null;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date, { nullable: true })
  updatedAt: Date | null;
}

@ObjectType()
export class Sender {
  @Field()
  id: string;

  @Field(() => String, { nullable: true })
  displayName: string | null;

  @Field(() => String, { nullable: true })
  senderName?: string | null;

  @Field(() => String, { nullable: true })
  pictureUrl: string | null;
}
