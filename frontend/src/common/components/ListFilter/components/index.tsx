import React, { useEffect, useMemo, useRef } from 'react';

import FilterListIcon from '@mui/icons-material/FilterList';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  IconButton,
  Chip,
  InputAdornment,
} from '@mui/material';
import { Controller, useController, useWatch, type Control } from 'react-hook-form';

import { CustomPopover } from '~/common/components';
import type { Column } from '~/common/components/Elements';
import type { ListFilterForm } from '~/common/components/ListFilter/hooks/filterSchema';
import { useListFilterForm } from '~/common/components/ListFilter/hooks/useListFilter';
import { parseFiltersFromUrl } from '~/common/components/ListFilter/utils/normalize';
import {
  LIST_FILTER_CONDITIONS,
  LIST_FILTER_MAX_LENGTH,
  ListFilterCondition,
  ATTRIBUTE_OPTIONS,
} from '~/common/constants';
import { type FilterOptionInput } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';

import { BooleanFilterInput } from './BooleanFilterInput';
import { DateFilterInput } from './DateFilterInput';
import { DateRangeFilterInput } from './DateRangeFilterInput';
import { EnumFilterInput } from './EnumFilterInput';
import { NumberFilterInput } from './NumberFilterInput';
import { TextFilterInput } from './TextFilterInput';

const getConditionOptions = (filterType?: string): string[] => {
  switch (filterType) {
    case 'number':
    case 'boolean':
    case 'type':
    case 'isEnum':
      return ['equals', 'not equals'];
    case 'datetime':
      return ['range'];
    default:
      return LIST_FILTER_CONDITIONS;
  }
};

