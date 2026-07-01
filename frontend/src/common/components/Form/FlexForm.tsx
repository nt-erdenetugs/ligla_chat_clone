import { type DetailedHTMLProps, type FormHTMLAttributes } from 'react';

import { type SxProps } from '@mui/material';
import { styled } from '@mui/material/styles';

export const Form = styled('form')({
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
});

export type FlexFormProps = DetailedHTMLProps<
  FormHTMLAttributes<HTMLFormElement>,
  HTMLFormElement
> & {
  sx?: SxProps;
  width?: number | string;
};

export const FlexForm = ({ sx, width = 500, children, ...props }: FlexFormProps) => {
  return (
    <Form noValidate sx={{ width, ...sx }} {...props}>
      {children}
    </Form>
  );
};
