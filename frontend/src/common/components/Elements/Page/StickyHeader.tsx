import { type ReactNode } from 'react';

import { Stack } from '@mui/material';

import { Title } from '~/common/components';

type Props = {
  title: string;
  subTitle?: string;
  children?: ReactNode;
};

export const StickyHeader = ({ title, subTitle, children }: Props) => {
  return (
    <Title
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: 'none',
      }}
      title={title}
      subTitle={subTitle}
    >
      <Stack direction='row' gap={2}>
        {children}
      </Stack>
    </Title>
  );
};
