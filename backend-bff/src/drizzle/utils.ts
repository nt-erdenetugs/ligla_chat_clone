import { sql } from 'drizzle-orm';

type PgEnum<T extends readonly string[]> = {
  enumValues: T;
};

export function inferEnum<T extends readonly string[]>(pgEnum: PgEnum<T>): { [K in T[number]]: K } {
  return Object.fromEntries(pgEnum.enumValues.map((v) => [v, v])) as any;
}

export type InferEnumType<T extends readonly string[]> = T[number];

type NumericColumn = {
  dataType: 'number';
  columnType:
    | 'PgInteger'
    | 'PgSmallInt'
    | 'PgBigInt53'
    | 'PgReal'
    | 'PgDoublePrecision'
    | 'PgNumeric';
};

export const increment = (column: NumericColumn, by: number = 1) => sql<number>`${column} + ${by}`;

export const decrement = (column: NumericColumn, by: number = 1) => sql<number>`${column} - ${by}`;

export const one = { one: sql`1` };
