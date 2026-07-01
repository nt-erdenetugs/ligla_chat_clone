import { TextField as MuiTextField, type TextFieldProps as MuiTextFieldProps } from '@mui/material';

import { FieldWrapper, type FieldLabelProps } from '~/common/components';
import { useTranslation } from '~/locales/hooks';

export type TextFieldProps = Omit<MuiTextFieldProps, 'label'> & FieldLabelProps;

export const TextField = ({
  value = '',
  label,
  errorMessage,
  wrapperProps,
  labelProps,
  labelTooltip,
  ...props
}: TextFieldProps) => {
  const { t } = useTranslation();
  const placeholder =
    typeof label === 'string' ? t('enterInput', { target: label?.toString().toLowerCase() }) : '';

  return (
    <FieldWrapper
      width='100%'
      label={label}
      labelProps={labelProps}
      labelTooltip={labelTooltip}
      {...{ errorMessage, required: props.required, ...wrapperProps }}
    >
      <MuiTextField
        value={value}
        placeholder={placeholder}
        error={!!errorMessage}
        fullWidth
        {...props}
      />
    </FieldWrapper>
  );
};
