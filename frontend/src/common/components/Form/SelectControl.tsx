import { useController, type FieldValues, type UseControllerProps } from 'react-hook-form';

import { Select, type SelectProps } from './Select';

export type SelectControlProps<T extends FieldValues> = SelectProps & UseControllerProps<T>;

export const SelectControl = <T extends FieldValues>({
  name,
  control,
  errorMessage,
  onChange,
  ...props
}: SelectControlProps<T>) => {
  const {
    field: { value, onChange: onChangeField },
    fieldState: { error },
  } = useController<T>({ name, control });

  const erMsg = (error && error.message) || errorMessage;

  return (
    <Select
      onChange={(value, ...args) => {
        onChangeField(value, ...args);
        onChange?.(value, ...args);
      }}
      errorMessage={erMsg}
      {...props}
      {...{ value, name }}
    />
  );
};
