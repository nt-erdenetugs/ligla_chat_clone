import type { Column } from '~/common/components/Elements';
import { ListFilterCondition, type ListFilterOption } from '~/common/constants';
import { type FilterOptionInput } from '~/generated/graphql/types';

export type FilterValue = string | number | boolean | null | undefined;

export interface ListFilterFormItem {
  enabled?: boolean;
  searchItem?: string | null;
  condition?: string | null;
  value?: FilterOptionInput['value'];
}

export interface NormalizedInput {
  searchItem: string;
  condition?: string;
  value: FilterOptionInput['value'];
  target?: Column<any>['filterType'];
}

const splitRangeString = (
  value: string,
): [FilterOptionInput['value'], FilterOptionInput['value']] | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const inner =
    trimmed.startsWith('[') && trimmed.endsWith(']') ? trimmed.slice(1, -1).trim() : trimmed;

  const sep = inner.includes(',') ? ',' : inner.includes('|') ? '|' : null;
  if (!sep) return null;
  const parts = inner.split(sep, 2).map((p) => p.trim());
  if (parts.length < 2) return null;
  return [parts[0], parts[1]] as [FilterOptionInput['value'], FilterOptionInput['value']];
};

const normalizeFilterValue = (
  value: FilterOptionInput['value'],
  target?: 'datetime' | 'number' | 'boolean' | 'string' | 'type' | 'isEnum',
): FilterValue => {
  if (value === null || value === undefined) return null;

  switch (target) {
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        const normalizedValue = value.trim().toLowerCase();
        if (normalizedValue === 'true') return true;
        if (normalizedValue === 'false') return false;
      }
      return null;

    case 'number':
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
      }
      if (typeof value === 'string' && value.trim() !== '') {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
      }
      return null;

    case 'datetime':
      if (typeof value === 'number') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
      }
      if (typeof value === 'string' && value.trim()) {
        const ts = Date.parse(value);
        return Number.isNaN(ts) ? null : new Date(ts).toISOString();
      }
      return null;

    default:
      break;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    const lower = normalizedValue.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
    return normalizedValue === '' ? null : normalizedValue;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;

  return null;
};

const extractRangeFromValue = (
  value: FilterOptionInput['value'],
): [FilterOptionInput['value'], FilterOptionInput['value']] | null => {
  if (Array.isArray(value) && value.length >= 2) {
    return [value[0], value[1]] as [FilterOptionInput['value'], FilterOptionInput['value']];
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if ('gte' in value || 'lte' in value || 'from' in value || 'to' in value) {
      return [value.gte ?? value.from ?? null, value.lte ?? value.to ?? null];
    }
  }

  if (typeof value === 'string') {
    const maybe = splitRangeString(value);
    if (maybe) return maybe;
  }

  return null;
};

export const normalizeFilters = <T = Record<string, never>>(
  filters?: Array<FilterOptionInput | ListFilterFormItem> | null,
  columns?: Column<T>[],
): FilterOptionInput[] => {
  if (!filters?.length) return [];

  const getTarget = (searchItem: string) =>
    columns?.find((column) => String(column.name) === searchItem)?.filterType;

  const normalized: NormalizedInput[] = filters
    .map((filter): NormalizedInput | null => {
      if (!filter || typeof filter !== 'object') return null;

      if ('searchItem' in filter) {
        const searchItem = String(filter.searchItem ?? '');
        if (!searchItem) return null;
        const target = getTarget(searchItem);
        return {
          searchItem,
          condition: filter.condition ?? undefined,
          value: filter.value as FilterOptionInput,
          target,
        };
      }

      const row = filter as ListFilterFormItem;
      if (!row.enabled || !row.searchItem) return null;

      const searchItem = String(row.searchItem);
      const target = getTarget(searchItem);
      return {
        searchItem,
        condition: row.condition ?? undefined,
        value: row.value as FilterOptionInput,
        target,
      };
    })
    .filter(Boolean) as NormalizedInput[];

  const result: FilterOptionInput[] = [];

  normalized.forEach(({ searchItem, condition, value, target }) => {
    if (
      condition === ListFilterCondition.IS_BLANK ||
      condition === ListFilterCondition.IS_PRESENT
    ) {
      result.push({ searchItem, condition, value: null });
      return;
    }

    if (value === null || value === undefined) return;

    const range = extractRangeFromValue(value);
    if (range) {
      const gte = normalizeFilterValue(range[0], target);
      const lte = normalizeFilterValue(range[1], target);
      if (gte !== null) result.push({ searchItem, condition: 'gte', value: gte });
      if (lte !== null) result.push({ searchItem, condition: 'lte', value: lte });
      return;
    }

    const normalizedValue = normalizeFilterValue(value, target);
    if (normalizedValue !== null) result.push({ searchItem, condition, value: normalizedValue });
  });

  return result;
};
export const base64UrlEncode = (input: string): string => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);
  const binaryStr = Array.from(bytes, (b) => String.fromCharCode(b)).join('');

  let b64: string;
  if (typeof btoa === 'function') {
    b64 = btoa(binaryStr);
  } else {
    b64 = Buffer.from(binaryStr, 'binary').toString('base64');
  }
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

export const base64UrlDecode = (value: string): string => {
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (base64.length % 4)) % 4;
  if (pad > 0) base64 += '='.repeat(pad);

  let binary: string;
  if (typeof atob === 'function') {
    binary = atob(base64);
  } else {
    binary = Buffer.from(base64, 'base64').toString('binary');
  }
  const bytes = new Uint8Array(Array.from(binary, (c: string) => c.charCodeAt(0)));
  return new TextDecoder().decode(bytes);
};

