import { Checkbox, Stack, Typography, type CheckboxProps } from '@mui/material';
import {
  type FieldValues,
  useController,
  type UseControllerProps,
  type ControllerRenderProps,
} from 'react-hook-form';

import { FieldWrapper, type FieldLabelProps } from './components';

export type CheckboxControlRenderProps = Omit<ControllerRenderProps, 'ref'>;

export type CheckboxControlProps<T extends FieldValues> = {
  endText?: string;
  checkBoxText?: string;
  checkBoxElement?: (props: CheckboxControlRenderProps) => React.JSX.Element;
} & FieldLabelProps &
  CheckboxProps &
  UseControllerProps<T>;

export const CheckboxControl = <T extends FieldValues>({
  name,
  control,
  checkBoxText,
  checkBoxElement,
  wrapperProps,
  labelProps,
  label,
  ...props
}: CheckboxControlProps<T>) => {
  const {
    field: { ref, ...controlProps },
  } = useController({ name, control });

  return (
    <FieldWrapper width='100%' label={label} labelProps={labelProps} {...wrapperProps}>
      <Stack direction='row' gap={1} alignItems='center' flexWrap='wrap'>
        {!checkBoxElement ? (
          <>
            <Checkbox inputRef={ref} checked={!!controlProps.value} {...controlProps} {...props} />
            {checkBoxText && <Typography>{checkBoxText}</Typography>}
          </>
        ) : (
          checkBoxElement(controlProps)
        )}
      </Stack>
    </FieldWrapper>
  );
};
