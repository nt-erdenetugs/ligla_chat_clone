import type { Column } from '~/common/components/Elements';
import { ListFilterCondition } from '~/common/constants';
import type { FilterOptionInput } from '~/generated/graphql/types';

import { decode } from './encode';
import { extractRangeFromValue } from './split';

export type FilterValue = string | number | boolean | null | undefined;
export interface ListFilterFormItem {
  enabled?: boolean;
  searchItem?: string | null;
  condition?: string | null;
  value?: FilterOptionInput['value'];
}

const groupBySearchItem = (inputs: FilterOptionInput[], defaultName?: string) => {
  const map = new Map<string, FilterOptionInput[]>();

  inputs.forEach((input) => {
    const key = String(input.searchItem ?? defaultName ?? '');
    const group = map.get(key) ?? [];
    group.push(input);
    map.set(key, group);
  });

  return map;
};

const isFilterOptionArray = (value: FilterOptionInput[]) =>
  Array.isArray(value) &&
  value.every(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      'searchItem' in entry &&
      typeof (entry as { searchItem?: string | null }).searchItem === 'string',
  );

const recursiveJsonParse = (candidate: string, depth: number): FilterOptionInput[] | null => {
  if (!candidate || depth <= 0) return null;
  try {
    const parsed = JSON.parse(candidate) as FilterOptionInput[];
    if (isFilterOptionArray(parsed)) return parsed;
  } catch (error) {
    console.error('Failed to parse JSON:', { error, candidate });
  }

  try {
    return recursiveJsonParse(decodeURIComponent(candidate), depth - 1);
  } catch {
    return null;
  }
};

const parseSerializedToArray = (serialized?: string | null): FilterOptionInput[] | null => {
  if (!serialized) return null;
  let decoded = '';
  try {
    decoded = decode(serialized);
  } catch (error) {
    console.error('Failed to base64-decode filters, falling back to JSON parse', error);
    decoded = '';
  }

  if (decoded) {
    try {
      const parsed = JSON.parse(decoded) as FilterOptionInput[];
      if (isFilterOptionArray(parsed)) return parsed;
    } catch (error) {
      console.error('Failed to parse decoded filters:', {
        error,
        decoded,
      });
    }
  }
  return recursiveJsonParse(serialized, 3);
};

const mapInputsToForm = (
  inputs: FilterOptionInput[],
  defaultSearchItemName?: string,
): ListFilterFormItem[] => {
  const grouped = groupBySearchItem(inputs, defaultSearchItemName);
  const result: ListFilterFormItem[] = [];

  grouped.forEach((items, searchItem) => {
    const gte = items.find((i) => i.condition === 'gte');
    const lte = items.find((i) => i.condition === 'lte');

    if (gte || lte) {
      result.push({
        enabled: true,
        searchItem,
        condition: 'range',
        value: {
          gte: normalizeFilterValue(gte?.value),
          lte: normalizeFilterValue(lte?.value),
        },
      });
    }

    items
      .filter((i) => i.condition !== 'gte' && i.condition !== 'lte')
      .forEach((item) => {
        result.push({
          enabled: true,
          searchItem,
          condition: item.condition ?? 'equals',
          value: normalizeFilterValue(item.value) ?? null,
        });
      });
  });

  return result;
};

export const parseFiltersFromUrl = (
  inputsOrSerialized?: FilterOptionInput[] | string | null,
  defaultSearchItemName?: string,
  onParseError?: (error?: Error) => void,
): ListFilterFormItem[] => {
  if (Array.isArray(inputsOrSerialized)) {
    return mapInputsToForm(inputsOrSerialized, defaultSearchItemName);
  }

  const serialized = typeof inputsOrSerialized === 'string' ? inputsOrSerialized : undefined;

  if (!serialized) return [];

  const parsed = parseSerializedToArray(serialized);

  if (parsed) {
    return mapInputsToForm(parsed, defaultSearchItemName);
  }
  onParseError?.();

  return [];
};

export const normalizeFilterValue = (
  value: FilterOptionInput['value'],
  target?: 'datetime' | 'number' | 'boolean' | 'string' | 'type' | 'isEnum',
): FilterValue => {
  if (value == null) return null;

  switch (target) {
    case 'boolean':
      return parseBoolean(value);

    case 'number':
      return parseNumber(value);

    case 'datetime':
      return parseDate(value);
  }

  return defaultNormalize(value);
};

const parseBoolean = (value: FilterOptionInput['value']): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true') return true;
    if (v === 'false') return false;
  }
  return null;
};

const parseNumber = (value: FilterOptionInput['value']): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  if (typeof value === 'string' && value.trim()) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  return null;
};

const parseDate = (value: FilterOptionInput['value']): string | null => {
  const ts =
    typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : NaN;

  if (Number.isNaN(ts)) return null;

  return new Date(ts).toISOString();
};

const defaultNormalize = (value: FilterOptionInput['value']): FilterValue => {
  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) return null;
    if (trimmed.toLowerCase() === 'true') return true;
    if (trimmed.toLowerCase() === 'false') return false;

    return trimmed;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return null;
};

export const normalizeFilters = <T = Record<string, never>>(
  filters?: Array<FilterOptionInput | ListFilterFormItem> | null,
  columns?: Column<T>[],
): FilterOptionInput[] => {
  if (!filters?.length) return [];

  const getTarget = (name: string) => columns?.find((c) => String(c.name) === name)?.filterType;

  const normalized = filters
    .map((filter) => normalizeFilterRow(filter, getTarget))
    .filter(Boolean) as {
    searchItem: string;
    condition?: string;
    value: FilterOptionInput['value'];
    target?: Column<T>['filterType'];
  }[];

  const result: FilterOptionInput[] = [];

  normalized.forEach(({ searchItem, condition, value, target }) => {
    if (value == null) {
      if (
        condition === ListFilterCondition.IS_BLANK ||
        condition === ListFilterCondition.IS_PRESENT
      ) {
        result.push({ searchItem, condition, value: null });
      }
      return;
    }

    const range = extractRangeFromValue(value);

    if (range) {
      const gte = normalizeFilterValue(range[0], target);
      const lte = normalizeFilterValue(range[1], target);

      if (gte !== null) result.push({ searchItem, condition: 'gte', value: gte });
      if (lte !== null) result.push({ searchItem, condition: 'lte', value: lte });
      return;
    }

    const normalizedValue = normalizeFilterValue(value, target);
    if (normalizedValue !== null) {
      result.push({ searchItem, condition, value: normalizedValue });
    }
  });

  return result;
};

const normalizeFilterRow = <T>(
  filter: FilterOptionInput | ListFilterFormItem | null | undefined,
  getTarget: (name: string) => Column<T>['filterType'] | undefined,
) => {
  if (!filter || typeof filter !== 'object') return null;

  const rec = filter as Record<string, unknown>;
  const searchItemRaw = rec.searchItem;
  if (typeof searchItemRaw !== 'string' || !searchItemRaw) return null;
  const searchItem = searchItemRaw;

  if ('enabled' in rec && rec.enabled === false) return null;

  const condition = typeof rec.condition === 'string' ? rec.condition : undefined;
  const value = rec.value;

  return {
    searchItem,
    condition,
    value,
    target: getTarget(searchItem),
  };
};
