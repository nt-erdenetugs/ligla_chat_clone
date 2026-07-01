import { createContext, useContext } from 'react';

import { usePagination, type PageParams } from '~/common/hooks';

type PaginationContextProps = {
  pageParams: PageParams;
  setPage: (page: number) => void;
  setRowsPerPage: (per: number) => void;
};

const PaginationContext = createContext<PaginationContextProps>({
  pageParams: { page: 1, per: 25 },
  setPage: () => {},
  setRowsPerPage: () => {},
});

type PaginationProviderProps = {
  children: React.ReactNode;
  customPagination?: boolean;
};

export const PaginationProvider = ({ children, customPagination }: PaginationProviderProps) => {
  const pagination = usePagination(customPagination);

  return <PaginationContext.Provider value={pagination}>{children}</PaginationContext.Provider>;
};

export const usePaginationContext = () => {
  return useContext(PaginationContext);
};
