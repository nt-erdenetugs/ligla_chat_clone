import { type EnqueueSnackbar } from 'notistack';

import { encode } from '~/common/components/ListFilter/utils/encode';
import type { ListFilterFormItem } from '~/common/components/ListFilter/utils/normalize';
import { parseFiltersFromUrl } from '~/common/components/ListFilter/utils/normalize';
import { ListFilterCondition } from '~/common/constants';
import type { FilterOptionInput } from '~/generated/graphql/types';

type TToasts = (s: string) => string;

const safeDecode = (raw?: string | null): string | undefined => {
  if (raw == null) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw ?? undefined;
  }
};

export const readFiltersAndSearchFromParams = ({
  searchParams,
  storageKey,
  defaultSearchItemName,
  enqueueSnackbar,
  t_toasts,
}: {
  searchParams: URLSearchParams;
  storageKey?: string;
  defaultSearchItemName: string;
  enqueueSnackbar?: EnqueueSnackbar;
  t_toasts?: TToasts;
}) => {
  const rawSearch =
    searchParams.get('search') ??
    (storageKey ? (searchParams.get(`search_${storageKey}`) ?? undefined) : undefined);

  const rawFilters =
    searchParams.get('filters') ??
    (storageKey ? (searchParams.get(`filters_${storageKey}`) ?? undefined) : undefined);

  const decodedSearch = safeDecode(rawSearch ?? undefined);
  const decodedFilters: ListFilterFormItem[] = parseFiltersFromUrl(
    rawFilters,
    defaultSearchItemName,
    () => {
      enqueueSnackbar?.(
        (t_toasts as TToasts)?.('filter.error.applyFailed') ?? 'filter.error.applyFailed',
        { variant: 'error' },
      );
    },
  );

  const count = (decodedFilters || []).filter((filter) => {
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

  return { decodedSearch, decodedFilters, count };
};

export const setFiltersAndSearchParams = ({
  filters,
  searchValue,
  setSearchParams,
  searchParams,
}: {
  filters?: FilterOptionInput[];
  searchValue?: string;
  setSearchParams?: (next: URLSearchParams) => void;
  searchParams?: URLSearchParams;
}): void => {
  if (typeof setSearchParams !== 'function') return;

  const params = new URLSearchParams(searchParams?.toString() ?? window.location.search);

  if (filters && filters.length > 0) {
    const encoded = encode(JSON.stringify(filters));
    if (encoded) params.set('filters', encoded);
  } else {
    for (const key of Array.from(params.keys())) {
      if (key.startsWith('filters')) params.delete(key);
    }
  }

  if (searchValue !== undefined && searchValue !== null && searchValue !== '') {
    params.set('search', searchValue);
  } else {
    for (const key of Array.from(params.keys())) {
      if (key.startsWith('search')) params.delete(key);
    }
  }

  setSearchParams(params);
};
