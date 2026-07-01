import { useCallback, useState } from 'react';

import type { Column } from '~/common/components/Elements';
import { setUrlFiltersAndSearch } from '~/common/components/ListFilter/hooks/useFilterUrlSync';
import urlHelpers from '~/common/components/ListFilter/urlHelpers';
import {
  normalizeFilters,
  parseFiltersFromUrl,
  filtersToBase64Url,
} from '~/common/components/ListFilter/util';
import type { FilterOptionInput } from '~/generated/graphql/types';

export type ListFilterState = {
  refineConditions?: FilterOptionInput[] | undefined;
  searchValue?: string | undefined;
};

export type UseListFilterStateReturn = {
  filter: ListFilterState;
  setFilter: React.Dispatch<React.SetStateAction<ListFilterState>>;
  handleFilterApply: (filters?: FilterOptionInput[], searchValue?: string) => void;
  handleFilterReset: () => void;
};

const isEqualListFilterState = (
  previousState?: ListFilterState,
  nextState?: ListFilterState,
): boolean => {
  if (previousState === nextState) return true;

  const previousSearch = previousState?.searchValue ?? undefined;
  const nextSearch = nextState?.searchValue ?? undefined;
  if (previousSearch !== nextSearch) return false;

  const previousRef = previousState?.refineConditions;
  const nextRef = nextState?.refineConditions;

  if (!previousRef && !nextRef) return true;
  if (!previousRef || !nextRef) return false;
  if (previousRef.length !== nextRef.length) return false;

  return previousRef.every((previousFilter, i) => {
    const nextFilter = nextRef[i];
    if (!nextFilter) return false;
    if (previousFilter.searchItem !== nextFilter.searchItem) return false;
    if ((previousFilter.condition ?? '') !== (nextFilter.condition ?? '')) return false;
    return JSON.stringify(previousFilter.value) === JSON.stringify(nextFilter.value);
  });
};

const createInitialState = <T = unknown>(
  incomingSearchParams: URLSearchParams,
  paramKey: string,
  searchKey: string,
  columns?: Column<T>[],
  optionsSearchKey?: string,
) => {
  const searchParam =
    typeof window !== 'undefined' && window.location?.search
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams(incomingSearchParams.toString());

  const { effectiveParamKey, effectiveSearchKey } = urlHelpers.computeEffectiveKeys(
    searchParam,
    paramKey,
    searchKey,
  );

  const rawSearch =
    optionsSearchKey === undefined
      ? (searchParam.get(effectiveSearchKey) ?? searchParam.get('search'))
      : searchParam.get(searchKey);
  const searchValue = urlHelpers.safeDecode(rawSearch ?? undefined);

  const rawFilters =
    searchParam.get(effectiveParamKey) ??
    (paramKey === 'filters' ? searchParam.get('filters') : undefined);
  const parsedForm = parseFiltersFromUrl(rawFilters ?? undefined);

  const state: ListFilterState = {
    refineConditions:
      parsedForm && parsedForm.length > 0 ? normalizeFilters(parsedForm, columns) : undefined,
    searchValue,
  };

  return state;
};

export const useListFilterState = <T = Record<string, unknown>>(
  searchParams: URLSearchParams,
  setSearchParams?: (next: URLSearchParams) => void,
  options?: {
    paramKey?: string;
    searchKey?: string;
    syncToUrl?: boolean;
    columns?: Column<T>[];
  },
): UseListFilterStateReturn => {
  const paramKey = options?.paramKey ?? 'filters';
  const searchKey = options?.searchKey ?? 'search';
  const syncToUrl = options?.syncToUrl ?? true;
  const columns = options?.columns;

  const [filter, setFilter] = useState<ListFilterState>(() =>
    createInitialState(searchParams, paramKey, searchKey, columns, options?.searchKey),
  );

  const updateUrlParams = useCallback(
    (next: ListFilterState) => {
      if (typeof setSearchParams !== 'function') return;
      setUrlFiltersAndSearch({
        paramKey,
        searchKey,
        filters: next.refineConditions ?? undefined,
        searchValue: next.searchValue,
        _columns: columns,
        syncToUrl,
        setSearchParams,
      });
    },
    [paramKey, searchKey, columns, syncToUrl, setSearchParams],
  );

  const handleFilterApply = useCallback(
    (filters: FilterOptionInput[] = [], searchValue?: string) => {
      const refineConditions = normalizeFilters(filters, columns);
      const next: ListFilterState = {
        refineConditions: refineConditions.length ? refineConditions : undefined,
        searchValue: searchValue?.trim() ? searchValue : undefined,
      };
      setFilter((previous) => {
        if (isEqualListFilterState(previous, next)) {
          const encoded =
            next.refineConditions && next.refineConditions.length
              ? filtersToBase64Url(next.refineConditions)
              : '';
          const currentRaw = searchParams.get(paramKey) ?? '';
          if (currentRaw !== encoded) updateUrlParams(next);
          return previous;
        }

        updateUrlParams(next);
        return next;
      });
    },
    [columns, paramKey, searchParams, updateUrlParams],
  );

  const handleFilterReset = useCallback(() => {
    setFilter({});
    if (syncToUrl && typeof setSearchParams === 'function') {
      const updater = (prev: URLSearchParams) => {
        const next = new URLSearchParams(prev);
        const { effectiveParamKey, effectiveSearchKey } = urlHelpers.computeEffectiveKeys(
          next,
          paramKey,
          searchKey,
        );

        next.delete(effectiveParamKey);
        if (effectiveParamKey !== 'filters') next.delete('filters');

        next.delete(effectiveSearchKey);
        if (effectiveSearchKey !== 'search') next.delete('search');

        return next;
      };

      urlHelpers.applySetSearchParams(setSearchParams as any, updater);
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(paramKey);
          localStorage.removeItem(searchKey);
          if (paramKey.startsWith('filters_')) {
            const suffix = paramKey.slice('filters_'.length);
            localStorage.removeItem(`filters_${suffix}`);
            localStorage.removeItem(`search_${suffix}`);
          }
        }
      } catch (error) {
        console.error(error);
      }
    }
  }, [paramKey, searchKey, setSearchParams, syncToUrl]);

  return { filter, setFilter, handleFilterApply, handleFilterReset };
};

export default useListFilterState;
