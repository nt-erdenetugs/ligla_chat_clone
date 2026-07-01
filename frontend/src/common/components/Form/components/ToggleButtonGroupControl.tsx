import { useController, type FieldValues, type UseControllerProps } from 'react-hook-form';

import { ToggleButtonGroup, type ToggleButtonGroupProps } from '.';

type ToggleButtonGroupControlProps<T extends FieldValues> = ToggleButtonGroupProps &
  UseControllerProps<T>;

export const ToggleButtonGroupControl = <T extends FieldValues>({
  name,
  control,
  errorMessage,
  ...props
}: ToggleButtonGroupControlProps<T>) => {
  const {
    field: { value, onChange },
    fieldState: { error },
  } = useController<T>({ name, control });

  const erMsg = (error && error.message) || errorMessage;

  return <ToggleButtonGroup errorMessage={erMsg} {...props} {...{ value, onChange, name }} />;
};
