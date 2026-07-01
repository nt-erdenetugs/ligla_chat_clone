import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';

import { IsPositive } from 'class-validator';
import { GraphQLBigInt } from 'graphql-scalars';

import { inferEnum, InferEnumType } from '@/drizzle/utils';
import {
  filestatus as filestatusEnum,
  filetype as filetypeEnum,
  filefolder as filefolderEnum,
} from '@@/drizzle/enums';

export const FileStatus = inferEnum(filestatusEnum);
export type FileStatus = InferEnumType<typeof filestatusEnum.enumValues>;

export const FileType = inferEnum(filetypeEnum);
export type FileType = InferEnumType<typeof filetypeEnum.enumValues>;

export const FileFolder = inferEnum(filefolderEnum);
export type FileFolder = InferEnumType<typeof filefolderEnum.enumValues>;

registerEnumType(FileStatus, {
  name: 'FileStatus',
});

registerEnumType(FileType, {
  name: 'FileType',
});

registerEnumType(FileFolder, {
  name: 'FileFolder',
});

@ObjectType()
export class ChatFile {
  @Field(() => ID)
  id: string;

  @Field()
  chatId: string;

  @Field(() => String, { nullable: true })
  uploaderOperatorId?: string | null;

  @Field(() => String, { nullable: true })
  uploaderEndUserId?: string | null;

  @Field(() => String, { nullable: true })
  uploaderOperatorName?: string | null;

  @Field(() => String, { nullable: true })
  uploaderEndUserName?: string | null;

  @Field()
  fileName: string;

  @Field()
  originalFileName: string;

  @IsPositive()
  @Field(() => GraphQLBigInt)
  fileSize: number;

  @Field()
  mimeType: string;

  @Field(() => FileType)
  fileType: FileType;

  @Field()
  gcsObjectKey: string;

  @Field(() => FileFolder)
  storageFolder: FileFolder;

  @Field(() => FileStatus)
  status: FileStatus;

  @Field(() => String, { nullable: true })
  scanResult?: string | null;

  @Field()
  createdAt: Date;

  @Field(() => Date, { nullable: true })
  updatedAt?: Date | null;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date | null;

  @Field(() => String, { nullable: true })
  deletedBy?: string | null;
}
