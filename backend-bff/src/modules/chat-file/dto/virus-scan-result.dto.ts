import { Type } from 'class-transformer';
import { IsString, IsObject, ValidateNested, IsBoolean } from 'class-validator';

export class PubSubMessageData {
  @IsString()
  data: string;
}

export class VirusScanResultPubSubDto {
  @IsObject()
  @ValidateNested()
  @Type(() => PubSubMessageData)
  message: PubSubMessageData;
}

export class VirusScanResultPayload {
  @IsString()
  gcsObjectKey: string;

  @IsBoolean()
  infected: boolean;
}