export const filtersToBase64Url = (filters?: FilterOptionInput[] | null): string => {
  if (!filters || !Array.isArray(filters) || filters.length === 0) return '';
  try {
    return base64UrlEncode(JSON.stringify(filters));
  } catch {
    return '';
  }
};

export const filtersFromBase64Url = (value?: string | null): FilterOptionInput[] | null => {
  if (!value) return null;
  try {
    const str = base64UrlDecode(value);
    const parsed = JSON.parse(str) as FilterOptionInput[];
    if (Array.isArray(parsed)) return parsed;
  } catch (error) {
    console.error(error);
  }
  return null;
};

export const parseFiltersFromUrl = (
  inputsOrSerialized?: FilterOptionInput[] | string | null,
  defaultSearchItemName?: string,
  onParseError?: (error?: Error) => void,
): ListFilterFormItem[] => {
  const mapInputsToForm = (inputs: FilterOptionInput[] = []) => {
    const map = new Map<string, FilterOptionInput[]>();

    inputs.forEach((input) => {
      const key = String(input.searchItem ?? defaultSearchItemName ?? '');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(input);
    });

    const result: ListFilterFormItem[] = [];

    map.forEach((items, searchItem) => {
      const gte = items.find((item) => item.condition === 'gte');
      const lte = items.find((item) => item.condition === 'lte');

      if (gte || lte) {
        const gteVal = gte ? normalizeFilterValue(gte.value, undefined) : null;
        const lteVal = lte ? normalizeFilterValue(lte.value, undefined) : null;
        result.push({
          enabled: true,
          searchItem,
          condition: 'range',
          value: {
            gte: gteVal,
            lte: lteVal,
          },
        });
      }

      items.forEach((item) => {
        if (item.condition === 'gte' || item.condition === 'lte') return;
        result.push({
          enabled: true,
          searchItem,
          condition: item.condition ?? 'equals',
          value: normalizeFilterValue(item.value, undefined) ?? null,
        });
      });
    });

    return result;
  };
  if (Array.isArray(inputsOrSerialized)) return mapInputsToForm(inputsOrSerialized);

  const serialized = typeof inputsOrSerialized === 'string' ? inputsOrSerialized : undefined;
  if (!serialized) return [];

  const isFilterOptionArray = (filter: FilterOptionInput[]): filter is FilterOptionInput[] =>
    Array.isArray(filter) &&
    filter.every((entry) => {
      if (typeof entry !== 'object' || entry === null) return false;
      const maybe = entry as Partial<FilterOptionInput>;
      return typeof maybe.searchItem === 'string';
    });

  const parseSerializedToArray = (serialized?: string | null): FilterOptionInput[] | null => {
    try {
      const decodedCompact = filtersFromBase64Url(serialized ?? undefined);
      if (decodedCompact) return decodedCompact;
    } catch (error) {
      console.error(error);
    }

    if (!serialized) return null;
    const tryParse = (
      candidate: string | undefined,
      remaining: number,
    ): FilterOptionInput[] | null => {
      if (!candidate || remaining <= 0) return null;

      try {
        const parsed = JSON.parse(candidate) as FilterOptionInput[];
        if (isFilterOptionArray(parsed)) return parsed;
      } catch (error) {
        console.error(error);
      }

      try {
        const decoded = decodeURIComponent(candidate);
        return tryParse(decoded, remaining - 1);
      } catch (error) {
        console.error(error);
        return null;
      }
    };

    return tryParse(serialized, 3);
  };

  const parsed = parseSerializedToArray(serialized);
  if (parsed) return mapInputsToForm(parsed);

  try {
    onParseError?.();
  } catch (error) {
    console.error(error);
  }

  return [];
};

export const normalizeColumnValue = (
  value: object | string | number | boolean | null | undefined,
): string => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).toLowerCase();
  }

  try {
    const searchValue = JSON.stringify(value);
    return searchValue.trim().toLowerCase();
  } catch {
    return '';
  }
};

export const matchesFilterColumnRow = (row: object, filters?: ListFilterOption[]): boolean => {
  if (!filters || filters.length === 0) return true;

  const getFieldByPath = (
    row: object,
    path: string,
  ): object | string | number | boolean | undefined => {
    if (!row || typeof row !== 'object') return;
    const parts = String(path).split('.').filter(Boolean);
    let current: unknown = row;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      const asRecord = current as Record<string, unknown>;
      current = asRecord[part];
    }
    return current as object | string | number | boolean | undefined;
  };

  return filters.reduce<boolean>((acc, filter) => {
    if (!acc) return false;
    if (!filter) return acc;

    const condition = String(filter.condition ?? '').toLowerCase();
    const searchItem = String(filter.searchItem ?? '').trim();
    const filterValue = normalizeColumnValue(filter.value);

    const specificField = getFieldByPath(row, searchItem);
    const targetField = normalizeColumnValue(
      specificField !== undefined && specificField !== null ? specificField : row,
    );

    let result = true;
    switch (condition) {
      case 'equals':
        result = targetField === filterValue;
        break;
      case 'not equals':
        result = targetField !== filterValue;
        break;
      case 'contains':
        result = targetField.includes(filterValue);
        break;
      case 'does not contain':
        result = !targetField.includes(filterValue);
        break;
      case 'starts with':
        result = targetField.startsWith(filterValue);
        break;
      case 'ends with':
        result = targetField.endsWith(filterValue);
        break;
      case 'is blank':
        result = targetField === '';
        break;
      case 'is present':
        result = targetField !== '';
        break;
      default:
        result = true;
    }

    return acc && Boolean(result);
  }, true);
};
