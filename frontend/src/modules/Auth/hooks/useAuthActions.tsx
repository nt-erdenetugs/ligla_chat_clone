import { useMutation } from '@apollo/client';
import { useSnackbar } from 'notistack';

import {
  RequestPasswordResetDocument,
  type RequestPasswordResetMutation,
  ResetPasswordByTokenDocument,
  type ResetPasswordByTokenMutation,
  type UpdateDisplayNameMutation,
  UpdateDisplayNameDocument,
  type UpdateSenderNameMutation,
  UpdateSenderNameDocument,
  type ResetPasswordMutation,
  ResetPasswordDocument,
  RequestReInviteDocument,
  type RequestReInviteMutation,
} from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { handleApolloError } from '~/utils';

type RequestPasswordResetParams = {
  email: string;
};

type RequestReInviteParams = RequestPasswordResetParams;

type ResetPasswordByTokenParams = {
  token: string;
  newPassword: string;
};

type UpdatePasswordParams = {
  currentPassword: string;
  newPassword: string;
};

export const useAuthActions = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { t_toasts } = useTranslation();

  const [_requestPasswordReset, { loading: isRequestingPasswordReset }] =
    useMutation<RequestPasswordResetMutation>(RequestPasswordResetDocument, {
      onCompleted: () => {
        enqueueSnackbar(t_toasts('auth.success.resetLink'), { variant: 'success' });
      },
      onError: (error) => {
        const errorMessage = handleApolloError(error);
        enqueueSnackbar(errorMessage, { variant: 'error' });
      },
    });

  const [_requestReInvite, { loading: isRequestingReInvite }] =
    useMutation<RequestReInviteMutation>(RequestReInviteDocument, {
      onCompleted: () => {
        enqueueSnackbar(t_toasts('auth.success.reInvite'), { variant: 'success' });
      },
      onError: (error) => {
        const errorMessage = handleApolloError(error);
        enqueueSnackbar(errorMessage, { variant: 'error' });
      },
    });

  const [_updateDisplayName, { loading: isUpdatingDisplayName }] =
    useMutation<UpdateDisplayNameMutation>(UpdateDisplayNameDocument, {
      onCompleted: () => {
        enqueueSnackbar(t_toasts('auth.success.updateName'), { variant: 'success' });
      },
      onError: (error) => {
        const errorMessage = handleApolloError(error);
        enqueueSnackbar(errorMessage, { variant: 'error' });
      },
      refetchQueries: ['me', 'users'],
    });

  const [_updateSenderName, { loading: isUpdatingSenderName }] =
    useMutation<UpdateSenderNameMutation>(UpdateSenderNameDocument, {
      onCompleted: () => {
        enqueueSnackbar(t_toasts('auth.success.updateSenderName'), { variant: 'success' });
      },
      onError: (error) => {
        const errorMessage = handleApolloError(error);
        enqueueSnackbar(errorMessage, { variant: 'error' });
      },
      refetchQueries: ['me', 'users'],
    });

  const [_updatePassword, { loading: isUpdatingPassword }] = useMutation<ResetPasswordMutation>(
    ResetPasswordDocument,
    {
      onCompleted: () => {
        enqueueSnackbar(t_toasts('auth.success.updatePassword'), { variant: 'success' });
      },
      onError: (error) => {
        const errorMessage = handleApolloError(error);
        enqueueSnackbar(errorMessage, { variant: 'error' });
      },
    },
  );

  const [_resetPasswordByToken, { loading: isResettingPassword }] =
    useMutation<ResetPasswordByTokenMutation>(ResetPasswordByTokenDocument, {
      onCompleted: ({ resetPasswordByToken }) => {
        if (resetPasswordByToken.warning) {
          enqueueSnackbar(resetPasswordByToken.warning, { variant: 'warning' });
          return;
        }

        enqueueSnackbar(t_toasts('auth.success.resetPassword'), { variant: 'success' });
      },
      onError: (error) => {
        const errorMessage = handleApolloError(error);
        enqueueSnackbar(errorMessage, { variant: 'error' });
      },
    });

  const requestPasswordReset = async ({ email }: RequestPasswordResetParams) => {
    return await _requestPasswordReset({
      variables: {
        email,
      },
    });
  };

  const requestReInvite = async ({ email }: RequestReInviteParams) => {
    return await _requestReInvite({
      variables: {
        email,
      },
    });
  };

  const resetPasswordByToken = async ({ token, newPassword }: ResetPasswordByTokenParams) => {
    return await _resetPasswordByToken({
      variables: {
        resetPasswordByTokenInput: {
          token,
          newPassword,
        },
      },
    });
  };

  const updateDisplayName = (displayName: string) => {
    return _updateDisplayName({
      variables: {
        updateDisplayNameInput: { displayName },
      },
    });
  };

  const updateSenderName = (senderName: string) => {
    return _updateSenderName({
      variables: {
        updateSenderNameInput: { senderName },
      },
    });
  };

  const updatePassword = ({ currentPassword, newPassword }: UpdatePasswordParams) => {
    return _updatePassword({
      variables: {
        resetPasswordInput: {
          currentPassword,
          newPassword,
        },
      },
    });
  };

  return {
    isRequestingPasswordReset,
    isRequestingReInvite,
    requestPasswordReset,
    requestReInvite,
    isResettingPassword,
    resetPasswordByToken,
    isUpdatingDisplayName,
    updateDisplayName,
    isUpdatingSenderName,
    updateSenderName,
    updatePassword,
    isUpdatingPassword,
  };
};
