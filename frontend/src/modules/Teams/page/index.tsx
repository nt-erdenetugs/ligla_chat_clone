import { useSearchParams } from 'react-router';

import { DataTableWithHeader } from '~/common/components/Elements/DataTableWithHeader';
import { type DataTableWithHeaderProps } from '~/common/components/Elements/DataTableWithHeader';
import { getFilterFromSearchParams } from '~/common/components/ListFilter/hooks/useListFilter';
import { useAuthContext } from '~/context/AuthContext';
import { PaginatedTeamsDocument } from '~/generated/graphql/types';
import { useTeamActions, Form, Show, useColumns } from '~/modules/Teams';
import { PAGES } from '~/routes/sidebar';

export const TeamsPage = () => {
  const { disableTeam } = useTeamActions();
  const { user, isAdminUser, isManagerUser } = useAuthContext();
  const [searchParams] = useSearchParams();
  const filter = getFilterFromSearchParams(searchParams);

  let dataTableProps: Partial<DataTableWithHeaderProps> = {};

  if (user) {
    if (isAdminUser) {
      dataTableProps = {
        Form,
        onDelete: disableTeam,
      };
    } else if (isManagerUser) {
      dataTableProps = {
        Form,
        getStartedProps: {
          showAddButton: false,
        },
      };
    } else {
      dataTableProps = {
        editDisabled: true,
      };
    }
  }

  return (
    <DataTableWithHeader
      entryKey={PAGES.TEAMS}
      query={PaginatedTeamsDocument}
      extraQueryVariables={filter ? { filter } : undefined}
      disableAddAction={!isAdminUser}
      useColumns={useColumns}
      Show={Show}
      getRowStyle={(team) => (!team.isActive ? { backgroundColor: '#f5f5f9', opacity: 0.5 } : {})}
      {...dataTableProps}
    />
  );
};
