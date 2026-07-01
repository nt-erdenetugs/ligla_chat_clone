import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class ChatFileListQueryDto {
  @IsString()
  @IsNotEmpty()
  chatId!: string;

  @IsString()
  @IsNotEmpty()
  endUserId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pageSize?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}
