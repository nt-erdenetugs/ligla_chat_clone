import { type ReactNode } from 'react';

import { FormHelperText, Stack, type StackProps } from '@mui/material';

import { NewLine, Label, type LabelProps } from '~/common/components';

import { LabelHintIcon } from './LabelHintIcon';

export type FieldLabelProps = {
  label?: ReactNode;
  labelProps?: Omit<LabelProps, 'text'>;
  labelTooltip?: ReactNode;
  errorMessage?: ReactNode;
  wrapperProps?: StackProps;
  help?: ReactNode;
};

type FieldWrapperProps = StackProps &
  FieldLabelProps & {
    children?: ReactNode;
    required?: boolean;
  };

export const FieldWrapper = ({
  children,
  label,
  required,
  help,
  errorMessage,
  labelProps,
  labelTooltip,
  ...props
}: FieldWrapperProps) => {
  return (
    <Stack {...props}>
      {label &&
        (labelTooltip ? (
          <Stack direction='row' alignItems='center' gap={0.5} mb='4px'>
            <Label text={label} required={required} error={!!errorMessage} mb={0} {...labelProps} />
            <LabelHintIcon title={labelTooltip} />
          </Stack>
        ) : (
          <Label text={label} required={required} error={!!errorMessage} {...labelProps} />
        ))}
      {children}
      {errorMessage && (
        <FormHelperText error>
          {typeof errorMessage === 'string' ? <NewLine text={errorMessage} /> : errorMessage}
        </FormHelperText>
      )}
      {help && <FormHelperText>{help}</FormHelperText>}
    </Stack>
  );
};
