import { useEffect, useMemo } from 'react';

import { useQuery } from '@apollo/client';
import { useSnackbar } from 'notistack';

import { MemberFeedsDocument, type MemberFeedsQuery } from '~/generated/graphql/types';

export const useMemberFeedInfoActions = (clientUserId?: string) => {
  const { enqueueSnackbar } = useSnackbar();

  const { data, loading, error } = useQuery<MemberFeedsQuery>(MemberFeedsDocument, {
    variables: { clientUserId },
  });

  useEffect(() => {
    if (error) {
      console.error(error.message);
      enqueueSnackbar(error.message, { variant: 'error' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const memberFeeds = useMemo(() => {
    if (!data?.memberFeeds) return [];

    return data.memberFeeds.filter(
      (feed) => feed.value !== null && feed.value !== undefined && feed.value !== '',
    );
  }, [data]);
  return {
    data: memberFeeds,
    loading,
  };
};
