import { useMemo } from 'react';

import { Checkbox, type TextFieldProps } from '@mui/material';

import {
  formatOptions,
  FieldWrapper,
  AutocompleteBase,
  type AutocompleteBaseProps,
  type FieldLabelProps,
  type OptionValueType,
  type OptionProps,
} from '~/common/components';

export type MultipleAutocompleteProps<
  Separator extends string | undefined,
  Value = string | number,
> = Omit<
  AutocompleteBaseProps<OptionValueType<Value>, true, true, false>,
  'value' | 'renderInput' | 'options' | 'onChange'
> &
  FieldLabelProps & {
    options: OptionProps<Value>[];
    value?: Separator extends string ? string : (string | number)[];
    onChange?: (...event: any[]) => void;
    inputRef?: TextFieldProps['ref'];
    inputProps?: Omit<TextFieldProps, 'label'>;
    labelFloat?: boolean;
    checkBox?: boolean;
    separator?: Separator;
  };

export const MultipleAutocomplete = <Separator extends string | undefined>({
  value,
  options,
  onChange,
  label,
  errorMessage,
  required,
  labelFloat,
  checkBox,
  separator,
  ...props
}: MultipleAutocompleteProps<Separator>) => {
  const formatedOptions = useMemo(() => formatOptions(options), [options]);
  const formattedValue = useMemo(
    () =>
      separator && value
        ? (value as string)?.split(separator)
        : (value as unknown as (string | number)[] | undefined),
    [value, separator],
  );

  const selectedValue = useMemo(
    () => formatedOptions.filter((option) => formattedValue?.includes(option.value)) ?? [],
    [formatedOptions, formattedValue],
  );

  const handleChange = (_e: any, v: OptionValueType<string | number>[]) => {
    const newValue = v.map((option) => option.value);
    if (separator) {
      onChange?.(newValue.join(separator));
    } else {
      onChange?.(newValue);
    }
  };

  return (
    <FieldWrapper width='100%' label={!labelFloat && label} {...{ errorMessage, required }}>
      <AutocompleteBase
        value={selectedValue}
        options={formatedOptions}
        onChange={handleChange}
        label={label}
        isOptionEqualToValue={(option, { value }) => option.value == value}
        getOptionLabel={(option) => option.label ?? ''}
        renderOption={(props, { value, label }, { selected }) => {
          return (
            <li {...props} key={value}>
              {checkBox && <Checkbox checked={selected} />}
              {label}
            </li>
          );
        }}
        disableCloseOnSelect
        multiple
        {...{ errorMessage, required }}
        {...props}
        placeholder={!props.disabled || selectedValue.length === 0 ? props.placeholder : ''}
      />
    </FieldWrapper>
  );
};
