import { Stack, Switch, Typography, type SwitchProps } from '@mui/material';
import { type FieldValues, useController, type UseControllerProps } from 'react-hook-form';

import { FieldWrapper, type FieldLabelProps } from './components';

export type SwitchControlProps<T extends FieldValues> = {
  endText?: string;
  startText?: string;
} & FieldLabelProps &
  SwitchProps &
  UseControllerProps<T>;

export const SwitchControl = <T extends FieldValues>({
  name,
  control,
  endText,
  startText,
  label,
  wrapperProps,
  labelProps,
  ...props
}: SwitchControlProps<T>) => {
  const {
    field: { ref, ...controlProps },
  } = useController({ name, control });

  return (
    <FieldWrapper width='100%' label={label} labelProps={labelProps} {...wrapperProps}>
      <Stack direction='row' gap={1} alignItems='center' flexWrap='wrap'>
        {endText && <Typography>{endText}</Typography>}
        <Switch
          inputRef={ref}
          inputProps={{ 'aria-label': 'controlled' }}
          checked={controlProps.value}
          {...controlProps}
          {...props}
        />
        {startText && <Typography>{startText}</Typography>}
      </Stack>
    </FieldWrapper>
  );
};
