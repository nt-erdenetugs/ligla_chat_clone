import { type ReactNode } from 'react';

import { Stack, type StackProps, Typography, type TypographyProps } from '@mui/material';

type TitleCaptionProps = StackProps & {
  primary: string;
  secondary?: string;
  children?: ReactNode;
  titleProps?: TypographyProps;
  subTitleProps?: TypographyProps;
};

export const TitleCaption = ({
  primary,
  secondary,
  children,
  titleProps,
  subTitleProps,
  ...rest
}: TitleCaptionProps) => {
  return (
    <Stack
      direction='row'
      justifyContent='space-between'
      alignItems='center'
      whiteSpace='nowrap'
      {...rest}
    >
      <Stack direction='row' alignItems='end' gap={2}>
        <Typography variant='h6' fontWeight='bold' lineHeight='inherit' {...titleProps}>
          {primary}
        </Typography>
        {secondary && (
          <Typography variant='subtitle2' sx={{ color: '#222', ...subTitleProps }}>
            {secondary}
          </Typography>
        )}
      </Stack>
      <Stack direction='row' alignItems='center' gap={1}>
        {children}
      </Stack>
    </Stack>
  );
};
