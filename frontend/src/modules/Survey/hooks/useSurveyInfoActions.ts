import { useEffect, useMemo } from 'react';

import { useQuery } from '@apollo/client';
import { useSnackbar } from 'notistack';

import { type SurveysQuery, SurveysDocument } from '~/generated/graphql/types';

export const useSurveyInfoActions = (chatId?: string) => {
  const { enqueueSnackbar } = useSnackbar();

  const { data, loading, error } = useQuery<SurveysQuery>(SurveysDocument, {
    variables: { chatId },
    skip: !chatId,
  });

  useEffect(() => {
    if (!error) return;
    console.error(error.message);
    enqueueSnackbar(error.message, { variant: 'error' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const surveys = useMemo(() => {
    if (!data?.surveys) return [];
    return data.surveys.filter(
      (feed) => feed.value !== null && feed.value !== undefined && feed.value !== '',
    );
  }, [data]);
  return {
    data: surveys,
    loading,
  };
};
