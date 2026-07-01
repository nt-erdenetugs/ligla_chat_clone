import { ApolloError } from '@apollo/client';
import { enqueueSnackbar } from 'notistack';

import { useTranslation } from '~/locales/hooks';

export const useErrorHandledAction = () => {
  const { t_errors } = useTranslation();

  const showErrorNotification = (error: unknown) => {
    if (error instanceof ApolloError) {
      return enqueueSnackbar(error.message, { variant: 'error' });
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      return enqueueSnackbar(String(error.message), { variant: 'error' });
    }

    enqueueSnackbar(t_errors('commonError'), { variant: 'error' });
  };

  const executeAction = async (action: () => Promise<void>, onSuccess?: () => void) => {
    try {
      await action();
      if (onSuccess) {
        onSuccess();
      }
    } catch (e) {
      showErrorNotification(e);
    }
  };

  return {
    executeAction,
  };
};
