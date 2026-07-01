import { useCallback, useMemo, useState } from 'react';

import {
  normalizeColumnValue,
  matchesFilterColumnRow,
} from '~/common/components/ListFilter/utils/match';
import type { FilterOptionInput } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks/useTranslation';

export const useColumnFilter = <T extends object | string | number | null>(
  rows: T[] | null,
  entryKey?: string | null,
  onFilterApply?: (filters?: FilterOptionInput[], searchValue?: string) => void,
  onFilterReset?: () => void,
) => {
  const { t_errors } = useTranslation();

  const [columnFilters, setColumnFilters] = useState<FilterOptionInput[] | null>(null);
  const [columnSearchValue, setColumnSearchValue] = useState<string | null>(null);

  const handleColumnFilterApply = useCallback(
    (filters?: FilterOptionInput[], searchValue?: string) => {
      setColumnFilters(filters && filters.length ? filters : null);
      setColumnSearchValue(searchValue && searchValue.trim() ? searchValue.trim() : null);
      if (onFilterApply) void onFilterApply(filters, searchValue);
    },
    [onFilterApply],
  );

  const handleColumnFilterReset = useCallback(() => {
    setColumnFilters(null);
    setColumnSearchValue(null);
    if (onFilterReset) onFilterReset();
  }, [onFilterReset]);

  const filteredRows = useMemo(() => {
    if (!rows) return rows;

    const hasFilters = Boolean(columnFilters && columnFilters.length);
    const normalizedSearchValue = columnSearchValue?.trim()
      ? normalizeColumnValue(columnSearchValue)
      : null;

    if (!hasFilters && !normalizedSearchValue) return rows;

    const rowMatchesFilter = (row: T) => {
      if (hasFilters && normalizedSearchValue) {
        const isStrictMatchPage = entryKey === 'surveyColumns' || entryKey === 'memberFeedColumns';

        const filters = columnFilters as FilterOptionInput[];
        const search = normalizedSearchValue;

        if (isStrictMatchPage) {
          return (
            Boolean(matchesFilterColumnRow(row as Record<string, unknown>, filters)) &&
            Boolean(normalizeColumnValue(row).includes(search))
          );
        }
        return (
          Boolean(matchesFilterColumnRow(row as Record<string, unknown>, filters)) ||
          Boolean(normalizeColumnValue(row).includes(search))
        );
      }

      if (hasFilters)
        return Boolean(
          matchesFilterColumnRow(
            row as Record<string, unknown>,
            columnFilters as FilterOptionInput[],
          ),
        );
      if (normalizedSearchValue)
        return Boolean(normalizeColumnValue(row).includes(normalizedSearchValue));
      return true;
    };

    return rows.filter(rowMatchesFilter);
  }, [rows, columnFilters, columnSearchValue, entryKey]);

  const noMatchMessage = useMemo(() => {
    const key = String(entryKey ?? '');
    if (key === 'memberFeedColumns') return t_errors('memberFeedNotFound');
    if (key === 'surveyColumns') return t_errors('surveyNotFound');
    return null;
  }, [entryKey, t_errors]);

  return {
    filteredRows,
    columnFilters,
    columnSearchValue,
    handleColumnFilterApply,
    handleColumnFilterReset,
    setColumnFilters,
    setColumnSearchValue,
    noMatchMessage,
  };
};
