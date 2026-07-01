import type { Dispatch, SetStateAction } from 'react';

import { setFiltersAndSearchParams } from '~/common/components/ListFilter/hooks/useListFilterUrlSync';
import type { FilterOptionInput } from '~/generated/graphql/types';
export interface TeamSettingsResetArgs<T> {
  setFilterState: Dispatch<SetStateAction<T | undefined>>;
  setSearchParams?: (next: URLSearchParams) => void;
}

export function handleTeamSettingFilterReset<T>(args?: TeamSettingsResetArgs<T>): void {
  const setFilterState = args?.setFilterState;
  const setSearchParams = args?.setSearchParams;

  try {
    if (typeof setFilterState === 'function') {
      setFilterState(undefined);
    }
  } catch (err) {
    console.error('Failed to clear dialog filter state on reset', err);
  }

  try {
    if (typeof setSearchParams === 'function') {
      setFiltersAndSearchParams({ filters: undefined, searchValue: undefined, setSearchParams });
    }
  } catch (err) {
    console.error('Failed to clear filters/search from url on reset', err);
  }
}

export function handleTeamSettingFilterApply<
  T extends { refineConditions?: FilterOptionInput[]; searchValue?: string | undefined },
>(
  args: {
    filterState?: T;
    setFilterState: Dispatch<SetStateAction<T | undefined>>;
    setSearchParams?: (next: URLSearchParams) => void;
  },
  filters?: FilterOptionInput[],
  searchValue?: string,
): void {
  try {
    let nextRefineConditions = args.filterState?.refineConditions;
    if (filters !== undefined) {
      nextRefineConditions = filters && filters.length > 0 ? filters : undefined;
    }

    const nextSearchValue =
      searchValue === undefined ? args.filterState?.searchValue : (searchValue ?? undefined);

    const next = {
      refineConditions: nextRefineConditions,
      searchValue: nextSearchValue,
    } as T;
    args.setFilterState(next);

    try {
      if (typeof args.setSearchParams === 'function') {
        setFiltersAndSearchParams({
          filters: nextRefineConditions ?? undefined,
          searchValue: searchValue ?? undefined,
          setSearchParams: args.setSearchParams,
        });
      }
    } catch (err) {
      console.error('Failed to sync filters/search to url', err);
    }
  } catch (err) {
    console.error('handleFilterApply failed', err);
  }
}
