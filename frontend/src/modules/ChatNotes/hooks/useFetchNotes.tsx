import { useEffect, useState } from 'react';

import { useQuery } from '@apollo/client';
import { enqueueSnackbar } from 'notistack';

import { NotesDocument, type NotesQuery } from '~/generated/graphql/types';

import { type INote } from '../types';

export const useFetchNotes = (chatId: string) => {
  const [notes, setNotes] = useState<INote[]>([]);

  const { data, loading, refetch, error } = useQuery<NotesQuery>(NotesDocument, {
    variables: {
      chatId: chatId ?? '',
    },
    skip: !chatId,
  });

  useEffect(() => {
    if (!error) return;
    if (error.extraInfo.status === 200) return;
    console.error(error.message);
    enqueueSnackbar(error.message, { variant: 'error' });
  }, [error]);

  useEffect(() => {
    if (data?.notes) {
      setNotes(data.notes as INote[]);
    }
  }, [data]);

  useEffect(() => {
    const refetchNotes = async () => {
      if (!chatId) return;
      await refetch({ chatId });
    };
    refetchNotes();
  }, [chatId, refetch]);

  return { notes, loading };
};
