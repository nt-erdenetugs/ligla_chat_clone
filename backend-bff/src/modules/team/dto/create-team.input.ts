import { Field, InputType } from '@nestjs/graphql';

import { Transform } from 'class-transformer';
import { IsString, IsArray, IsOptional, IsNotEmpty } from 'class-validator';

@InputType()
export class TeamChatSettingInput {
  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  viewAllChatsEnabled?: boolean;
}

@InputType()
export class TeamSettingInput {
  @Field(() => TeamChatSettingInput, { nullable: true })
  @IsOptional()
  teamChatSetting?: TeamChatSettingInput;
}

@InputType()
export class CreateTeamInput {
  @Field()
  @IsString()
  @IsNotEmpty({ message: 'Name cannot be empty' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      // Trim leading/trailing spaces and replace multiple spaces with single space
      return value.trim().replace(/\s+/g, ' ');
    }
    return value;
  })
  name: string;

  @Field(() => [String], { nullable: true, defaultValue: [] })
  @IsArray()
  @IsOptional()
  managerIds?: string[];

  @Field(() => [String], { nullable: true, defaultValue: [] })
  @IsArray()
  @IsOptional()
  operatorIds?: string[];

  @Field(() => [String], { nullable: true, defaultValue: [] })
  @IsArray()
  @IsOptional()
  storeIds?: string[];

  @Field(() => TeamSettingInput, { nullable: true })
  @IsOptional()
  teamSetting?: TeamSettingInput;
}
