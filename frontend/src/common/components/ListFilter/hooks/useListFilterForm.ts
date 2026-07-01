import { useCallback, useState, useEffect, useMemo, useRef } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useSnackbar } from 'notistack';
import { useForm, useFieldArray, useWatch, type SubmitHandler } from 'react-hook-form';
import { useSearchParams } from 'react-router';
import z from 'zod';

import type { Column } from '~/common/components/Elements';
import urlHelpers from '~/common/components/ListFilter/urlHelpers';
import {
  normalizeFilters,
  parseFiltersFromUrl,
  type ListFilterFormItem,
} from '~/common/components/ListFilter/util';
import {
  LIST_FILTER_MAX_LENGTH,
  ListFilterCondition,
  type ListFilterOption,
} from '~/common/constants';
import type { FilterOptionInput } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';

import {
  useFilterPopover,
  getParamKey as makeGetParamKey,
  setUrlFiltersAndSearch,
  parseFilters as parseFiltersFromString,
  computeCountFromFilters,
} from './index';

export const schema = z.object({
  filters: z.array(
    z.object({
      enabled: z.boolean(),
      searchItem: z.string().nullable(),
      condition: z.string().nullable(),
      value: z
        .union([
          z.object({
            type: z.literal('single'),
            value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
          }),
          z.object({
            type: z.literal('range'),
            from: z.string().nullable().optional(),
            to: z.string().nullable().optional(),
          }),
          z.object({ type: z.literal('blank') }),
          z.object({ type: z.literal('present') }),
          z.any(),
        ])
        .nullable(),
    }),
  ),
  searchValue: z.string().optional(),
});

export type ListFilterForm = z.infer<typeof schema>;

