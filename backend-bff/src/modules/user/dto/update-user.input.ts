import { InputType, Field } from '@nestjs/graphql';

import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, MaxLength, MinLength } from 'class-validator';

import { DISPLAY_NAME_MAX_CHAR_LIMIT } from '@/modules/user/constants';
import { UserRoleType, UserStatusType } from '@/modules/user/enums';

@InputType()
export class UpdateUserInput {
  @Field()
  id: string;

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

  @Field(() => UserRoleType)
  roleType: UserRoleType;

  @Field(() => String, { nullable: true })
  @IsEnum(UserStatusType)
  status: UserStatusType;
}

@InputType()
export class UpdateDisplayNameInput {
  @Field(() => String)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(DISPLAY_NAME_MAX_CHAR_LIMIT)
  displayName: string;
}

@InputType()
export class UpdateSenderNameInput {
  @Field(() => String)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(DISPLAY_NAME_MAX_CHAR_LIMIT)
  senderName: string;
}

@InputType()
export class ResetPasswordInput {
  @Field()
  currentPassword: string;

  @Field()
  newPassword: string;
}
