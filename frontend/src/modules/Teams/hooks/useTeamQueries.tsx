import { useQuery } from '@apollo/client';

import {
  SelectableTeamsDocument,
  SelectableTeamsForChatFilterDocument,
  type SelectableTeamsForChatFilterQuery,
  type SelectableTeamsQuery,
} from '~/generated/graphql/types';

export const useTeamQueries = () => {
  const { data: selectableTeamsData, loading: isFetchingSelectableTeams } =
    useQuery<SelectableTeamsQuery>(SelectableTeamsDocument);
  const { data: selectableTeamsForChatFilterData, loading: isFetchingTeamsForChatFilter } =
    useQuery<SelectableTeamsForChatFilterQuery>(SelectableTeamsForChatFilterDocument);

  const selectableTeams = selectableTeamsData?.selectableTeams || [];
  const selectableTeamsForChatFilter =
    selectableTeamsForChatFilterData?.selectableTeamsForChatFilter || [];

  return {
    isFetchingSelectableTeams,
    isFetchingTeamsForChatFilter,
    selectableTeams,
    selectableTeamsForChatFilter,
  };
};
