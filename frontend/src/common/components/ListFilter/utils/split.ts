import type { FilterOptionInput } from '~/generated/graphql/types';

export const splitRangeString = (
  value: string,
): [FilterOptionInput['value'], FilterOptionInput['value']] | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const inner =
    trimmed.startsWith('[') && trimmed.endsWith(']') ? trimmed.slice(1, -1).trim() : trimmed;

  const sep = inner.includes(',') ? ',' : inner.includes('|') ? '|' : null;
  if (!sep) return null;

  const [start, end] = inner.split(sep, 2).map((p) => p.trim());
  if (!start || !end) return null;

  return [start, end];
};

export const extractRangeFromValue = (
  value: FilterOptionInput['value'],
): [FilterOptionInput['value'], FilterOptionInput['value']] | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const anyVal = value as Record<string, FilterOptionInput['value']>;
    if ('gte' in anyVal || 'lte' in anyVal) {
      return [anyVal['gte'] ?? null, anyVal['lte'] ?? null];
    }
  }

  if (Array.isArray(value) && value.length >= 2) {
    return [value[0], value[1]];
  }

  if (typeof value === 'string') {
    return splitRangeString(value);
  }

  return null;
};
