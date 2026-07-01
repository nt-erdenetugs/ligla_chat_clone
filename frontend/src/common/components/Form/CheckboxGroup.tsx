import { Fragment, type ChangeEvent, useMemo } from 'react';

import {
  Checkbox,
  FormControlLabel,
  FormGroup,
  type FormGroupProps,
  FormHelperText,
} from '@mui/material';

import { type OptionProps } from './types';
import { formatOptions } from './utils';

import { FieldWrapper, type FieldLabelProps, Label } from '.';

export type CheckboxGroupProps<Value = string | number> = Omit<FormGroupProps, 'onChange'> &
  FieldLabelProps & {
    options: readonly OptionProps<Value>[];
    value?: Value[];
    required?: boolean;
    inputRef?: FormGroupProps['ref'];
    onChange?: (...event: any[]) => void;
    disabled?: boolean;
    disableValues?: readonly Value[];
    insertGroupLabel?: (value: Value) => string | undefined;
    showSelectAll?: boolean;
    formatValue?: (value: Value) => Value;
  };

export const CheckboxGroup = ({
  value,
  options,
  onChange,
  label,
  help,
  errorMessage,
  required,
  disabled,
  disableValues,
  insertGroupLabel,
  showSelectAll,
  formatValue,
  ...rest
}: CheckboxGroupProps) => {
  const formattedOptions = useMemo(() => formatOptions(options), [options]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>, checked: boolean) => {
    const newValue = value ? [...value] : [];
    const eventValue = formatValue?.(e.target.value) ?? e.target.value;
    if (checked) {
      newValue.push(eventValue);
    } else {
      const index = newValue.indexOf(eventValue);
      if (index !== -1) newValue.splice(index, 1);
    }
    onChange?.(newValue);
  };

  const handleSelectAll = (_: any, checked: boolean) => {
    if (checked) return onChange?.(formattedOptions.map(({ value }) => value));
    onChange?.([]);
  };

  return (
    <FieldWrapper
      label={!showSelectAll && label}
      help={help}
      errorMessage={errorMessage}
      required={required}
    >
      {showSelectAll && (
        <FormControlLabel
          control={
            <Checkbox
              checked={value?.length === options.length}
              indeterminate={value && value.length !== 0 && value.length < options.length}
              onChange={handleSelectAll}
            />
          }
          label={<Label text={label} required={required} error={!!errorMessage} mb={0} />}
        />
      )}
      <FormGroup {...(showSelectAll && { sx: { ml: 2 } })} {...rest}>
        {formattedOptions.map((option, i) => {
          const groupLabel = insertGroupLabel?.(option.value);
          return (
            <Fragment key={i}>
              {groupLabel && (
                <FormHelperText sx={{ mt: 1, width: '100%' }}>{groupLabel}</FormHelperText>
              )}
              <FormControlLabel
                control={
                  <Checkbox
                    onChange={handleChange}
                    value={option.value}
                    checked={Boolean(value?.includes(option.value))}
                    disabled={
                      (!value?.includes(option.value) && disabled) ||
                      disableValues?.includes(option.value)
                    }
                  />
                }
                label={option.label}
              />
            </Fragment>
          );
        })}
      </FormGroup>
    </FieldWrapper>
  );
};
