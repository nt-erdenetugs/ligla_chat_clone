import { Type } from 'class-transformer';
import {
  IsString,
  IsUrl,
  IsOptional,
  IsObject,
  ValidateNested,
  IsNumber,
  IsNotEmpty,
} from 'class-validator';

class PushSubscriptionKeysDto {
  @IsString()
  @IsNotEmpty()
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  auth: string;
}

export class SubscribePushDto {
  @IsUrl()
  @IsNotEmpty()
  endpoint: string;

  @IsOptional()
  @IsNumber()
  expirationTime?: number | null;

  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  @IsNotEmpty()
  keys: PushSubscriptionKeysDto;
}
