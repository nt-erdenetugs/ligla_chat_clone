import { TextField } from '@mui/material';

import { type ChatAssignCondition, ValueType } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { MAX_INT_32, STORE_IDS_FIELD, StoreAutocomplete } from '~/modules/Rules/Filters';

type ValueInputProps = Pick<ChatAssignCondition, 'valueObjects'> & {
  field: string;
  value: string;
  valueType?: ValueType;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  readOnly?: boolean;
};

export const ValueInput = ({
  field,
  value,
  valueType = ValueType.String,
  valueObjects,
  onChange,
  disabled = false,
  error,
  readOnly = false,
}: ValueInputProps) => {
  const { t_management, t_errors } = useTranslation();

  if (field === STORE_IDS_FIELD && valueType === ValueType.Array)
    return (
      <StoreAutocomplete
        value={value}
        valueObjects={valueObjects}
        onChange={onChange}
        disabled={disabled}
        error={error}
        readOnly={readOnly}
      />
    );

  const baseLabel = readOnly
    ? t_management('chatAssignFilters.filterBuilder.value')
    : t_management('chatAssignFilters.filterBuilder.enterValue');

  const commonProps = {
    size: 'small' as const,
    label: baseLabel,
    value: value ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value.toString()),
    disabled,
    error: !!error,
    helperText: error ? t_errors(error) : '',
    sx: { minWidth: 120 },
    position: 'relative',
    inputProps: { readOnly },
    slotProps: {
      formHelperText: {
        sx: {
          position: 'absolute',
          fontSize: '0.75rem',
          top: '100%',
          left: 5,
          m: 0,
          mt: 0.5,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
        },
      },
    },
  };

  switch (valueType) {
    case ValueType.Number:
      return (
        <TextField
          {...commonProps}
          type='number'
          label={
            readOnly ? baseLabel : t_management('chatAssignFilters.filterBuilder.enterNumberValue')
          }
          slotProps={{ ...commonProps.slotProps, htmlInput: { min: 0, max: MAX_INT_32, readOnly } }}
          onKeyDown={(e) => {
            if (['e', 'E', '+', '-'].includes(e.key)) {
              e.preventDefault();
            }
          }}
          onChange={(e) => {
            const value = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
            commonProps.onChange?.({
              ...e,
              target: {
                ...e.target,
                value: value.toString(),
              },
            } as React.ChangeEvent<HTMLInputElement>);
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text');
            if (!/^\d*$/.test(pasted)) e.preventDefault();
          }}
        />
      );

    case ValueType.Datetime:
      return (
        <TextField
          {...commonProps}
          type='date'
          label={
            readOnly
              ? t_management('chatAssignFilters.filterBuilder.dateValue')
              : t_management('chatAssignFilters.filterBuilder.enterDateValue')
          }
          slotProps={{ ...commonProps.slotProps, inputLabel: { shrink: true } }}
          inputProps={{
            placeholder: 'YYYY-MM-DD',
            style: { textTransform: 'uppercase' },
          }}
        />
      );

    case ValueType.Array:
      return (
        <TextField
          {...commonProps}
          helperText={
            readOnly
              ? ''
              : t_management('chatAssignFilters.filterBuilder.enterValuesSeparatedBySpace')
          }
          placeholder='1 2 3 4 5'
          onChange={(e) => {
            const inputValue = e.target.value;
            // Allow only numbers and single spaces
            const sanitized = inputValue.replace(/[^\d\s]/g, '').replace(/\s+/g, ' ');
            onChange(sanitized);
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text');
            // Only allow numbers and spaces
            if (!/^[\d\s]*$/.test(pasted)) {
              e.preventDefault();
              // Extract only valid characters
              const sanitized = pasted.replace(/[^\d\s]/g, '').replace(/\s+/g, ' ');
              onChange(sanitized);
            }
          }}
        />
      );

    case ValueType.String:
    default:
      return <TextField {...commonProps} />;
  }
};
