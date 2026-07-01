import {
  OutlinedInput as MuiOutlinedInput,
  type OutlinedInputProps as MuiOutlinedInputProps,
} from '@mui/material';

import { FieldWrapper, type FieldLabelProps } from '~/common/components';

export type OutlinedInputProps = Omit<MuiOutlinedInputProps, 'label'> & FieldLabelProps;

export const OutlinedInput = ({
  value = '',
  label,
  errorMessage,
  ...props
}: OutlinedInputProps) => {
  const placeholder = typeof label === 'string' ? `Enter ${label.toLowerCase()}` : '';

  return (
    <FieldWrapper width='100%' label={label} errorMessage={errorMessage} required={props.required}>
      <MuiOutlinedInput
        value={value}
        placeholder={placeholder}
        error={!!errorMessage}
        fullWidth
        {...props}
      />
    </FieldWrapper>
  );
};
