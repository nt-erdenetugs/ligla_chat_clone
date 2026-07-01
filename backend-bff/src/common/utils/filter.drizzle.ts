import { BadRequestException } from '@nestjs/common';

import { SQL, and, or, eq, ne, ilike, gte, lte, not, isNotNull } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';
import { I18nService } from 'nestjs-i18n';

import * as shared from '@@/drizzle/public/schema';
import { TenantTables } from '@@/drizzle/tenant/schema';

import { FILTER_ALLOWED_CONDITIONS, FILTER_EXTRA_ALLOWED_FIELDS } from '../constants';

import { parseDateInput } from './date';

export type FilterOption = { searchItem?: string; condition?: string; value?: string };

export type SearchField =
  | string
  | {
      field: string;
      query?: SQL | ((searchValue: string) => SQL);
      refineQuery?: (option: FilterOption) => SQL | null;
    };

export type FilterableTable =
  | TenantTables['attribute']
  | TenantTables['tags']
  | TenantTables['chatAssignFilter']
  | TenantTables['store']
  | TenantTables['team']
  | TenantTables['user'];

export function buildFieldFilter(
  column: PgColumn,
  condition: string,
  value?: string | number | boolean,
  fieldName?: string,
  i18n?: I18nService,
): SQL | undefined {
  if (
    (value === null || value === undefined) &&
    condition !== 'is blank' &&
    condition !== 'is present'
  )
    return undefined;

  switch (condition) {
    case 'contains': {
      const valueToString = value === null || value === undefined ? value : String(value);
      if (valueToString === null || valueToString === undefined) return undefined;
      return ilike(column, `%${valueToString}%`);
    }
    case 'does not contain': {
      const valueToString = value === null || value === undefined ? value : String(value);
      if (valueToString === null || valueToString === undefined) return undefined;
      return not(ilike(column, `%${valueToString}%`));
    }
    case 'equals': {
      const parsedDateInput = parseDateInput(value);
      if (parsedDateInput && fieldName) {
        const start = new Date(parsedDateInput);
        start.setSeconds(0, 0);
        const next = new Date(start.getTime() + 60 * 1000);
        return and(gte(column, start), lte(column, next));
      }
      const intVal =
        typeof value === 'number' && Number.isInteger(value) ? (value as number) : undefined;
      if (intVal !== undefined) return eq(column, intVal);
      const finalEquals = parsedDateInput ?? value;
      if (typeof finalEquals === 'string' && fieldName) {
        const key = String(fieldName);
        const keyLower = key.toLowerCase();
        if (key === 'roleType' || keyLower.endsWith('status')) {
          return eq(column, finalEquals.toUpperCase());
        }
      }
      return eq(column, finalEquals);
    }
    case 'not equals': {
      const parsedNe = parseDateInput(value);
      if (parsedNe && fieldName) {
        const start = new Date(parsedNe);
        start.setSeconds(0, 0);
        const next = new Date(start.getTime() + 60 * 1000);
        return not(and(gte(column, start), lte(column, next))!);
      }
      const intValNe =
        typeof value === 'number' && Number.isInteger(value) ? (value as number) : undefined;
      if (intValNe !== undefined) return ne(column, intValNe);
      const finalNe = parsedNe ?? value;
      if (typeof finalNe === 'string' && fieldName) {
        const keyNe = String(fieldName);
        const keyNeLower = keyNe.toLowerCase();
        if (keyNe === 'roleType' || keyNeLower.endsWith('status')) {
          return ne(column, finalNe.toUpperCase());
        }
      }
      return ne(column, finalNe);
    }
    case 'starts with': {
      const v = value === null || value === undefined ? value : String(value);
      if (v === null || v === undefined) return undefined;
      return ilike(column, `${v}%`);
    }
    case 'ends with': {
      const v = value === null || value === undefined ? value : String(value);
      if (v === null || v === undefined) return undefined;
      return ilike(column, `%${v}`);
    }
    case 'is blank':
      return or(eq(column, ''), eq(column, ' '));

    case 'is present':
      return and(ne(column, ''), isNotNull(column));

    case 'gte': {
      const parsed = parseDateInput(value);
      const intValGte =
        typeof value === 'number' && Number.isInteger(value) ? (value as number) : undefined;
      return gte(column, parsed ?? intValGte ?? value);
    }
    case 'lte': {
      const parsed = parseDateInput(value);
      const intValLte =
        typeof value === 'number' && Number.isInteger(value) ? (value as number) : undefined;
      return lte(column, parsed ?? intValLte ?? value);
    }
    default:
      throw new BadRequestException(i18n?.t('errors.invalidFilterCondition'));
  }
}

