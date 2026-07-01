import { IsString, IsOptional } from 'class-validator';

export class UploadChatFileDto {
  @IsString()
  chatId: string;

  @IsString()
  organizationName: string;

  @IsOptional()
  @IsString()
  endUserId?: string;
}
