import { useMemo, useState, useCallback, useRef, useEffect } from 'react';

import { type LazyQueryHookOptions, useLazyQuery, ApolloError } from '@apollo/client';
import { type DocumentNode } from 'graphql';
import { useSnackbar } from 'notistack';

import { useTranslation } from '~/locales/hooks';

export const QUERY_RESPONSE_KEYS = {
  managers: 'managers',
  allSelectableOperators: 'allSelectableOperators',
  storesCursor: 'storesCursor',
  chats: 'chats',
  chatData: 'chatData',
  adminOperators: 'adminOperators',
  cursorPaginatedTags: 'cursorPaginatedTags',
} as const;

type ItemTypeBase = {
  id: string;
  createdAt: Date;
};

type Options = {
  pickAll?: boolean;
  extraParams?: Record<string, unknown>;
  debounceDelay?: number;
  lazyQueryOptions?: LazyQueryHookOptions;
  eventCallbacks?: {
    onCompleted?: (data: any) => void;
    onUpdated?: (data: any) => void;
    onError?: (error: ApolloError) => void;
  };
  skipInitialFetch?: boolean;
  itemsPerPage?: number;
};

const ABORT_ERROR = 'The operation was aborted.';

const extractItemsAndCursor = <T>(
  data: any,
  key: string,
): {
  items: Array<T>;
  nextCursorId: Nullable<string>;
  nextCursorCreatedAt: Nullable<Date>;
  nextCursorDateParam: Nullable<Date>;
  nextCursorIntParam: Nullable<number>;
} => ({
  items: (data?.[key]?.items ?? []) as Array<T>,
  nextCursorId: (data?.[key]?.nextCursorId as string) ?? null,
  nextCursorCreatedAt: (data?.[key]?.nextCursorCreatedAt as Date) ?? null,
  nextCursorDateParam: (data?.[key]?.nextCursorDateParam as Date) ?? null,
  nextCursorIntParam: (data?.[key]?.nextCursorIntParam as number) ?? null,
});

export const useInfiniteQuery = <
  K extends keyof typeof QUERY_RESPONSE_KEYS,
  T extends Record<string, any>,
  ItemType = T[K] extends { items: Array<infer I> } ? I : never,
