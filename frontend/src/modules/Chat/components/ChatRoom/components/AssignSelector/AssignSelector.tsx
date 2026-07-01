import { memo, lazy, Suspense } from 'react';

import { Stack, type SxProps, Skeleton } from '@mui/material';

export type AssignSelectorBaseProps = {
  onChange?: () => void;
};

const MultiTeamSelector = lazy(() =>
  import('./MultiTeamSelector').then((mod) => ({ default: mod.MultiTeamSelector })),
);

const OperatorSelector = lazy(() =>
  import('./OperatorSelector').then((mod) => ({ default: mod.OperatorSelector })),
);

const SelectorFallback = () => <Skeleton variant='rounded' height={40} width='100%' />;

const stackStyles: SxProps = {
  width: '100%',
  display: 'flex',
  gap: 1,
  direction: 'column',
  alignItems: 'center',
};
export const AssignSelector = memo((props: AssignSelectorBaseProps) => {
  return (
    <Stack sx={stackStyles}>
      <Suspense fallback={<SelectorFallback />}>
        <MultiTeamSelector {...props} />
      </Suspense>
      <Suspense fallback={<SelectorFallback />}>
        <OperatorSelector {...props} />
      </Suspense>
    </Stack>
  );
});

AssignSelector.displayName = 'AssignSelector';
