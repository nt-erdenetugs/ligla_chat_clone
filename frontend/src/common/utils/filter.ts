import { type ListFilterOption } from '../constants';

export const normalizeValue = (
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

export const matchesFilterRow = (row: object, filters?: ListFilterOption[]): boolean => {
  if (!filters || filters.length === 0) return true;

  const getTopField = (row: object, key: string): object | undefined => {
    if (!row || typeof row !== 'object') return;
    try {
      return (row as Record<string, object | undefined>)[key];
    } catch {
      return;
    }
  };

  return filters.reduce<boolean>((acc, filter) => {
    if (!acc) return false;
    if (!filter) return acc;

    const condition = String(filter.condition ?? '').toLowerCase();
    const searchItem = String(filter.searchItem ?? '').trim();
    const filterValue = normalizeValue(filter.value);

    const targetField =
      searchItem === 'name'
        ? normalizeValue(getTopField(row, 'name'))
        : searchItem === 'alias'
          ? normalizeValue(getTopField(row, 'alias'))
          : normalizeValue(row);

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
