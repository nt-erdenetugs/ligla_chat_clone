import type { FilterOptionInput } from '~/generated/graphql/types';

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

export const matchesFilterColumnRow = (
  row: Record<string, unknown>,
  filters?: FilterOptionInput[],
): boolean => {
  if (!filters || filters.length === 0) return true;

  const getFieldByPath = (
    row: Record<string, unknown>,
    path: string,
  ): object | string | number | boolean | undefined => {
    if (!row || typeof row !== 'object') return;
    const parts = String(path).split('.').filter(Boolean);
    let current: Record<string, unknown> | string | number | boolean | undefined = row;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      const asRecord = current;
      current = asRecord[part] as Record<string, unknown> | string | number | boolean | undefined;
    }
    return current;
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

export default { normalizeColumnValue, matchesFilterColumnRow };
