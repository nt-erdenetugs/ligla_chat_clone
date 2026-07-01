import { useMutation } from '@apollo/client';
import { useSnackbar } from 'notistack';

import {
  type CreateNoteMutation,
  CreateNoteDocument,
  type RemoveNoteMutation,
  RemoveNoteDocument,
  type UpdateNoteMutation,
  UpdateNoteDocument,
} from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { onError } from '~/utils';

import type { Inputs } from '../types';

export const useNoteActions = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { t_toasts } = useTranslation();

  const handleOnCompleted = (text: string) => {
    enqueueSnackbar(text, { variant: 'success' });
  };

  const [_createNote, { loading: isCreating }] = useMutation<CreateNoteMutation>(
    CreateNoteDocument,
    {
      refetchQueries: ['notes'],
      onCompleted: () => {
        handleOnCompleted(t_toasts('note.success.create'));
      },
      onError,
    },
  );

  const [_updateNote, { loading: isUpdating }] = useMutation<UpdateNoteMutation>(
    UpdateNoteDocument,
    {
      refetchQueries: ['notes'],
      onCompleted: () => {
        handleOnCompleted(t_toasts('note.success.update'));
      },
      onError,
    },
  );

  const [_removeNote, { loading: isRemoving }] = useMutation<RemoveNoteMutation>(
    RemoveNoteDocument,
    {
      refetchQueries: ['notes'],
      onCompleted: () => {
        handleOnCompleted(t_toasts('note.success.delete'));
      },
      onError,
    },
  );

  const createNote = async (inputs: Inputs) => {
    await _createNote({
      variables: {
        createNoteInput: {
          ...inputs,
        },
      },
    });
  };

  const updateNote = async (inputs: Inputs, id: string) => {
    await _updateNote({
      variables: {
        updateNoteInput: {
          id,
          ...inputs,
        },
      },
    });
  };

  const removeNote = async (id: string, chatId: string) => {
    await _removeNote({
      variables: {
        id,
        chatId,
      },
    });
  };

  return {
    isCreating,
    isUpdating,
    isRemoving,
    createNote,
    updateNote,
    removeNote,
  };
};
