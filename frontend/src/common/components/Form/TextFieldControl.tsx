import { type FieldValues, useController, type UseControllerProps } from 'react-hook-form';

import { TextField, type TextFieldProps } from '~/common/components';
import { useTranslation } from '~/locales/hooks';

export type TextFieldControlProps<T extends FieldValues> = TextFieldProps &
  UseControllerProps<T> & { maxLength?: number };

export const TextFieldControl = <T extends FieldValues>({
  name,
  control,
  errorMessage,
  maxLength,
  ...props
}: TextFieldControlProps<T>) => {
  const {
    field: { ref, ...controlProps },
    fieldState: { error },
  } = useController<T>({ name, control });

  const erMsg = errorMessage || (error && error.message);

  const { t_errors } = useTranslation();

  return (
    <TextField
      inputRef={ref}
      errorMessage={t_errors(erMsg as string)}
      slotProps={maxLength ? { htmlInput: { maxLength }, ...props.slotProps } : undefined}
      {...controlProps}
      {...props}
    />
  );
};
