import { type FieldValues, useController, type UseControllerProps } from 'react-hook-form';

import { OutlinedInput, type OutlinedInputProps } from '~/common/components';
import { useTranslation } from '~/locales/hooks';

export type OutlinedInputControlProps<T extends FieldValues> = OutlinedInputProps &
  UseControllerProps<T>;

export const OutlinedInputControl = <T extends FieldValues>({
  name,
  control,
  errorMessage,
  sx,
  ...props
}: OutlinedInputControlProps<T>) => {
  const {
    field: { ref, ...controlProps },
    fieldState: { error },
  } = useController<T>({ name, control });

  const erMsg = (error && error.message) || errorMessage;

  const { t_errors } = useTranslation();

  return (
    <OutlinedInput
      inputRef={ref}
      errorMessage={t_errors(erMsg as string)}
      sx={sx}
      {...controlProps}
      {...props}
    />
  );
};
