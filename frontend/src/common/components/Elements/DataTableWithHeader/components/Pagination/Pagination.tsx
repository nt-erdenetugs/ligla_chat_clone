import { useMemo } from 'react';

import { Pagination as MuiPagination, Stack } from '@mui/material';

import { usePaginationContext } from '~/context/PaginationContext';

type PaginationProps = {
  totalPages?: number;
};

export const Pagination = ({ totalPages }: PaginationProps) => {
  const {
    pageParams: { page },
    setPage,
  } = usePaginationContext();

  const count = useMemo(() => {
    return totalPages ?? page;
  }, [page, totalPages]);

  return (
    <Stack width='100%' alignItems='center' py={2}>
      <MuiPagination
        page={page}
        count={count}
        onChange={(_e, value) => setPage(value)}
        color='primary'
        {...(!totalPages && {
          boundaryCount: 0,
          siblingCount: 0,
        })}
      />
    </Stack>
  );
};
