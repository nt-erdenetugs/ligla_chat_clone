import { Tooltip } from '@mui/material';
import { type FieldValues, useController, type UseControllerProps } from 'react-hook-form';

import { MultipleAutocomplete, type MultipleAutocompleteProps } from '~/common/components';
import { useTranslation } from '~/locales/hooks';

type MultipleAutocompleteControlProps<
  T extends FieldValues,
  D extends string | undefined,
> = UseControllerProps<T> & MultipleAutocompleteProps<D>;

export const MultipleAutocompleteControl = <T extends FieldValues, D extends string | undefined>({
  name,
  control,
  errorMessage,
  disabled,
  tooltipTitle,
  ...props
}: MultipleAutocompleteControlProps<T, D> & { tooltipTitle?: string }) => {
  const {
    field: { ref, ...controlProps },
    fieldState: { error },
  } = useController<T>({ name, control });

  const erMsg = (error && error.message) || errorMessage;

  const { t_errors } = useTranslation();

  const autocomplete = (
    <MultipleAutocomplete
      inputRef={ref}
      errorMessage={t_errors(erMsg as string)}
      disabled={disabled}
      {...controlProps}
      {...props}
    />
  );

  if (disabled && tooltipTitle) {
    return (
      <Tooltip title={tooltipTitle}>
        <div>{autocomplete}</div>
      </Tooltip>
    );
  }

  return autocomplete;
};
