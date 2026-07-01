import { useMemo } from 'react';

import { type TextFieldProps } from '@mui/material';

import {
  formatOptions,
  FieldWrapper,
  AutocompleteBase,
  type AutocompleteBaseProps,
  type FieldLabelProps,
  type OptionProps,
  type OptionValueType,
} from '~/common/components';

export type AutocompleteProps<
  Value = string | number,
  DisableClearable extends boolean = boolean,
> = Omit<
  AutocompleteBaseProps<OptionValueType<Value>, false, DisableClearable, false>,
  'value' | 'renderInput' | 'options'
> &
  FieldLabelProps & {
    options: OptionProps<Value>[];
    value?: string | number;
    required?: boolean;
    inputRef?: TextFieldProps['ref'];
    inputProps?: Omit<TextFieldProps, 'label'>;
    labelFloat?: boolean;
    disableClearable?: DisableClearable;
  };

export const Autocomplete = ({
  value,
  options,
  label,
  errorMessage,
  required,
  labelFloat,
  ...props
}: AutocompleteProps) => {
  const formattedOptions = useMemo(() => formatOptions(options), [options]);

  const selectedValue = useMemo(
    () => formattedOptions.find((option) => option.value === value) || null,
    [formattedOptions, value],
  );

  return (
    <FieldWrapper width='100%' label={!labelFloat && label} {...{ errorMessage, required }}>
      <AutocompleteBase
        value={selectedValue}
        options={formattedOptions}
        label={label}
        isOptionEqualToValue={(option, { value }) => option.value == value}
        getOptionLabel={(option) => option.label ?? ''}
        renderOption={(props, { value, label }) => {
          return (
            <li {...props} key={value}>
              {label}
            </li>
          );
        }}
        {...{ errorMessage, required, labelFloat }}
        {...props}
      />
    </FieldWrapper>
  );
};