export function buildRefineClause(
  option: FilterOption,
  schemaTable: FilterableTable | typeof shared.organization,
  i18n?: I18nService,
): SQL | null {
  const { searchItem, condition, value } = option;
  if (!searchItem || !condition) return null;
  if (!FILTER_ALLOWED_CONDITIONS.has(condition)) {
    throw new BadRequestException(
      i18n?.t('errors.filter.invalidFilterCondition', { args: { condition } }),
    );
  }

  const column = (schemaTable as Record<string, any>)[searchItem];
  if (!column || typeof column !== 'object' || !('dataType' in column)) {
    throw new BadRequestException(
      i18n?.t('errors.filter.invalidFilterField', { args: { field: searchItem } }),
    );
  }

  const fieldFilter = buildFieldFilter(
    column as PgColumn,
    condition,
    value as any,
    searchItem,
    i18n,
  );
  return fieldFilter ?? null;
}

export function buildWhereClause(
  params: {
    organizationName?: string;
    refineConditions?: FilterOption[];
    searchValue?: string;
    searchFields?: SearchField[];
  },
  schemaTable: FilterableTable,
  i18n?: I18nService,
): SQL | undefined {
  const { organizationName, refineConditions, searchValue, searchFields } = params;

  // For hypervisor users, organizationName may be undefined/empty - this is allowed
  // They can query across all organizations
  const hasOrganizationFilter = organizationName?.trim();

  if (hasOrganizationFilter && !('organizationName' in schemaTable)) {
    throw new Error('Schema table must have an organizationName column');
  }

  const normalizedSearchFields = (searchFields ?? []).map((field) =>
    typeof field === 'string' ? { field } : field,
  );
  const allowedFields = normalizedSearchFields.map((field) => field.field).filter(Boolean);
  const mergedAllowed = Array.from(
    new Set([...allowedFields, ...Array.from(FILTER_EXTRA_ALLOWED_FIELDS)]),
  );

  if (refineConditions && refineConditions.length) {
    const invalid = refineConditions.filter(
      (condition) =>
        !condition?.searchItem || !mergedAllowed.includes(condition.searchItem as string),
    );
    if (invalid.length) {
      throw new BadRequestException(i18n?.t('errors.filter.invalidFilterField'));
    }
  }

  const refineClauses = refineConditions
    ? refineConditions
        .map((refineCondition) => {
          const searchItem = refineCondition?.searchItem;
          if (!searchItem) return null;

          const column = (schemaTable as Record<string, any>)[searchItem];
          if (column && typeof column === 'object' && 'dataType' in column) {
            return buildRefineClause(refineCondition, schemaTable, i18n);
          }

          const customRefine = normalizedSearchFields.find((field) => field.field === searchItem);
          if (!customRefine?.refineQuery) {
            throw new BadRequestException(i18n?.t('errors.filter.invalidFilterField'));
          }

          return customRefine.refineQuery(refineCondition);
        })
        .filter(Boolean)
    : [];

  const fields = normalizedSearchFields;
  const searchClause = searchValue
    ? or(
        ...fields
          .map((field) => {
            if (typeof field === 'string') {
              const column = (schemaTable as Record<string, any>)[field];
              if (!column || typeof column !== 'object' || !('dataType' in column)) {
                return undefined;
              }
              return ilike(column as PgColumn, `%${searchValue}%`);
            }

            if (field.query) {
              return typeof field.query === 'function' ? field.query(searchValue) : field.query;
            }

            const column = (schemaTable as Record<string, any>)[field.field];
            if (!column || typeof column !== 'object' || !('dataType' in column)) return undefined;
            return ilike(column as PgColumn, `%${searchValue}%`);
          })
          .filter(Boolean),
      )
    : null;

  const andClauses: SQL[] = [];

  // Only filter by organization if organizationName is provided (not hypervisor)
  if (hasOrganizationFilter) {
    andClauses.push(
      eq((schemaTable as Record<string, any>).organizationName as PgColumn, organizationName),
    );
  }

  if (refineClauses.length) {
    andClauses.push(...(refineClauses as SQL[]));
  }
  if (searchClause) {
    andClauses.push(searchClause);
  }

  return andClauses.length > 0 ? and(...andClauses) : undefined;
}

