import { useEffect, useMemo, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useSnackbar } from 'notistack';
import { useForm, useFieldArray, useWatch, type SubmitHandler } from 'react-hook-form';
import { useSearchParams } from 'react-router';

import type { Column } from '~/common/components/Elements';
import {
  normalizeFilters,
  parseFiltersFromUrl,
} from '~/common/components/ListFilter/utils/normalize';
import { LIST_FILTER_MAX_LENGTH } from '~/common/constants';
import { usePaginationContext } from '~/context/PaginationContext';
import type { FilterOptionInput, FilterInput } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';

import { schema, type ListFilterForm } from './filterSchema';
import { useFilterPopover } from './useFilterPopover';
import { handleFormReset } from './useListFilterReset';
import type { SetURLSearchParams } from './useListFilterReset';
import { setFiltersAndSearchParams, readFiltersAndSearchFromParams } from './useListFilterUrlSync';

export const getFilterFromSearchParams = <T = Record<string, unknown>>(
  searchParams: URLSearchParams,
  options?: { paramKey?: string; columns?: Column<T>[] },
) => {
  const paramKey = options?.paramKey ?? 'filters';
  const columns = options?.columns;

  const storageKeyFromParam = paramKey?.startsWith('filters_')
    ? paramKey.slice('filters_'.length)
    : undefined;

  const params =
    typeof window !== 'undefined' && window.location?.search
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams(searchParams.toString());

  try {
    const defaultSearchItemName = String(
      (columns && columns.find((column) => column.filterable !== false)?.name) ?? '',
    );

    const { decodedSearch, decodedFilters } = readFiltersAndSearchFromParams({
      searchParams: params,
      defaultSearchItemName,
      storageKey: storageKeyFromParam,
    });

    const has = Boolean(
      (decodedFilters && decodedFilters.length > 0) || decodedSearch !== undefined,
    );
    if (!has) return undefined;

    return {
      refineConditions:
        decodedFilters && decodedFilters.length > 0
          ? normalizeFilters(decodedFilters, columns)
          : undefined,
      searchValue: decodedSearch,
    };
  } catch (err) {
    console.error(err);
    return undefined;
  }
};

