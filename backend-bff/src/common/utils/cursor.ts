import { SQL, and, or, eq, lt, gt, asc, desc } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';

import * as schema from '@@/drizzle/schema';
import { TenantTables } from '@@/drizzle/tenant/schema';

import { CursorDirection, CursorPaginationArgs } from '../dto/pagination.args';

export type CursorPaginatedTables =
  | typeof schema.chatActivity
  | TenantTables['chat']
  | typeof schema.chatMessage
  | TenantTables['tags']
  | TenantTables['user']
  | TenantTables['store'];

export const buildCursorConditions = <T extends CursorPaginatedTables>(
  table: T,
  {
    cursorId,
    cursorCreatedAt,
    cursorDateParam,
    cursorIntParam,
    cursorDirection,
  }: Omit<CursorPaginationArgs, 'take'>,
  cursorDateKey?: keyof T,
  cursorIntKey?: keyof T,
) => {
  const whereConditions: (SQL | undefined)[] = [];
  const orderByConditions: SQL[] = [];

  const comparisonFilter = cursorDirection === CursorDirection.FORWARD ? gt : lt;
  const sortFn = cursorDirection === CursorDirection.FORWARD ? asc : desc;

  if (cursorIntParam !== undefined && cursorIntKey) {
    const intColumn = table[cursorIntKey] as PgColumn;

    orderByConditions.push(sortFn(intColumn));
    orderByConditions.push(sortFn(table.createdAt));
    orderByConditions.push(sortFn(table.id));

    // Only add where conditions if cursor is provided
    if (cursorId && cursorCreatedAt) {
      whereConditions.push(comparisonFilter(intColumn, cursorIntParam));

      whereConditions.push(
        and(eq(intColumn, cursorIntParam), comparisonFilter(table.createdAt, cursorCreatedAt)),
      );

      whereConditions.push(
        and(
          eq(intColumn, cursorIntParam),
          eq(table.createdAt, cursorCreatedAt),
          comparisonFilter(table.id, cursorId),
        ),
      );
    }
  } else if (cursorDateKey) {
    const dateColumn = table[cursorDateKey] as PgColumn;

    orderByConditions.push(sortFn(dateColumn));
    orderByConditions.push(sortFn(table.createdAt));
    orderByConditions.push(sortFn(table.id));

    // Only add where conditions if cursor is provided
    if (cursorId && cursorCreatedAt) {
      whereConditions.push(comparisonFilter(dateColumn, cursorDateParam));

      whereConditions.push(
        and(eq(dateColumn, cursorDateParam), comparisonFilter(table.createdAt, cursorCreatedAt)),
      );

      whereConditions.push(
        and(
          eq(dateColumn, cursorDateParam),
          eq(table.createdAt, cursorCreatedAt),
          comparisonFilter(table.id, cursorId),
        ),
      );
    }
  } else {
    orderByConditions.push(sortFn(table.createdAt));
    orderByConditions.push(sortFn(table.id));

    // Only add where conditions if cursor is provided
    if (cursorId && cursorCreatedAt) {
      whereConditions.push(comparisonFilter(table.createdAt, cursorCreatedAt));

      whereConditions.push(
        and(eq(table.createdAt, cursorCreatedAt), comparisonFilter(table.id, cursorId)),
      );
    }
  }

  return {
    where: whereConditions.length > 0 ? or(...whereConditions) : undefined,
    orderBy: orderByConditions,
  };
};

type CursorItem = { id: string; createdAt: Date };

export const getCursorArgs = <T extends CursorItem>(
  items: T[],
  take?: number,
  options?: {
    idKey?: keyof T;
    dateParamKey?: keyof T;
    intParamKey?: keyof T;
  },
): {
  items: T[];
  hasMore: boolean;
  nextCursorId: string | null;
  nextCursorCreatedAt: Date | null;
  nextCursorDateParam: Date | null;
  nextCursorIntParam: number | null;
} => {
  const { idKey, dateParamKey, intParamKey } = options || {};
  const hasMore = take !== undefined && items.length > take;

  // Remove the extra item if we have more results
  if (hasMore) {
    items.pop();
  }

  // The cursor should be the last item we're showing to the user
  const lastItemShown = hasMore && items.length > 0 ? items[items.length - 1] : null;

  const nextCursorId: string | null =
    hasMore && lastItemShown ? String(lastItemShown[idKey ? idKey : 'id']) : null;

  const nextCursorCreatedAt: Date | null =
    hasMore && lastItemShown ? (lastItemShown.createdAt as Date) : null;

  const nextCursorDateParam: Date | null =
    hasMore && lastItemShown && dateParamKey ? (lastItemShown[dateParamKey] as Date) : null;

  const nextCursorIntParam: number | null =
    hasMore && lastItemShown && intParamKey ? (lastItemShown[intParamKey] as number) : null;

  return {
    items,
    hasMore,
    nextCursorId,
    nextCursorCreatedAt,
    nextCursorDateParam,
    nextCursorIntParam,
  };
};
