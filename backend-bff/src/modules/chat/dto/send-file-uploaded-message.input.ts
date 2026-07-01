import { Field, InputType } from '@nestjs/graphql';

import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

@InputType()
export class SendFileUploadedMessageInput {
  @Field()
  @IsString()
  chatId: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fileName: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  altText?: string;
}
