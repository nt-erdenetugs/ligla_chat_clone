import { type ReactNode } from 'react';

import { Stack } from '@mui/material';

import { LabelHintIcon } from './LabelHintIcon';

type LabelWithHintProps = {
  label: ReactNode;
  hint: ReactNode;
};

export const LabelWithHint = ({ label, hint }: LabelWithHintProps) => (
  <Stack direction='row' alignItems='center' gap={0.5}>
    {label}
    <LabelHintIcon title={hint} />
  </Stack>
);
