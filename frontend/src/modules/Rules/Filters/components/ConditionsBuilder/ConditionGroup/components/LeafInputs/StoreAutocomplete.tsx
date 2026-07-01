import { useMemo } from 'react';

import { Checkbox } from '@mui/material';

import {
  AutocompleteBase,
  ChipsWrapper,
  formatOptions,
  type OptionValueType,
} from '~/common/components';
import {
  QUERY_RESPONSE_KEYS,
  useInfiniteQuery,
  useMergedAutocompleteOptions,
} from '~/common/hooks';
import { useAuthContext } from '~/context/AuthContext';
import {
  type ChatAssignCondition,
  StoresInfiniteScrollDocument,
  type StoresInfiniteScrollQuery,
} from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { ARRAY_VALUE_SEPARATOR } from '~/modules/Rules/Filters';
import { uniqueKey } from '~/utils';

type StoreAutocompleteProps = Pick<ChatAssignCondition, 'valueObjects'> & {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  separator?: string;
  error?: string;
  readOnly?: boolean;
};

export const StoreAutocomplete = ({
  value,
  valueObjects,
  onChange,
  disabled = false,
  separator = ARRAY_VALUE_SEPARATOR,
  error,
  readOnly = false,
}: StoreAutocompleteProps) => {
  const { t_management, t_errors } = useTranslation();
  const { user } = useAuthContext();

  const storesKey = QUERY_RESPONSE_KEYS.storesCursor;

  const {
    data: stores,
    loading: isFetchingStores,
    loadMore: fetchMoreStores,
    fetchedAll: fetchedAllStores,
  } = useInfiniteQuery<typeof storesKey, StoresInfiniteScrollQuery>(
    StoresInfiniteScrollDocument,
    storesKey,
    {
      extraParams: { organizationId: user?.organization?.id ?? '' },
    },
  );

  const handleChange = (_event: any, newValue: OptionValueType<string>[]) => {
    if (Array.isArray(newValue)) {
      const values = newValue.map((item) => item.value).join(ARRAY_VALUE_SEPARATOR);
      onChange(values);
    }
  };

  const mergedStoreOptions = useMergedAutocompleteOptions(
    stores
      ?.filter((store) => store.liglaStoreId)
      .map((store) => ({ id: String(store.liglaStoreId), name: store.name })),
    valueObjects ?? [],
    (store) => store.id,
    (store) => store.name,
  );

  const options = useMemo(() => formatOptions(mergedStoreOptions), [mergedStoreOptions]);

  const formattedValue = useMemo(
    () => (separator && value ? value?.split(separator) : value),
    [value, separator],
  );

  const selectedValue = useMemo(
    () => options.filter((option) => formattedValue?.includes(option.value)) ?? [],
    [options, formattedValue],
  );

  const placeholder = selectedValue.length > 0 ? '' : t_management('teams.selectStores');
  const errorMessage = error ? t_errors(`chatAssignRules.${error}`) : undefined;

  return readOnly ? (
    <ChipsWrapper
      title={t_management('stores.title')}
      key={uniqueKey()}
      items={selectedValue}
      getChipLabel={(store) => store.label}
      stackProps={{ flexWrap: 'wrap', maxWidth: 550 }}
      limit={3}
    />
  ) : (
    <AutocompleteBase
      value={selectedValue}
      options={options}
      onChange={handleChange}
      label={t_management('teams.stores')}
      placeholder={placeholder}
      isOptionEqualToValue={(option, { value: val }) => option.value == val}
      getOptionLabel={(option) => option.label ?? ''}
      renderOption={(props, { label, value }, { selected }) => (
        <li {...props} key={value}>
          {<Checkbox checked={selected} />}
          {label}
        </li>
      )}
      infiniteQueryResponse={{
        fetchMore: fetchMoreStores,
        fetchedAll: fetchedAllStores,
        loading: isFetchingStores,
      }}
      sx={{
        minWidth: '200px',
        maxWidth: '500px',
      }}
      size='small'
      limitTags={3}
      loading={isFetchingStores}
      disabled={disabled}
      errorMessage={errorMessage}
      fullWidth={false}
      multiple
      disableCloseOnSelect
    />
  );
};
