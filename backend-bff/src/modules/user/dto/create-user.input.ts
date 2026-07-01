import { InputType, Field } from '@nestjs/graphql';

import { Transform } from 'class-transformer';
import { IsOptional, MaxLength, MinLength, IsEmail } from 'class-validator';

import { DISPLAY_NAME_MAX_CHAR_LIMIT } from '@/modules/user/constants';
import { UserRoleType } from '@/modules/user/enums';

@InputType()
export class CreateUserInput {
  @Field()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(DISPLAY_NAME_MAX_CHAR_LIMIT)
  displayName: string;

  @Field(() => String, { nullable: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || null : value))
  @IsOptional()
  @MaxLength(DISPLAY_NAME_MAX_CHAR_LIMIT)
  senderName?: string | null;

  @Field()
  @IsEmail()
  @MinLength(1)
  @MaxLength(255, { message: 'Email address is too long' })
  email: string;

  @Field(() => UserRoleType)
  roleType: UserRoleType;

  @Field(() => [String], { nullable: true })
  teamIds?: string[];
}
