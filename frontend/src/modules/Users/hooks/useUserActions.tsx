import { useState, useCallback, useEffect } from 'react';

import { useApolloClient, useLazyQuery, useMutation } from '@apollo/client';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router';

import { UserStatusType } from '~/common/constants';
import {
  CreateUserDocument,
  type CreateUserMutation,
  CheckUserExistsDocument,
  type CheckUserExistsQuery,
  RemoveUserDocument,
  type RemoveUserMutation,
  UpdateUserDocument,
  type UpdateUserMutation,
  UserDocument,
  type UserQuery,
  type ToggleUserStatusMutation,
  ToggleUserStatusDocument,
} from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { type Inputs, type IUser } from '~/modules/Users';
import { PAGES } from '~/routes/sidebar';
import { onError } from '~/utils';

type ID = IUser['id'];

export const useUserActions = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { t_toasts } = useTranslation();
  const navigate = useNavigate();
  const client = useApolloClient();

  const [targetUser, _setTargetUser] = useState<Nullish<IUser>>(null);

  const [getUser, { data: userData, loading: isFetchingOne, error }] = useLazyQuery<UserQuery>(
    UserDocument,
    {
      errorPolicy: 'all',
    },
  );

  useEffect(() => {
    if (!userData) return;
    _setTargetUser(userData.user);
  }, [userData]);

  useEffect(() => {
    if (error) {
      console.error(error.message);
      enqueueSnackbar(error.message, { variant: 'error' });
      navigate(`/${PAGES.USERS}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const [_checkUserExists, { loading: isCheckingUser }] = useLazyQuery<CheckUserExistsQuery>(
    CheckUserExistsDocument,
    {},
  );

  const [_createUser, { loading: isCreating }] = useMutation<CreateUserMutation>(
    CreateUserDocument,
    {
      refetchQueries: ['users', 'managers', 'operators', 'me'],
      onError,
      onCompleted: () => {
        enqueueSnackbar(t_toasts('user.success.create'), { variant: 'success' });
      },
    },
  );

  const [_updateUser, { loading: isUpdating }] = useMutation<UpdateUserMutation>(
    UpdateUserDocument,
    {
      refetchQueries: ['users', 'managers', 'operators', 'me'],
      onError,
      onCompleted: () => {
        enqueueSnackbar(t_toasts('user.success.update'), { variant: 'success' });
      },
    },
  );

  const [_toggleUserStatus] = useMutation<ToggleUserStatusMutation>(ToggleUserStatusDocument, {
    refetchQueries: ['users', 'managers', 'operators', 'me'],
    onError,
    onCompleted: (data) => {
      if (!data.toggleUserStatus) return;
      _setTargetUser(data.toggleUserStatus);
      enqueueSnackbar(t_toasts('user.success.update'), { variant: 'success' });
    },
  });

  const [_removeUser] = useMutation<RemoveUserMutation>(RemoveUserDocument, {
    refetchQueries: ['users', 'managers', 'operators', 'me'],
    onError,
    onCompleted: () => {
      enqueueSnackbar(t_toasts('user.success.disable'), { variant: 'success' });
    },
  });

  const setTargetUser = useCallback(
    (id: ID) => {
      getUser({
        variables: { id },
      });
    },
    [getUser],
  );

  const updatePictureUrl = (pictureUrl: string) => {
    _setTargetUser((prevUser) =>
      prevUser
        ? {
            ...prevUser,
            pictureUrl,
          }
        : prevUser,
    );
    client.refetchQueries({
      include: ['users', 'me'],
    });
  };

  const removeTargetUser = () => {
    _setTargetUser(null);
  };

  const createUser = async (inputs: Inputs) => {
    await _createUser({
      variables: {
        createUserInput: {
          ...inputs,
        },
      },
    });
  };

  const updateUser = async (id: string, { email: _, isActive, ...inputs }: Inputs) => {
    const status = isActive ? UserStatusType.ACTIVE : UserStatusType.INACTIVE;

    await _updateUser({
      variables: {
        updateUserInput: {
          id,
          ...inputs,
          status,
        },
      },
    });
  };

  const toggleUserStatus = async (id: ID) => {
    await _toggleUserStatus({
      variables: {
        id,
      },
    });
  };

  const removeUser = async (id: ID) => {
    await _removeUser({
      variables: {
        id,
      },
    });
  };

  const checkUserExists = async (email: string): Promise<boolean> => {
    const { data } = await _checkUserExists({
      variables: {
        email,
      },
    });

    return !!data?.checkUserExists;
  };

  return {
    targetUser,
    isFetchingOne,
    isCreating,
    isUpdating,
    setTargetUser,
    updatePictureUrl,
    removeTargetUser,
    createUser,
    updateUser,
    toggleUserStatus,
    removeUser,
    checkUserExists,
    isCheckingUser,
  };
};
