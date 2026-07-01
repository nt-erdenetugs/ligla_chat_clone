import { useMemo } from 'react';

import type { ListFilterFormItem } from '~/common/components/ListFilter/util';
import { ListFilterCondition } from '~/common/constants';

export const computeCountFromFilters = ({
  filters,
  searchParams,
  getParamKey,
  parseFilters,
  watchedFilters,
}: {
  filters?: ListFilterFormItem[];
  searchParams: URLSearchParams;
  getParamKey: (name: 'filters' | 'search') => string;
  parseFilters: (search?: string) => ListFilterFormItem[];
  watchedFilters: ListFilterFormItem[];
}) => {
  let baseFilter: ListFilterFormItem[] | undefined = filters;
  if (!baseFilter) {
    const urlFilter = searchParams.get(getParamKey('filters')) ?? undefined;
    if (urlFilter) {
      baseFilter = parseFilters(urlFilter);
    } else {
      baseFilter = watchedFilters;
    }
  }

  return (baseFilter || []).filter((filter) => {
    if (!filter) return false;
    if (!filter.enabled) return false;
    if (
      filter.condition === ListFilterCondition.IS_BLANK ||
      filter.condition === ListFilterCondition.IS_PRESENT
    ) {
      return true;
    }
    if (filter.value === null || filter.value === undefined) return false;
    return true;
  }).length;
};

export const useComputedCountFromFilters = ({
  filters,
  searchParams,
  getParamKey,
  parseFilters,
  watchedFilters,
}: {
  filters?: ListFilterFormItem[];
  searchParams: URLSearchParams;
  getParamKey: (name: 'filters' | 'search') => string;
  parseFilters: (search?: string) => ListFilterFormItem[];
  watchedFilters: ListFilterFormItem[];
}) => {
  const searchParamsString = searchParams.toString();

  return useMemo(() => {
    const serializedParams = new URLSearchParams(searchParamsString);
    return computeCountFromFilters({
      filters,
      searchParams: serializedParams,
      getParamKey,
      parseFilters,
      watchedFilters,
    });
  }, [filters, searchParamsString, getParamKey, parseFilters, watchedFilters]);
};

export default useComputedCountFromFilters;
