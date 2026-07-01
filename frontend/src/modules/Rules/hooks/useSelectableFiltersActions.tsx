import { useState, useEffect } from 'react';

import { useQuery } from '@apollo/client';

import {
  type ChatAssignFilterItem,
  type SelectableChatAssignFiltersQuery,
  SelectableChatAssignFiltersDocument,
} from '~/generated/graphql/types';

export const useSelectableFiltersActions = () => {
  const [filters, setFilters] = useState<ChatAssignFilterItem[]>([]);

  const { data: filtersData, loading: isFetchingAll } = useQuery<SelectableChatAssignFiltersQuery>(
    SelectableChatAssignFiltersDocument,
    {},
  );

  useEffect(() => {
    if (!filtersData) return;

    setFilters(filtersData.selectableChatAssignFilters || []);
  }, [filtersData]);

  return {
    filters,
    isFetchingAll,
  };
};
