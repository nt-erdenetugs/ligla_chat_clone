import {
  ToggleButtonGroup as MuiToggleButtonGroup,
  type ToggleButtonGroupProps as MuiToggleButtonGroupProps,
  ToggleButton,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

import { type OptionProps } from '../types';
import { formatOptions } from '../utils';

import { FieldWrapper, type FieldLabelProps } from '.';

export type ToggleButtonGroupProps<Value = string | number> = Omit<
  MuiToggleButtonGroupProps,
  'value'
> &
  FieldLabelProps & {
    options: readonly OptionProps<Value>[];
    value?: OptionProps<Value>;
    required?: boolean;
    inputRef?: MuiToggleButtonGroupProps['ref'];
    onChange?: (...event: any[]) => void;
  };

export const ToggleButtonGroup = ({
  options,
  label,
  help,
  errorMessage,
  required,
  value,
  disabled,
  ...rest
}: ToggleButtonGroupProps) => {
  const { t } = useTranslation();

  return (
    <FieldWrapper label={label} help={help} errorMessage={errorMessage} required={required}>
      <MuiToggleButtonGroup disabled={disabled} {...(!disabled && { value })} {...rest}>
        {formatOptions(options).map((option, i) => {
          return (
            <ToggleButton key={i} value={option.value}>
              {t(option.label)}
            </ToggleButton>
          );
        })}
      </MuiToggleButtonGroup>
    </FieldWrapper>
  );
};
