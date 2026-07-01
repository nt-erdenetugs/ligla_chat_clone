import { SQL, sql } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';

export const buildJsonObject = <TTable extends PgTable>(
  columns: Record<string, any>,
): SQL<TTable['$inferSelect']> => {
  const pairs = Object.entries(columns).flatMap(([key, col]) => [sql.raw(`'${key}'`), col]);
  return sql`json_build_object(${sql.join(pairs, sql`, `)})` as SQL<TTable['$inferSelect']>;
};

export const normalizeDateTime = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/(\.\d{3})\d+/, '$1').replace(/\+00:00$/, 'Z');
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};
