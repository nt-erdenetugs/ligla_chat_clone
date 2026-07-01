import { useState, useCallback, useEffect } from 'react';

import { useLazyQuery } from '@apollo/client';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router';

import { StoreDocument, type StoreQuery } from '~/generated/graphql/types';
import { type IStore } from '~/modules/Stores';
import { PAGES } from '~/routes/sidebar';

type ID = IStore['id'];

export const useStoreActions = () => {
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const [stores] = useState<IStore[]>([]);
  const [targetStore, _setTargetStore] = useState<Nullish<IStore>>(null);

  const [getStore, { data: storeData, loading: isFetchingOne, error }] = useLazyQuery<StoreQuery>(
    StoreDocument,
    {
      errorPolicy: 'all',
    },
  );

  useEffect(() => {
    if (!storeData) return;
    _setTargetStore(storeData.store);
  }, [storeData]);

  useEffect(() => {
    if (error) {
      console.error(error.message);
      enqueueSnackbar(error.message, { variant: 'error' });
      navigate(`/${PAGES.STORES}`, { replace: true });
    }
  }, [error, navigate, enqueueSnackbar]);

  const setTargetStore = useCallback(
    (id: ID) => {
      const currentData = stores.find((store) => store.id === id);

      if (currentData) {
        _setTargetStore(currentData);
      } else {
        getStore({
          variables: { id },
        });
      }
    },
    [getStore, stores],
  );

  const removeTargetStore = () => {
    _setTargetStore(null);
  };

  return {
    stores,
    targetStore,
    isFetchingOne,
    setTargetStore,
    removeTargetStore,
  };
};