>(
  queryDoc: DocumentNode,
  key: K,
  {
    pickAll = false,
    extraParams = {},
    debounceDelay = 300,
    lazyQueryOptions = {},
    eventCallbacks = {},
    skipInitialFetch = false,
    itemsPerPage = 20,
  }: Options = {},
) => {
  const { enqueueSnackbar } = useSnackbar();
  const { t_errors } = useTranslation();

  const [cursorId, setCursor] = useState<string | null>();
  const [cursorCreatedAt, setCursorCreatedAt] = useState<Date | null>();
  const [cursorDateParam, setCursorDateParam] = useState<Date | null>();
  const [cursorIntParam, setCursorIntParam] = useState<number | null>();
  const [allItems, setAllItems] = useState<Array<ItemType> | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApolloError>();

  const initialFetch = useRef(true);

  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const timeoutRef = useRef<number>(null);

  const queryVariables = useMemo(
    () => ({
      cursor: null,
      cursorCreatedAt: null,
      cursorDateParam: null,
      cursorIntParam: null,
      take: !pickAll ? itemsPerPage : undefined,
      ...extraParams,
    }),
    [extraParams, pickAll, itemsPerPage],
  );

  const prevQueryVars = useRef<Optional<typeof queryVariables>>(queryVariables);

  const resetAbortController = useCallback(() => {
    if (abortController) {
      abortController.abort(ABORT_ERROR);
    }
    const newAbortController = new AbortController();
    setAbortController(newAbortController);
  }, [abortController]);

  const [executeQuery, { data, error: queryError, fetchMore, refetch: _refetch }] = useLazyQuery<T>(
    queryDoc,
    lazyQueryOptions,
  );

  useEffect(() => {
    if (!data) return;

    const { items, nextCursorId, nextCursorCreatedAt, nextCursorDateParam, nextCursorIntParam } =
      extractItemsAndCursor<ItemType>(data, key);

    if (!cursorId) {
      setAllItems(items);
      setCursor(nextCursorId);
      setCursorCreatedAt(nextCursorCreatedAt);
      setCursorDateParam(nextCursorDateParam);
      setCursorIntParam(nextCursorIntParam);
    }

    if (eventCallbacks.onCompleted && initialFetch.current) {
      eventCallbacks.onCompleted(items);
      initialFetch.current = false;
    }

    if (eventCallbacks.onUpdated) {
      eventCallbacks.onUpdated(items);
    }

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (!queryError) return;

    setLoading(false);
    setError(queryError);
    if (eventCallbacks.onError) {
      eventCallbacks.onError(queryError);
      return;
    }
    enqueueSnackbar(t_errors('failedToFetchRefreshAgain'), { variant: 'error' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryError]);

  const debouncedExecute = useCallback(
    (variables?: typeof queryVariables) => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      setLoading(true);
      timeoutRef.current = window.setTimeout(() => {
        prevQueryVars.current = variables;
        executeQuery({ variables: variables || queryVariables });
      }, debounceDelay);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debounceDelay, executeQuery],
  );

  useEffect(() => {
    if (!skipInitialFetch) {
      debouncedExecute();
    }

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [debouncedExecute, skipInitialFetch]);

  const refetch = useCallback(() => {
    const take = allItems?.length || itemsPerPage;

    const updatedVariables = {
      ...prevQueryVars.current,
      take,
    };

    _refetch(updatedVariables).then(({ data }) => {
      if (!data) return;
      const { items, nextCursorId, nextCursorCreatedAt, nextCursorDateParam, nextCursorIntParam } =
        extractItemsAndCursor<ItemType>(data, key);

      setAllItems(items);
      setCursor(nextCursorId);
      setCursorCreatedAt(nextCursorCreatedAt);
      setCursorDateParam(nextCursorDateParam);
      setCursorIntParam(nextCursorIntParam);
    });
  }, [_refetch, allItems?.length, itemsPerPage, key]);

  const mergeUniqueItems = useCallback(
    (existingItems: Array<ItemType>, newItems: Array<ItemType>): Array<ItemType> => {
      const existingIds = new Set(existingItems.map((item) => (item as ItemTypeBase).id));
      return [
        ...existingItems,
        ...newItems.filter((item) => !existingIds.has((item as ItemTypeBase).id)),
      ];
    },
    [],
  );

  const hasMore = useMemo(() => data?.[key]?.hasMore as boolean | undefined, [data, key]);

  const loadMore = useCallback(async () => {
    if (loading || !cursorId || !hasMore || error) return;

    try {
      setLoading(true);
      await fetchMore({
        variables: {
          ...queryVariables,
          cursorId,
          cursorCreatedAt,
          cursorDateParam,
          cursorIntParam,
        },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult) return prev;

          const {
            items: newItems,
            nextCursorId,
            nextCursorCreatedAt,
            nextCursorDateParam,
            nextCursorIntParam,
          } = extractItemsAndCursor<ItemType>(fetchMoreResult, key);

          setAllItems((prevItems) => mergeUniqueItems(prevItems ?? [], newItems));
          setCursor(nextCursorId);
          setCursorCreatedAt(nextCursorCreatedAt);
          setCursorDateParam(nextCursorDateParam);
          setCursorIntParam(nextCursorIntParam);
          setLoading(false);

          return {
            ...prev,
            [key]: {
              ...fetchMoreResult[key],
              items: mergeUniqueItems((prev[key]?.items ?? []) as Array<ItemType>, newItems),
              nextCursor: nextCursorId,
              nextCursorCreatedAt,
              nextCursorDateParam,
              nextCursorIntParam,
              hasMore: fetchMoreResult[key]?.hasMore as boolean,
            },
          };
        },
        context: {
          fetchOptions: {
            signal: abortController?.signal,
          },
        },
      });
    } catch (error) {
      if (error instanceof ApolloError) {
        if (error.message.trim() !== ABORT_ERROR) {
          enqueueSnackbar(error.message, { variant: 'error' });
          setError(error);
        }
      }
      setLoading(false);
    }
  }, [
    cursorId,
    cursorCreatedAt,
    cursorDateParam,
    cursorIntParam,
    loading,
    fetchMore,
    queryVariables,
    key,
    error,
    abortController?.signal,
    hasMore,
    enqueueSnackbar,
    mergeUniqueItems,
  ]);

  // Function to refresh the query with new parameters
  const getData = useCallback(
    (newParams?: Record<string, unknown>, keepTake: boolean = false) => {
      setCursor(null);
      setCursorCreatedAt(null);
      setCursorDateParam(null);
      setCursorIntParam(null);
      setAllItems(undefined);
      setError(undefined);
      resetAbortController();

      const updatedVariables = {
        ...queryVariables,
        take: keepTake ? allItems?.length : itemsPerPage,
        cursorId: keepTake ? queryVariables.cursor : null,
        cursorCreatedAt: keepTake ? queryVariables.cursorCreatedAt : null,
        cursorDateParam: keepTake ? queryVariables.cursorDateParam : null,
        cursorIntParam: keepTake ? queryVariables.cursorIntParam : null,
        ...newParams,
      };

      debouncedExecute(updatedVariables);
    },
    [debouncedExecute, queryVariables, allItems?.length, itemsPerPage, resetAbortController],
  );

  return {
    data: allItems,
    rawData: data,
    loading,
    loadMore,
    getData,
    refetch,
    fetchedAll: !hasMore,
    error,
    cursorId,
    cursorCreatedAt,
    cursorDateParam,
    cursorIntParam,
  };
};
