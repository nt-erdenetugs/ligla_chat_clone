import { Field, InputType } from '@nestjs/graphql';

import { IsNotEmpty, IsEnum, IsPositive } from 'class-validator';
import { GraphQLBigInt } from 'graphql-scalars';

import { FileType } from '../entities/chat-file.entity';

@InputType()
export class UploadChatFileEndUserInput {
  @Field()
  @IsNotEmpty()
  fileName: string;

  @IsPositive()
  @Field(() => GraphQLBigInt)
  fileSize: bigint;

  @Field()
  @IsNotEmpty()
  mimeType: string;

  @Field(() => FileType)
  @IsEnum(FileType)
  fileType: FileType;
}
