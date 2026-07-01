import { useEffect, useMemo } from 'react';

import { type DocumentNode, useQuery } from '@apollo/client';
import { useSnackbar } from 'notistack';

import { type Row, type TableKey } from '~/common/components/Elements/DataTableWithHeader';
import { usePaginationContext } from '~/context/PaginationContext';
import { useTranslation } from '~/locales/hooks';
import { isMemberFeedORSurveyColumn, isOrganization, isUser } from '~/utils';

import { UserStatusType } from '../constants';

type PaginatedItem<T> = T[] | { items: T[]; count: number };

type PaginatedResponse<T> = Record<TableKey, PaginatedItem<T>> & {
  count?: number;
};

const normalizeData = <T>(data: T) => {
  if (isUser(data)) return { ...data, isActive: data.status === UserStatusType.ACTIVE };
  if (isOrganization(data)) return { ...data, id: data.name };
  if (isMemberFeedORSurveyColumn(data)) return { ...data, isActive: true };
  return data;
};

const mappers: Partial<Record<TableKey, <T>(item: T) => T>> = {
  users: normalizeData,
  organizations: normalizeData,
  memberFeedColumns: normalizeData,
  surveyColumns: normalizeData,
};

export const usePaginatedQuery = (
  query: DocumentNode,
  tableKey: TableKey,
  extraParams?: object,
) => {
  const { enqueueSnackbar } = useSnackbar();
  const { t_errors } = useTranslation();
  const { pageParams } = usePaginationContext();
  const { per, page } = pageParams;

  const variables = useMemo(
    () => ({
      skip: per * (page - 1),
      take: per,
      ...extraParams,
    }),
    [per, page, extraParams],
  );

  const { data, loading, error } = useQuery<PaginatedResponse<Row>>(query, {
    variables,

    errorPolicy: 'all',
  });

  useEffect(() => {
    if (error) {
      enqueueSnackbar(t_errors('failedToFetchRefreshAgain'), { variant: 'error' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const totalPages = useMemo(() => {
    const tableData = data?.[tableKey] as {
      items?: [];
      count?: number;
    };
    const count = tableData && typeof tableData.count === 'number' ? tableData.count : data?.count;
    return count && !isNaN(count) ? Math.ceil(count / per) : 1;
  }, [data, per, tableKey]);

  const normalizedData = useMemo(() => {
    if (!data) return null;

    const tableResult = (data as Record<string, unknown>)[tableKey];

    let rows: Row[] = [];

    if (Array.isArray(tableResult)) {
      rows = tableResult as Row[];
    } else if (tableResult && typeof tableResult === 'object') {
      const tableObject = tableResult as { [k: string]: unknown };
      if (Array.isArray(tableObject.items)) rows = tableObject.items as Row[];
    }

    const normalize = mappers[tableKey];
    return normalize ? rows.map(normalize) : rows;
  }, [data, tableKey]);

  return {
    data: normalizedData,
    rawData: data,
    loading,
    totalPages,
  };
};