const FilterSearchItemInputInner = <T,>({
  control,
  index,
  columns,
  disabled,
}: {
  control: Control<ListFilterForm>;
  index: number;
  columns: Column<T>[];
  disabled?: boolean;
}): React.ReactElement => {
  const { t } = useTranslation();
  const searchItemOptions: { value: string; label: string }[] = useMemo(
    () =>
      columns
        .filter((column) => column.filterable !== false)
        .map((column) => ({ value: String(column.name), label: String(column.label) })),
    [columns],
  );

  return (
    <Controller
      control={control}
      name={`filters.${index}.searchItem`}
      defaultValue=''
      render={({ field }) => (
        <FormControl size='small' sx={{ width: 180 }}>
          <InputLabel id={`search-item-label-${index}`}>
            {t('datatableFilter.searchItem')}
          </InputLabel>
          <Select
            labelId={`search-item-label-${index}`}
            label={t('datatableFilter.searchItem')}
            value={String(field.value ?? '')}
            onChange={(e) => field.onChange(e.target.value)}
            disabled={disabled}
          >
            {searchItemOptions.map((searchItemOption) => (
              <MenuItem key={String(searchItemOption.value)} value={String(searchItemOption.value)}>
                {searchItemOption.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    />
  );
};

export const FilterSearchItemInput = React.memo(FilterSearchItemInputInner) as <T>(props: {
  control: Control<ListFilterForm>;
  index: number;
  columns: Column<T>[];
  disabled?: boolean;
}) => React.ReactElement;
(FilterSearchItemInput as { displayName?: string }).displayName = 'FilterSearchItemInput';

export const FilterConditionInput = <T,>({
  control,
  index,
  columns,
  disabled,
}: {
  control: Control<ListFilterForm>;
  index: number;
  columns: Column<T>[];
  disabled?: boolean;
}) => {
  const { t } = useTranslation();
  const searchItem = useWatch({ control, name: `filters.${index}.searchItem` });
  const { field } = useController({
    control,
    name: `filters.${index}.condition`,
    defaultValue: '',
  });
  const _mountedRef = useRef(false);
  const selected = String(searchItem ?? field.value);
  const selectedColumn = columns.find((column) => String(column.name) === selected);
  const options = getConditionOptions(selectedColumn?.filterType);
  useEffect(() => {
    if (!_mountedRef.current) {
      _mountedRef.current = true;
      return;
    }
    const firstOption = options[0] ?? '';
    field.onChange(firstOption);
  }, [searchItem]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <FormControl size='small' sx={{ width: 180 }}>
      <InputLabel id={`condition-label-${index}`}>{t('datatableFilter.condition')}</InputLabel>
      <Select
        labelId={`condition-label-${index}`}
        label={t('datatableFilter.condition')}
        value={field.value}
        onChange={(e) => field.onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            {String(option)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
FilterConditionInput.displayName = 'FilterConditionInput';

export const FilterValueInput = <T,>({
  control,
  index,
  columns,
  disabled,
}: {
  control: Control<ListFilterForm>;
  index: number;
  columns: Column<T>[];
  disabled?: boolean;
}) => {
  const searchItem = useWatch({ control, name: `filters.${index}.searchItem` });
  const condition = useWatch({ control, name: `filters.${index}.condition` });
  const selectedColumn = columns.find((column) => String(column.name) === String(searchItem));
  const isEnum = Boolean(selectedColumn?.enumOptions?.length);
  const { field } = useController({ control, name: `filters.${index}.value`, defaultValue: null });
  const _mountedRef = React.useRef(false);
  React.useEffect(() => {
    if (!_mountedRef.current) {
      _mountedRef.current = true;
      return;
    }
    field.onChange(null);
  }, [searchItem, condition]); // eslint-disable-line react-hooks/exhaustive-deps

  if (condition === ListFilterCondition.IS_BLANK || condition === ListFilterCondition.IS_PRESENT) {
    return <></>;
  }

  if (isEnum) {
    const enumOptions = selectedColumn?.enumOptions ?? [];
    const options = enumOptions.map(({ value, label }) => ({
      value: String(value),
      label: String(label),
    }));
    return <EnumFilterInput field={field} options={options} index={index} disabled={disabled} />;
  }

  if (selectedColumn?.filterType === 'datetime') {
    if (condition === 'range') return <DateRangeFilterInput field={field} disabled={disabled} />;
    return <DateFilterInput field={field} disabled={disabled} />;
  }

  if (selectedColumn?.filterType === 'number') {
    return <NumberFilterInput field={field} disabled={disabled} />;
  }

  if (selectedColumn?.filterType === 'boolean') {
    const enumOptions = selectedColumn?.enumOptions ?? [];
    const options = enumOptions.map(({ value, label }) => ({
      value: String(value),
      label: String(label),
    }));
    return <BooleanFilterInput field={field} options={options} index={index} disabled={disabled} />;
  }

  if (selectedColumn?.filterType === 'type') {
    const options = ATTRIBUTE_OPTIONS.map((option) => ({
      value: String(option.value),
      label: String(option.label),
    }));
    return <EnumFilterInput field={field} options={options} index={index} disabled={disabled} />;
  }

  return <TextFilterInput field={field} disabled={disabled} />;
};
FilterValueInput.displayName = 'FilterValueInput';

export const FilterRow = <T,>({
  columns,
  control,
  field,
  index,
}: {
  columns: Column<T>[];
  control: Control<ListFilterForm>;
  field: { id: string };
  index: number;
}) => {
  const enabled = useWatch({ control, name: `filters.${index}.enabled`, exact: true });
  return (
    <Box key={field.id} sx={{ display: 'flex' }}>
      <Controller
        control={control}
        name={`filters.${index}.enabled`}
        defaultValue={false}
        render={({ field: filter }) => (
          <Checkbox
            checked={Boolean(filter.value)}
            onChange={(e) => filter.onChange(e.target.checked)}
          />
        )}
      />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <FilterSearchItemInput
          control={control}
          index={index}
          columns={columns}
          disabled={!enabled}
        />
        <FilterConditionInput
          control={control}
          index={index}
          columns={columns}
          disabled={!enabled}
        />
        <FilterValueInput control={control} index={index} columns={columns} disabled={!enabled} />
      </Box>
    </Box>
  );
};
FilterRow.displayName = 'FilterRow';

export type ListFilterProps<T> = {
  columns: Column<T>[];
  onApply?: (filters?: FilterOptionInput[], searchValue?: string) => void;
  onReset?: () => void;
  storageKey?: string;
  externalAppliedFilters?: FilterOptionInput[];
  externalSearchValue?: string;
};

export const ListFilter = <T,>(props: ListFilterProps<T>) => {
  const { columns, onApply, onReset, storageKey, externalAppliedFilters, externalSearchValue } =
    props;
  const { t } = useTranslation();

  const {
    control,
    fields,
    handleFiltersAndSearch,
    filterCount,
    handleAddFilter,
    handleClose,
    handleOpen,
    handleResetFilters,
    anchorEl,
    open,
  } = useListFilterForm<T>({
    columns,
    onApply,
    storageKey,
    onReset,
    externalAppliedFilters,
    externalSearchValue,
  });

  const displayCount = useMemo(() => {
    if (externalAppliedFilters && externalAppliedFilters.length > 0) {
      const defaultSearchItemName = String(
        columns?.find((column) => column.filterable !== false)?.name ?? '',
      );
      return parseFiltersFromUrl(externalAppliedFilters, defaultSearchItemName).length;
    }
    return filterCount ?? 0;
  }, [externalAppliedFilters, filterCount, columns]);

  const searchableColumns = useMemo(() => {
    const labels = columns
      .filter((column) => column.searchable)
      .map((column) => String(column.label));

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 1 }}>
        <Box component='span' sx={{ fontSize: 14, fontWeight: 700 }}>
          {t('datatableFilter.searchAllowed')}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
          {labels.length === 0 ? (
            <Box component='span' sx={{ fontSize: 13, color: 'text.secondary' }}>
              {t('datatableFilter.none')}
            </Box>
          ) : (
            labels.map((searchableColumn) => (
              <Chip
                key={searchableColumn}
                label={searchableColumn}
                size='small'
                sx={{
                  fontSize: 12,
                  height: 26,
                  '& .MuiChip-label': { paddingLeft: '8px', paddingRight: '8px' },
                }}
              />
            ))
          )}
        </Box>
      </Box>
    );
  }, [columns, t]);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
      <Box>
        <Button
          variant='outlined'
          startIcon={<FilterListIcon />}
          onClick={handleOpen}
          sx={{
            color: displayCount > 0 ? 'primary.main' : 'text.secondary',
            borderColor: displayCount > 0 ? 'primary.main' : 'divider',
            '&:hover': {
              borderColor: open ? 'success.dark' : 'divider',
            },
          }}
        >
          {t('datatableFilter.refine')} {displayCount > 0 ? `(${displayCount})` : ''}
        </Button>

        <CustomPopover
          open={open}
          anchorEl={anchorEl}
          onClose={() => {
            handleClose();
          }}
          title={t('datatableFilter.filters')}
          sx={{
            width: 'auto',
            bgcolor: 'background.paper',
            px: 2,
            ml: 0,
          }}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        >
          <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {fields.map((field, index) => (
              <FilterRow
                key={field.id}
                columns={columns}
                control={control}
                field={field}
                index={index}
              />
            ))}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pb: 2 }}>
              <Button
                type='button'
                sx={{ color: 'text.secondary' }}
                onClick={() => {
                  handleResetFilters();
                }}
              >
                {t('datatableFilter.reset')}
              </Button>
              <Button
                type='button'
                sx={{ color: 'text.secondary' }}
                onClick={handleAddFilter}
                disabled={fields.length >= LIST_FILTER_MAX_LENGTH}
              >
                {t('datatableFilter.addFilter')}
              </Button>
              <Button type='button' onClick={() => void handleFiltersAndSearch()}>
                {t('datatableFilter.apply')}
              </Button>
            </Box>
          </Box>
        </CustomPopover>
      </Box>

      <Controller
        control={control}
        name='searchValue'
        render={({ field }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              {...field}
              variant='outlined'
              size='small'
              placeholder={t('datatableFilter.searchBy')}
              onKeyDown={async (event: React.KeyboardEvent<HTMLInputElement>) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  await handleFiltersAndSearch();
                }
              }}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position='end'>
                      <Tooltip
                        title={searchableColumns}
                        placement='bottom'
                        slotProps={{
                          tooltip: {
                            sx: {
                              bgcolor: 'background.paper',
                              color: 'text.primary',
                              p: 1,
                              opacity: 0.98,
                              boxShadow: 3,
                              borderRadius: 1,
                              pointerEvents: 'auto',
                              maxWidth: 440,
                            },
                          },
                        }}
                      >
                        <IconButton size='small' aria-label={t('datatableFilter.searchBy')}>
                          <InfoOutlinedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
        )}
      />

      <Button
        type='button'
        variant='outlined'
        startIcon={<SearchIcon />}
        onClick={async () => {
          await handleFiltersAndSearch();
        }}
      >
        {t('datatableFilter.search')}
      </Button>
    </Box>
  );
};
