import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class ChatReceiveDto {
  @IsString()
  readonly chatId: string;

  @IsString()
  readonly endUserId: string;

  @IsString()
  clientName: string;

  // Add auto-reply fields
  @IsOptional()
  @IsBoolean()
  readonly isAutoReplyMessage?: boolean;

  @IsOptional()
  @IsString()
  readonly messageId?: string;

  @IsOptional()
  @IsBoolean()
  readonly closeChat?: boolean;
}
