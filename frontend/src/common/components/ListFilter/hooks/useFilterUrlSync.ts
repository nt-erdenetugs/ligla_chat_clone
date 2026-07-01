import { type Dispatch, type SetStateAction } from 'react';

import urlHelpers from '~/common/components/ListFilter/urlHelpers';
import type { FilterOptionInput } from '~/generated/graphql/types';

export const getParamKey = (storageKey?: string) => (name: 'filters' | 'search') =>
  storageKey ? `${name}_${String(storageKey)}` : name;

export const setUrlFiltersAndSearch = ({
  paramKey = 'filters',
  searchKey = 'search',
  filters,
  searchValue,
  syncToUrl,
  setSearchParams,
  enqueueSnackbar,
  t_toasts,
}: {
  paramKey?: string;
  searchKey?: string;
  filters?: FilterOptionInput[];
  searchValue?: string;
  syncToUrl: boolean;
  setSearchParams: Dispatch<SetStateAction<URLSearchParams>> | ((next: URLSearchParams) => void);
  enqueueSnackbar?: (message: string, variants?: { variant: string }) => void;
  t_toasts?: (message: string) => string;
}) => {
  const { buildFiltersUpdater, applySetSearchParams } = urlHelpers;
  if (!syncToUrl) return;
  try {
    const updater = buildFiltersUpdater({
      paramKey,
      searchKey,
      filters,
      searchValue,
    });
    applySetSearchParams(
      setSearchParams as (
        next: URLSearchParams | ((previous: URLSearchParams) => URLSearchParams),
      ) => void,
      updater,
    );
  } catch (error) {
    console.error(error);
    if (enqueueSnackbar && t_toasts) {
      enqueueSnackbar(t_toasts('filter.error.saveFailed'), { variant: 'error' });
    }
  }
};

export default {
  getParamKey,
  setUrlFiltersAndSearch,
};
