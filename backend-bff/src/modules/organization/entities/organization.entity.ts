import { ObjectType, Field, Int } from '@nestjs/graphql';

import { IsBoolean, IsNumber, MaxLength, MinLength } from 'class-validator';

import { User } from '@/modules/user/entities/user.entity';

@ObjectType()
export class BaseOrganization {
  @Field()
  id: string;

  @Field()
  @MaxLength(255)
  name: string;

  @Field()
  @MaxLength(255)
  displayName: string;

  @Field(() => String, { nullable: true })
  @MaxLength(30)
  fileUploadLiffId: string | null;
}

@ObjectType()
export class Organization extends BaseOrganization {
  @Field(() => String, { nullable: true })
  @MaxLength(255)
  description: string | null;

  @Field(() => String)
  @MinLength(5)
  @MaxLength(64)
  apiKey: string | null;

  @Field(() => Int)
  @IsNumber()
  maxOperator: number;

  @Field(() => Int)
  @IsNumber()
  operatorCount: number;

  @Field(() => String, { nullable: true })
  @MaxLength(30)
  loginLiffId?: string | null;

  @Field(() => [User], { nullable: true })
  users: User[] | null;

  @Field()
  @IsBoolean()
  isActive: boolean;
}
