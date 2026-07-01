import { type ReactNode } from 'react';

import { Skeleton, type SkeletonProps } from '@mui/material';

type PropsType = {
  children: ReactNode;
  isLoading: boolean;
  skeletonProps?: SkeletonProps;
};

export const SkeletonSuspense = ({
  children,
  isLoading,
  skeletonProps,
}: PropsType): JSX.Element => {
  return isLoading ? <Skeleton {...skeletonProps} /> : <>{children}</>;
};
