import { type ReactNode } from 'react';

import { Loading, type LoadingProps } from './Page';

type PropsType = LoadingProps & {
  children: ReactNode;
  isLoading: boolean;
};

export const Suspense = ({ children, isLoading, ...loadingProps }: PropsType): JSX.Element => {
  return isLoading ? <Loading {...loadingProps} /> : <>{children}</>;
};
