import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ChatDataSyncType {
  TAGS = 'tag-settings',
  USER_TAGS = 'user-tags',
  ATTRIBUTES = 'attribute-settings',
  USER_ATTRIBUTES = 'user-attributes',
}

export class NotifyCoreInput {
  @IsEnum(ChatDataSyncType)
  type: ChatDataSyncType;

  @IsString()
  organizationName: string;

  @IsString()
  @IsOptional()
  userId?: string;
}
