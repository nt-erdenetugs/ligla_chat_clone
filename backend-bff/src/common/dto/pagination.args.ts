import { Field, Int, ArgsType, ObjectType, registerEnumType } from '@nestjs/graphql';

import { Type } from 'class-transformer';
import { Max, Min, IsNumber, IsOptional, IsString, IsDate, IsEnum } from 'class-validator';

const DEFAULT_TAKE_LIMIT = 100;
const DEFAULT_SKIP_VALUE = 0;

export enum CursorDirection {
  FORWARD = 'forward',
  BACKWARD = 'backward',
}

registerEnumType(CursorDirection, {
  name: 'CursorDirection',
});

@ArgsType()
export class PaginationArgs {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  skip?: number = DEFAULT_SKIP_VALUE;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(DEFAULT_TAKE_LIMIT)
  take?: number = DEFAULT_TAKE_LIMIT;
}

@ArgsType()
export class CursorPaginationArgs {
  @Field(() => Date, {
    nullable: true,
    description: 'The createdAt timestamp of the last item in the previous page.',
  })
  @IsOptional()
  @IsDate()
  cursorCreatedAt?: Date;

  @Field(() => Date, {
    nullable: true,
    description: 'Cursor for extra date fields for sorting',
  })
  @IsOptional()
  @IsDate()
  cursorDateParam?: Date;

  @Field(() => Int, {
    nullable: true,
    description: 'Cursor for integer fields for sorting (e.g., liglaStoreId)',
  })
  @IsOptional()
  @IsNumber()
  cursorIntParam?: number;

  @Field(() => String, {
    nullable: true,
    description: 'The ID of the last item in the previous page.',
  })
  @IsOptional()
  @IsString()
  cursorId?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(DEFAULT_TAKE_LIMIT)
  take?: number = DEFAULT_TAKE_LIMIT;

  @Field(() => CursorDirection, { defaultValue: CursorDirection.BACKWARD })
  @IsOptional()
  @IsEnum(CursorDirection)
  cursorDirection?: CursorDirection;
}

export function createCursorPaginatedResponse<T>(ItemType: { name: string }) {
  const name = `${ItemType.name}CursorPaginatedResponse`;

  @ObjectType(name, { isAbstract: true })
  abstract class CursorPaginatedResponseBase {
    @Field(() => [ItemType])
    items: T[];

    @Field(() => String, { nullable: true })
    nextCursorId: string | null;

    @Field(() => Date, { nullable: true })
    nextCursorCreatedAt: Date | null;

    @Field(() => Date, { nullable: true })
    @IsOptional()
    nextCursorDateParam?: Date | null;

    @Field(() => Int, { nullable: true })
    @IsOptional()
    nextCursorIntParam?: number | null;

    @Field(() => Boolean)
    hasMore: boolean;
  }

  return CursorPaginatedResponseBase;
}

export type CursorPaginatedResponse<T> = InstanceType<
  ReturnType<typeof createCursorPaginatedResponse<T>>
>;
