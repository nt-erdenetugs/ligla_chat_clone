import type { FilterOptionInput } from '~/generated/graphql/types';

import { filtersToBase64Url } from './util';

export const safeDecode = (raw?: string | null): string | undefined => {
  if (raw == null) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw ?? undefined;
  }
};

export const computeEffectiveKeys = (
  params: URLSearchParams,
  paramKey: string,
  searchKey: string,
): { effectiveParamKey: string; effectiveSearchKey: string } => {
  const keys = Array.from(params.keys());

  const effectiveParamKey =
    paramKey === 'filters'
      ? (keys.find((key) => key.startsWith('filters_')) ?? 'filters')
      : paramKey;

  const effectiveSearchKey = (() => {
    if (searchKey !== 'search') return searchKey;
    if (paramKey !== 'filters') return 'search';
    return keys.find((key) => key.startsWith('search_')) ?? 'search';
  })();

  return { effectiveParamKey, effectiveSearchKey };
};

const setOrDelete = (searchParams: URLSearchParams, key: string, value?: string | null) => {
  if (value === undefined || value === null) {
    searchParams.delete(key);
  } else {
    searchParams.set(key, value);
  }
};

export const buildFiltersUpdater = ({
  paramKey = 'filters',
  searchKey = 'search',
  filters,
  searchValue,
}: {
  paramKey?: string;
  searchKey?: string;
  filters?: FilterOptionInput[] | undefined;
  searchValue?: string | undefined;
}) => {
  return (previous: URLSearchParams) => {
    const next = new URLSearchParams(previous);
    const { effectiveParamKey, effectiveSearchKey } = computeEffectiveKeys(
      next,
      paramKey,
      searchKey,
    );

    if (filters && filters.length > 0) {
      const encoded = filtersToBase64Url(filters);
      setOrDelete(next, effectiveParamKey, encoded ?? undefined);
    } else {
      next.delete(effectiveParamKey);
    }

    if (searchValue !== undefined) {
      setOrDelete(next, effectiveSearchKey, searchValue);
    } else {
      next.delete(effectiveSearchKey);
    }
    if (effectiveParamKey !== 'filters') next.delete('filters');
    if (effectiveSearchKey !== 'search') next.delete('search');

    return next;
  };
};

export const applySetSearchParams = (
  setSearchParams: (
    next: URLSearchParams | ((previous: URLSearchParams) => URLSearchParams),
  ) => void,
  updater: (previous: URLSearchParams) => URLSearchParams,
) => {
  const run = () => {
    (setSearchParams as (fn: (p: URLSearchParams) => URLSearchParams) => void)(updater);
  };

  if (typeof queueMicrotask === 'function') queueMicrotask(run);
  else Promise.resolve().then(run);
};

export default {
  safeDecode,
  computeEffectiveKeys,
  buildFiltersUpdater,
  applySetSearchParams,
};
