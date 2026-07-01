import { useCallback, useState } from 'react';

export const DEFAULT_ROWS_PER_PAGE = 25 as const;
const ROWS_PER_PAGE_STORAGE_KEY = 'rowsPerPage';

export type PageParams = {
  page: number;
  per: number;
  count?: number;
  total?: number;
};

export const usePagination = (customPagination?: boolean) => {
  const [pageParams, setPageParams] = useState<PageParams>({
    page: 1,
    per: rowsPerPage(customPagination),
  });

  const setPage = useCallback((page: number) => {
    setPageParams((prev) => ({ ...prev, page }));
  }, []);

  const setRowsPerPage = useCallback(
    (per: number) => {
      if (!customPagination) {
        localStorage.setItem(ROWS_PER_PAGE_STORAGE_KEY, String(per));
      }
      setPageParams((prev) => ({ ...prev, per }));
    },
    [customPagination],
  );

  return { pageParams, setPage, setRowsPerPage };
};

export const rowsPerPage = (custom?: boolean) => {
  const cachedValue = custom ? 10 : localStorage.getItem(ROWS_PER_PAGE_STORAGE_KEY);
  return Number(cachedValue) || DEFAULT_ROWS_PER_PAGE;
};
