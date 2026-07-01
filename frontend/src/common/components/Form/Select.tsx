import { useMemo } from 'react';

import {
  Select as MuiSelect,
  type SelectProps as MuiSelectProps,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';

import { useTranslation } from '~/locales/hooks';

import { type OptionProps } from './types';
import { formatOptions } from './utils';

import { FieldWrapper, type FieldLabelProps } from '.';

export type SelectProps<Value = number | string> = Omit<MuiSelectProps, 'onChange'> &
  FieldLabelProps & {
    options: readonly OptionProps<Value>[];
    value?: Value;
    required?: boolean;
    inputRef?: MuiSelectProps['ref'];
    onChange?: (...event: any[]) => void;
    labelFloat?: boolean;
    width?: string | number;
    minWidth?: number;
  };

export const Select = ({
  options,
  label,
  help,
  errorMessage,
  required,
  labelFloat,
  size,
  width,
  minWidth,
  value,
  disabled,
  ...rest
}: SelectProps) => {
  const { t } = useTranslation();
  const formattedOptions = useMemo(() => formatOptions(options), [options]);

  return (
    <FieldWrapper label={!labelFloat && label} {...{ help, errorMessage, required, width }}>
      <FormControl size={size} sx={{ minWidth: minWidth || 120, width }} fullWidth>
        {labelFloat && <InputLabel>{label}</InputLabel>}
        <MuiSelect
          value={value && options.length > 0 ? value : ''}
          {...(labelFloat && { label })}
          renderValue={(selected) =>
            (selected !== null &&
              selected !== undefined &&
              formattedOptions.find(({ value }) => value === selected)?.label) ||
            (!labelFloat && (
              <span style={{ color: '#757575' }}>{t('enterInput', { target: label })}</span>
            ))
          }
          disabled={options.length === 0 || disabled}
          displayEmpty={!labelFloat}
          MenuProps={{ MenuListProps: { sx: { maxHeight: 500 } } }}
          error={Boolean(errorMessage)}
          {...rest}
        >
          {formattedOptions.map((option, i) => {
            return (
              <MenuItem key={i} value={option.value}>
                {option.label}
              </MenuItem>
            );
          })}
        </MuiSelect>
      </FormControl>
    </FieldWrapper>
  );
};
