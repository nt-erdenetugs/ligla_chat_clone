import { type FieldValues, useController, type UseControllerProps } from 'react-hook-form';

import { Autocomplete, type AutocompleteProps } from '~/common/components';
import { useTranslation } from '~/locales/hooks';

type AutocompleteControlteProps<T extends FieldValues> = UseControllerProps<T> & AutocompleteProps;

export const AutocompleteControl = <T extends FieldValues>({
  name,
  control,
  errorMessage,
  ...props
}: AutocompleteControlteProps<T>) => {
  const {
    field: { ref, onChange, ...controlProps },
    fieldState: { error },
  } = useController<T>({ name, control });

  const erMsg = (error && error.message) || errorMessage;

  const { t_errors } = useTranslation();

  return (
    <Autocomplete
      inputRef={ref}
      onChange={(_, value) => onChange((value && value.value) ?? '')}
      errorMessage={t_errors(erMsg as string)}
      {...controlProps}
      {...props}
    />
  );
};