export const useListFilterForm = <T = Record<string, never>>({
  columns,
  onApply,
  storageKey,
  onReset,
  externalAppliedFilters,
  externalSearchValue,
}: {
  columns: Column<T>[];
  onApply?: (filters: FilterOptionInput[], searchValue?: string) => void | Promise<void>;
  storageKey?: string;
  onReset?: () => void;
  externalAppliedFilters?: FilterOptionInput[];
  externalSearchValue?: string;
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const { t_toasts } = useTranslation();
  const { anchorEl, open, handleOpen, handleClose } = useFilterPopover();
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultSearchItem = useMemo(
    () => String(columns.find((column) => column.filterable !== false)?.name ?? ''),
    [columns],
  );
  let _decodedSearch: string | undefined = undefined;
  let _decodedFilters: FilterOptionInput[] | undefined = undefined;
  let _initialCount: number | undefined = undefined;
  if (storageKey) {
    const _initialParams = new URLSearchParams(searchParams.toString());
    const res = readFiltersAndSearchFromParams({
      searchParams: _initialParams,
      storageKey,
      defaultSearchItemName: defaultSearchItem,
    });
    _decodedSearch = res.decodedSearch;
    _decodedFilters = res.decodedFilters;
    _initialCount = res.count;
  }
  const { setPage } = usePaginationContext();
  const { control, handleSubmit, reset, setValue, getValues } = useForm<ListFilterForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      filters:
        _decodedFilters && _decodedFilters.length > 0
          ? _decodedFilters
          : [
              {
                enabled: true,
                searchItem: defaultSearchItem,
                condition: 'equals',
                value: null,
              },
            ],
      searchValue: _decodedSearch ?? '',
    },
  });

  const watchedFilters = useWatch({ control, name: 'filters' });
  const watchedSearchValue = useWatch({ control, name: 'searchValue' });
  const { fields, append } = useFieldArray({ control, name: 'filters' });
  const onResetRef = useRef(onReset);
  useEffect(() => {
    onResetRef.current = onReset;
  }, [onReset]);

  useEffect(() => {
    try {
      if (externalAppliedFilters !== undefined) {
        const parsed = parseFiltersFromUrl(externalAppliedFilters, defaultSearchItem);
        if (parsed && parsed.length > 0) {
          reset({ filters: parsed, searchValue: externalSearchValue ?? '' });
        } else {
          reset({
            filters: [
              {
                enabled: true,
                searchItem: defaultSearchItem,
                condition: 'equals',
                value: null,
              },
            ],
            searchValue: externalSearchValue ?? '',
          });
        }
      } else if (externalSearchValue !== undefined) {
        setValue('searchValue', externalSearchValue ?? '');
      }
    } catch (err) {
      console.error('Failed to sync externalAppliedFilters to form', err);
    }
  }, [externalAppliedFilters, externalSearchValue, defaultSearchItem, reset, setValue]);

  const initialAppliedFilterCount = useMemo(() => {
    if (typeof _initialCount === 'number') return _initialCount;
    if (_decodedFilters && _decodedFilters.length > 0) {
      try {
        const backendFilters: FilterOptionInput[] = normalizeFilters(
          _decodedFilters ?? [],
          columns,
        );
        return backendFilters.length ?? 0;
      } catch {
        return 0;
      }
    }
    return 0;
  }, [_decodedFilters, _initialCount, columns]);

  const [appliedFilterCount, setAppliedFilterCount] = useState<number>(initialAppliedFilterCount);

  const handleAddFilter = () => {
    if (fields.length >= LIST_FILTER_MAX_LENGTH) return;
    append({
      enabled: true,
      searchItem: defaultSearchItem,
      condition: 'equals',
      value: null,
    });
  };

  const handleResetFilters = () => {
    const maybeSetSearchParams: SetURLSearchParams | undefined = storageKey
      ? (setSearchParams as SetURLSearchParams)
      : undefined;

    setValue('searchValue', '');
    setValue('filters', [
      {
        enabled: true,
        searchItem: defaultSearchItem,
        condition: 'equals',
        value: null,
      },
    ]);
    setPage(1);
    setAppliedFilterCount(0);
    handleFormReset({
      onResetRef,
      handleClose,
      setSearchParams: maybeSetSearchParams,
      syncToUrl: Boolean(storageKey),
    });
  };

  const handleFiltersAndSearch = async (): Promise<void> => {
    const validateForm = (): Promise<FilterInput> =>
      new Promise((resolve, reject) => {
        const onValid: SubmitHandler<FilterInput> = (data) => resolve(data);
        const onInvalid = () => reject(new Error('validation'));
        handleSubmit(onValid, onInvalid)();
      });
    const visibleCount = (watchedFilters ?? []).filter((filter) => {
      if (!filter) return false;
      if (!filter.enabled) return false;
      if (filter.condition === 'is blank' || filter.condition === 'is present') {
        return true;
      }
      if (filter.value === null || filter.value === undefined) return false;
      return true;
    }).length;
    setAppliedFilterCount(visibleCount ?? 0);

    try {
      await validateForm();
      const searchValue = watchedSearchValue ?? '';
      setValue('searchValue', searchValue);
      const activeFilters = (watchedFilters ?? []).filter((filter) => Boolean(filter.enabled));
      const backendFilters: FilterOptionInput[] = normalizeFilters(
        (activeFilters as FilterOptionInput[]) ?? [],
        columns,
      );
      if (storageKey) {
        setFiltersAndSearchParams({
          filters: backendFilters,
          searchValue: watchedSearchValue ?? undefined,
          setSearchParams,
          searchParams: new URLSearchParams(searchParams.toString()),
        });
      }
      setPage(1);

      if (onApply) {
        try {
          await onApply(backendFilters ?? [], watchedSearchValue ?? '');
        } catch (err) {
          console.error('onApply failed', err);
          enqueueSnackbar(t_toasts('filter.error.saveFailed'), { variant: 'error' });
        } finally {
          handleClose();
        }
      }
      return;
    } catch (error) {
      console.error(error);
      enqueueSnackbar(t_toasts('filter.error.validation'), { variant: 'error' });
      return;
    }
  };

  return {
    control,
    fields,
    watchedFilters,
    handleFiltersAndSearch,
    handleResetFilters,
    handleAddFilter,
    handleOpen,
    handleClose,
    filterCount: appliedFilterCount,
    anchorEl,
    open,
    watchedSearchValue,
    getValues,
  };
};