export const useListFilterForm = <T = Record<string, never>>({
  columns,
  onApply,
  storageKey,
  preserveSearchOnReset,
  onReset,
  syncToUrl = true,
  externalAppliedFilters,
  externalSearchValue,
}: {
  columns: Column<T>[];
  onApply?: (filters: ListFilterOption[], searchValue?: string) => void;
  storageKey?: string;
  preserveSearchOnReset?: boolean;
  onReset?: () => void;
  syncToUrl?: boolean;
  externalAppliedFilters?: FilterOptionInput[] | undefined;
  externalSearchValue?: string | undefined;
}) => {
  const defaultSearchItemName = String(
    columns.find((column) => column.filterable !== false)?.name ?? columns[0]?.name ?? '',
  );

  const getInitialSearchValue = (storageKey?: string): string => {
    try {
      if (typeof window === 'undefined') return '';

      const searchParams = new URLSearchParams(window.location.search);
      const namespaced = storageKey ? `search_${storageKey}` : 'search';
      let raw: string | null = searchParams.get(namespaced) ?? searchParams.get('search') ?? null;

      if (raw == null) {
        try {
          raw = localStorage.getItem(namespaced) ?? localStorage.getItem('search') ?? null;
        } catch {
          raw = null;
        }
      }
      const decoded = urlHelpers.safeDecode(raw ?? undefined);
      return decoded ?? '';
    } catch {
      return '';
    }
  };

  const initialSearchValue = getInitialSearchValue(storageKey);

  const { control, handleSubmit, reset, setValue } = useForm<ListFilterForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      filters: [
        {
          enabled: true,
          searchItem: defaultSearchItemName,
          condition: 'equals',
          value: null,
        },
      ],
      searchValue: initialSearchValue,
    },
  });

  const { anchorEl, open, handleOpen, handleClose } = useFilterPopover();
  const [searchParams, setSearchParams] = useSearchParams();
  const watchedFilters = useWatch({ control, name: 'filters' });
  const { enqueueSnackbar } = useSnackbar();
  const { t_toasts } = useTranslation();
  const { fields, append } = useFieldArray({ control, name: 'filters' });
  const [filterCount, setFilterCount] = useState<number>(0);

  const lastAppliedRef = useRef<string | null>(null);
  const mountedRef = useRef(false);
  const suppressNextEffectExpectedKeyRef = useRef<string | null>(null);
  const suppressNextEffectApplyRef = useRef(false);
  const getParamKey = useMemo(() => makeGetParamKey(storageKey), [storageKey]);

  const parseFilters = useCallback(
    (filter?: string) =>
      parseFiltersFromString({
        filter,
        defaultSearchItemName,
        enqueueSnackbar,
        t_toasts,
      }) as ListFilterForm['filters'],
    [defaultSearchItemName, enqueueSnackbar, t_toasts],
  );

  const computeFilterCountLocal = (filters?: ListFilterForm['filters']) => {
    if (!filters || filters.length === 0) return 0;
    return (filters || []).filter((filter) => {
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

  const computeCountFromFiltersLocal = useCallback(
    (filters?: ListFilterForm['filters']) =>
      computeCountFromFilters({ filters, searchParams, getParamKey, parseFilters, watchedFilters }),
    [searchParams, getParamKey, parseFilters, watchedFilters],
  );
  const onApplyRef = useRef(onApply);
  useEffect(() => {
    onApplyRef.current = onApply;
  }, [onApply]);
  const onResetRef = useRef(onReset);
  useEffect(() => {
    onResetRef.current = onReset;
  }, [onReset]);

  const searchString = searchParams.toString();

  useEffect(() => {
    if (externalAppliedFilters) {
      try {
        const parsed = parseFiltersFromUrl(externalAppliedFilters, defaultSearchItemName) as
          | ListFilterForm['filters']
          | undefined;
        const normalizedFilters =
          parsed && parsed.length > 0
            ? parsed
            : [
                {
                  enabled: true,
                  searchItem: defaultSearchItemName,
                  condition: 'equals',
                  value: null,
                },
              ];

        reset({ filters: normalizedFilters, searchValue: externalSearchValue ?? '' });
        setValue('searchValue', externalSearchValue ?? '');
        setFilterCount(computeFilterCountLocal(normalizedFilters));
      } catch (err) {
        console.error(err);
        enqueueSnackbar(t_toasts('filter.error.applyFailed'), { variant: 'error' });
      }
      return;
    }

    if (!syncToUrl) return;

    const searchParam = new URLSearchParams(searchString);
    const rawSearch = searchParam.get(getParamKey('search')) ?? undefined;
    const decodedSearch = urlHelpers.safeDecode(rawSearch ?? undefined);
    const rawFilters = searchParam.get(getParamKey('filters')) ?? undefined;
    const parsed = parseFilters(rawFilters);
    if (decodedSearch === undefined && (!parsed || parsed.length === 0)) return;
    const nextFilters = parsed && parsed.length > 0 ? parsed : undefined;
    const normalizedFilters =
      nextFilters && nextFilters.length > 0
        ? nextFilters
        : [
            {
              enabled: true,
              searchItem: defaultSearchItemName,
              condition: 'equals',
              value: null,
            },
          ];

    const appliedBackend: FilterOptionInput[] = normalizeFilters(
      normalizedFilters as (FilterOptionInput | ListFilterFormItem)[],
      columns,
    );
    const applied = appliedBackend.map((b) => ({
      searchItem: b.searchItem,
      condition: b.condition ?? undefined,
      value: b.value as string | number | boolean | null,
    })) as ListFilterOption[];
    const currentKey = (() => {
      try {
        return JSON.stringify({ filters: applied, search: rawSearch ?? '' });
      } catch {
        return null;
      }
    })();
    if (suppressNextEffectApplyRef.current) {
      suppressNextEffectApplyRef.current = false;
      try {
        lastAppliedRef.current = suppressNextEffectExpectedKeyRef.current ?? currentKey;
      } catch {
        lastAppliedRef.current = null;
      }
      suppressNextEffectExpectedKeyRef.current = null;
      mountedRef.current = true;
      return;
    }

    if (currentKey && lastAppliedRef.current && lastAppliedRef.current === currentKey) {
      mountedRef.current = true;
      return;
    }

    reset({ filters: normalizedFilters, searchValue: decodedSearch ?? '' });
    setValue('searchValue', decodedSearch ?? '');

    setFilterCount(computeFilterCountLocal(normalizedFilters));

    if (onApplyRef.current) {
      void Promise.resolve(onApplyRef.current(applied, decodedSearch ?? ''));
    }

    try {
      lastAppliedRef.current = currentKey;
    } catch {
      lastAppliedRef.current = null;
    }

    mountedRef.current = true;
  }, [
    externalAppliedFilters,
    externalSearchValue,
    defaultSearchItemName,
    reset,
    setValue,
    searchString,
    storageKey,
    parseFilters,
    getParamKey,
    columns,
    syncToUrl,
    onApplyRef,
    enqueueSnackbar,
    t_toasts,
  ]);

  const handleFilters = async (): Promise<boolean> => {
    const validateForm = (): Promise<ListFilterForm> =>
      new Promise((resolve, reject) => {
        const onValid: SubmitHandler<ListFilterForm> = (data) => resolve(data);
        const onInvalid = () => reject(new Error('validation'));
        const handler = handleSubmit(onValid, onInvalid);
        handler();
      });

    try {
      const data = await validateForm();
      const filters: ListFilterForm['filters'] = data.filters;

      setValue(
        'filters',
        filters && filters.length > 0
          ? filters
          : [
              {
                enabled: true,
                searchItem: defaultSearchItemName,
                condition: 'equals',
                value: null,
              },
            ],
      );
      setValue('searchValue', data.searchValue ?? '');
      const count = computeCountFromFiltersLocal(filters);
      setFilterCount(count);

      const transformedBackend: FilterOptionInput[] = normalizeFilters(
        filters as (FilterOptionInput | ListFilterFormItem)[],
        columns,
      );
      const transformed = transformedBackend.map((b) => ({
        searchItem: b.searchItem,
        condition: b.condition ?? undefined,
        value: b.value as string | number | boolean | null,
      })) as ListFilterOption[];
      try {
        suppressNextEffectExpectedKeyRef.current = JSON.stringify({
          filters: transformed,
          search: data.searchValue ?? '',
        });
      } catch {
        suppressNextEffectExpectedKeyRef.current = null;
      }
      suppressNextEffectApplyRef.current = true;
      setUrlFiltersAndSearch({
        paramKey: storageKey ? `filters_${storageKey}` : 'filters',
        searchKey: storageKey ? `search_${storageKey}` : 'search',
        filters: data.filters,
        searchValue: data.searchValue,
        syncToUrl,
        setSearchParams,
        enqueueSnackbar,
        t_toasts,
      });

      if (onApply) {
        await Promise.resolve(onApply(transformed, data.searchValue ?? ''));
      }
      suppressNextEffectApplyRef.current = false;
      handleClose();
      try {
        const currentKey = JSON.stringify({ filters: transformed, search: data.searchValue ?? '' });
        if (lastAppliedRef.current && lastAppliedRef.current === currentKey) {
          handleClose();
        }
        lastAppliedRef.current = currentKey;
      } catch {
        lastAppliedRef.current = null;
      }
      return true;
    } catch (error) {
      console.error(error);
      const err = error as Error | undefined;
      const isValidationError = err?.message === 'validation';
      enqueueSnackbar(
        isValidationError
          ? t_toasts('filter.error.validation')
          : (err?.message ?? t_toasts('filter.error.applyFailed')),
        { variant: 'error' },
      );
      return false;
    }
  };

  const handleSearch = handleSubmit(async (data) => {
    const activeFilters = data.filters.filter((filter: ListFilterForm['filters'][number]) =>
      Boolean(filter && filter.enabled),
    );
    const transformedBackendData: FilterOptionInput[] = normalizeFilters(
      activeFilters as (FilterOptionInput | ListFilterFormItem)[],
      columns,
    );
    const transformedData = transformedBackendData.map((b) => ({
      searchItem: b.searchItem,
      condition: b.condition ?? undefined,
      value: b.value as string | number | boolean | null,
    })) as ListFilterOption[];
    try {
      suppressNextEffectExpectedKeyRef.current = JSON.stringify({
        filters: transformedData,
        search: data.searchValue ?? '',
      });
    } catch {
      suppressNextEffectExpectedKeyRef.current = null;
    }
    suppressNextEffectApplyRef.current = true;
    setUrlFiltersAndSearch({
      paramKey: storageKey ? `filters_${storageKey}` : 'filters',
      searchKey: storageKey ? `search_${storageKey}` : 'search',
      filters: undefined,
      searchValue: data.searchValue ?? undefined,
      syncToUrl,
      setSearchParams,
      enqueueSnackbar,
      t_toasts,
    });
    setValue('searchValue', data.searchValue ?? '');
    if (onApply) {
      try {
        await Promise.resolve(onApply(transformedData, data.searchValue ?? ''));
      } catch (err) {
        console.error(err);
        enqueueSnackbar(t_toasts('filter.error.searchFailed'), { variant: 'error' });
      }
    }
  });

  const computedFilterCount = useMemo(
    (): number => computeCountFromFiltersLocal(),
    [computeCountFromFiltersLocal],
  );

  const handleAddFilter = () => {
    if (fields.length >= LIST_FILTER_MAX_LENGTH) return;
    append({
      enabled: true,
      searchItem: defaultSearchItemName,
      condition: 'equals',
      value: null,
    });
    setFilterCount(computedFilterCount);
  };

  const handleResetAll = () => {
    reset();
    setFilterCount(0);
    suppressNextEffectApplyRef.current = true;
    try {
      const rawSearch = preserveSearchOnReset
        ? (searchParams.get(getParamKey('search')) ?? '')
        : '';
      const normalizedCleared: ListFilterForm['filters'] = [
        {
          enabled: true,
          searchItem: defaultSearchItemName,
          condition: 'equals',
          value: null,
        },
      ];
      const appliedCleared: FilterOptionInput[] = normalizeFilters(
        normalizedCleared as (FilterOptionInput | ListFilterFormItem)[],
        columns,
      );
      const appliedClearedMapped = appliedCleared.map((b) => ({
        searchItem: b.searchItem,
        condition: b.condition ?? undefined,
        value: b.value as string | number | boolean | null,
      }));

      try {
        suppressNextEffectExpectedKeyRef.current = JSON.stringify({
          filters: appliedClearedMapped,
          search: rawSearch,
        });
      } catch {
        suppressNextEffectExpectedKeyRef.current = null;
      }
    } catch {
      lastAppliedRef.current = null;
    }

    try {
      onResetRef.current?.();
    } catch (error) {
      console.error(error);
      enqueueSnackbar(t_toasts('filter.error.applyFailed'), { variant: 'error' });
    }
    if (!preserveSearchOnReset) {
      setUrlFiltersAndSearch({
        paramKey: storageKey ? `filters_${storageKey}` : 'filters',
        searchKey: storageKey ? `search_${storageKey}` : 'search',
        filters: undefined,
        searchValue: undefined,
        syncToUrl,
        setSearchParams,
        enqueueSnackbar,
        t_toasts,
      });
    } else {
      const preserved = searchParams.get(getParamKey('search')) ?? '';
      setUrlFiltersAndSearch({
        paramKey: storageKey ? `filters_${storageKey}` : 'filters',
        searchKey: storageKey ? `search_${storageKey}` : 'search',
        filters: undefined,
        searchValue: preserved !== '' ? preserved : undefined,
        syncToUrl,
        setSearchParams,
        enqueueSnackbar,
        t_toasts,
      });
    }
    try {
      if (typeof window !== 'undefined' && storageKey) {
        localStorage.removeItem(`filters_${storageKey}`);
        localStorage.removeItem(`search_${storageKey}`);
      }
    } catch (error) {
      console.error(error);
    }
    try {
      lastAppliedRef.current = suppressNextEffectExpectedKeyRef.current;
    } catch {
      lastAppliedRef.current = null;
    }
    suppressNextEffectExpectedKeyRef.current = null;
    suppressNextEffectApplyRef.current = false;
    handleClose();
  };

  return {
    control,
    fields,
    watchedFilters,
    handleFilters,
    handleSearch,
    handleResetAll,
    handleAddFilter,
    handleOpen,
    handleClose,
    filterCount,
    anchorEl,
    open,
  };
};