export function buildHypervisorWhere(
  params: {
    refineConditions?: FilterOption[];
    searchValue?: string;
    searchFields?: SearchField[];
  },
  schemaTable: typeof shared.organization,
  i18n?: I18nService,
): SQL | undefined {
  const { refineConditions, searchValue, searchFields } = params;

  const normalizedSearchFields = (searchFields ?? []).map((field) =>
    typeof field === 'string' ? { field } : field,
  );
  const allowedFields = normalizedSearchFields.map((field) => field.field).filter(Boolean);
  const mergedAllowed = Array.from(
    new Set([...allowedFields, ...Array.from(FILTER_EXTRA_ALLOWED_FIELDS)]),
  );

  if (refineConditions && refineConditions.length) {
    const invalid = refineConditions.filter(
      (condition) =>
        !condition?.searchItem || !mergedAllowed.includes(condition.searchItem as string),
    );
    if (invalid.length) {
      throw new BadRequestException(i18n?.t('errors.filter.invalidFilterField'));
    }
  }

  const refineClauses = refineConditions
    ? refineConditions
        .map((refineCondition) => {
          const searchItem = refineCondition?.searchItem;
          if (!searchItem) return null;

          const column = (schemaTable as Record<string, any>)[searchItem];
          if (column && typeof column === 'object' && 'dataType' in column) {
            return buildRefineClause(refineCondition, schemaTable, i18n);
          }

          const customRefine = normalizedSearchFields.find((field) => field.field === searchItem);
          if (!customRefine?.refineQuery) {
            throw new BadRequestException(i18n?.t('errors.filter.invalidFilterField'));
          }

          return customRefine.refineQuery(refineCondition);
        })
        .filter(Boolean)
    : [];

  const fields = normalizedSearchFields;
  const searchClause = searchValue
    ? or(
        ...fields
          .map((field) => {
            if (typeof field === 'string') {
              const column = (schemaTable as Record<string, any>)[field];
              if (!column || typeof column !== 'object' || !('dataType' in column)) {
                return undefined;
              }
              return ilike(column as PgColumn, `%${searchValue}%`);
            }

            if (field.query) {
              return typeof field.query === 'function' ? field.query(searchValue) : field.query;
            }

            const column = (schemaTable as Record<string, any>)[field.field];
            if (!column || typeof column !== 'object' || !('dataType' in column)) return undefined;
            return ilike(column as PgColumn, `%${searchValue}%`);
          })
          .filter(Boolean),
      )
    : null;

  const andClauses: SQL[] = [];

  if (refineClauses.length) {
    andClauses.push(...(refineClauses as SQL[]));
  }
  if (searchClause) {
    andClauses.push(searchClause);
  }

  if (andClauses.length === 0) return undefined;

  return and(...andClauses);
}
