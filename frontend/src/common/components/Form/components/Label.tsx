import { type ReactNode } from 'react';

import { Typography, type TypographyProps } from '@mui/material';

export type LabelProps = TypographyProps & {
  text: ReactNode;
  required?: boolean;
  mb?: number | string;
  error?: boolean;
};

export const Label = ({ text, required, mb = '4px', error, ...other }: LabelProps) => {
  return (
    <Typography
      fontSize='0.875rem'
      sx={{
        mb,
        ...(required && {
          ':after': { content: '"*"', color: (theme) => theme.palette.error.main, ml: 0.5 },
        }),
        ...(error && { color: (theme) => theme.palette.error.main }),
      }}
      fontWeight='bold'
      {...other}
    >
      {text}
    </Typography>
  );
};
