import { useState, useEffect, useCallback } from 'react';

import { useLazyQuery, useMutation, useQuery } from '@apollo/client';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router';

import {
  CreateChatAssignFilterDocument,
  type CreateChatAssignFilterMutation,
  ChatAssignFilterDocument,
  type ChatAssignFilterQuery,
  ChatAssignFiltersDocument,
  type ChatAssignFiltersQuery,
  UpdateChatAssignFilterDocument,
  type UpdateChatAssignFilterMutation,
  DeleteChatAssignFilterDocument,
  type DeleteChatAssignFilterMutation,
  type ChatAssignFilter,
  type CreateChatAssignFilterInput,
  type UpdateChatAssignFilterInput,
} from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { PAGES, PAGES_PATH_MAP } from '~/routes/sidebar';
import { onError } from '~/utils';

export const useFiltersActions = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { t_toasts } = useTranslation();
  const navigate = useNavigate();

  const [filters, setFilters] = useState<ChatAssignFilter[]>([]);
  const [targetFilter, _setTargetFilter] = useState<Nullish<ChatAssignFilter>>(null);

  const { data: filtersData, loading: isFetchingAll } = useQuery<ChatAssignFiltersQuery>(
    ChatAssignFiltersDocument,
    {},
  );

  const [getFilter, { data: filterData, loading: isFetchingOne, error: getFilterError }] =
    useLazyQuery<ChatAssignFilterQuery>(ChatAssignFilterDocument, { errorPolicy: 'all' });

  const [_createFilter, { loading: isCreating }] = useMutation<CreateChatAssignFilterMutation>(
    CreateChatAssignFilterDocument,
    {
      refetchQueries: ['chatAssignFilters', 'selectableChatAssignFilters'],
      onCompleted: () => {
        enqueueSnackbar(t_toasts('chatAssignFilters.success.create'), { variant: 'success' });
      },
      onError,
    },
  );

  const [_updateFilter, { loading: isUpdating }] = useMutation<UpdateChatAssignFilterMutation>(
    UpdateChatAssignFilterDocument,
    {
      refetchQueries: ['chatAssignFilters', 'selectableChatAssignFilters'],
      onCompleted: () => {
        enqueueSnackbar(t_toasts('chatAssignFilters.success.update'), { variant: 'success' });
      },
      onError,
    },
  );

  const [_disableFilter, { loading: isDeleting }] = useMutation<DeleteChatAssignFilterMutation>(
    DeleteChatAssignFilterDocument,
    {
      refetchQueries: ['chatAssignFilters', 'selectableChatAssignFilters'],
      onCompleted: () => {
        enqueueSnackbar(t_toasts('chatAssignFilters.success.delete'), { variant: 'success' });
      },
      onError,
    },
  );

  const disableFilter = async (id: string) => {
    await _disableFilter({
      variables: {
        id,
      },
    });
  };

  useEffect(() => {
    if (!filtersData) return;

    setFilters(filtersData.chatAssignFilters?.items || []);
  }, [filtersData]);

  useEffect(() => {
    if (!filterData) return;

    _setTargetFilter(filterData.chatAssignFilter);
  }, [filterData]);

  useEffect(() => {
    if (getFilterError) {
      console.error(getFilterError.message);
      enqueueSnackbar(getFilterError.message, { variant: 'error' });
      navigate(`/${PAGES_PATH_MAP[PAGES.ASSIGN_RULES]}`, { replace: true });
    }
  }, [getFilterError, navigate, enqueueSnackbar]);

  const setTargetFilter = useCallback(
    (id: string) => {
      const currentData = filters.find((filter) => filter.id === id);
      if (currentData) return _setTargetFilter(currentData);

      getFilter({ variables: { id } });
    },
    [getFilter, filters],
  );

  const removeTargetFilter = () => {
    _setTargetFilter(null);
  };

  const createFilter = async (
    inputs: CreateChatAssignFilterInput,
    onSuccess?: (response?: ChatAssignFilter) => void,
  ) => {
    const result = await _createFilter({
      variables: {
        createChatAssignFilterInput: {
          ...inputs,
        },
      },
    });

    onSuccess?.(result.data?.createChatAssignFilter);
  };

  const updateFilter = async (inputs: Omit<UpdateChatAssignFilterInput, 'id'>) => {
    if (!targetFilter) {
      enqueueSnackbar(t_toasts('chatAssignFilters.error.noFilterSelected'), { variant: 'error' });
      return;
    }

    await _updateFilter({
      variables: {
        updateChatAssignFilterInput: {
          id: targetFilter.id,
          ...inputs,
        },
      },
    });
  };

  const toggleFilterStatus = async (id: string) => {
    const filter = filters.find((r) => r.id === id);
    if (!filter) return;

    await _updateFilter({
      variables: {
        updateChatAssignFilterInput: {
          id,
          isActive: !filter.isActive,
        },
      },
    });
  };

  return {
    filters,
    targetFilter,
    isFetchingAll,
    isFetchingOne,
    isCreating,
    isUpdating,
    isDeleting,
    setTargetFilter,
    removeTargetFilter,
    createFilter,
    updateFilter,
    disableFilter,
    toggleFilterStatus,
  };
};
