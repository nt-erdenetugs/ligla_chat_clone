import { useState } from 'react';

import CorporateFareIcon from '@mui/icons-material/CorporateFare';
import { Box } from '@mui/material';

import {
  DataTableWithHeader,
  FullScreenDialog,
  type FullScreenDialogProps,
  type Row,
} from '~/common/components';
import { PaginatedTeamsDocument } from '~/generated/graphql/types';
import type { FilterOptionInput } from '~/generated/graphql/types';
import {
  handleTeamSettingFilterReset,
  handleTeamSettingFilterApply,
} from '~/modules/Organizations/utils/teamSettings';
import { Form, useColumns, Show, useTeamActions } from '~/modules/Teams';
import { PAGES } from '~/routes/sidebar';

export const OrganziationTeamSettings = ({
  onClose,
  title,
  organizationId,
}: FullScreenDialogProps & { organizationId?: string; clearOnOpen?: boolean }) => {
  const { disableTeam } = useTeamActions(organizationId);
  type TeamFilterState = {
    refineConditions?: FilterOptionInput[];
    searchValue?: string;
  };

  const [filterState, setFilterState] = useState<TeamFilterState | undefined>(undefined);

  const extraQueryVariables = filterState
    ? { organizationId, filter: filterState }
    : { organizationId };

  const handleFilterApply = (filters?: FilterOptionInput[], searchValue?: string) =>
    handleTeamSettingFilterApply({ filterState, setFilterState }, filters, searchValue);

  const handleTeamSettingReset = () => void handleTeamSettingFilterReset({ setFilterState });

  const handleClose = () => {
    handleTeamSettingReset();
    if (onClose) onClose();
  };

  return (
    <FullScreenDialog
      title={title}
      titleIcon={<CorporateFareIcon />}
      open
      onClose={handleClose}
      sx={{ zIndex: (theme) => theme.zIndex.modal - 1 }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <DataTableWithHeader
          entryKey={PAGES.TEAMS}
          query={PaginatedTeamsDocument}
          useColumns={useColumns}
          onDelete={disableTeam}
          checkRowProtected={(row: Row) => Boolean(!row?.isDefault)}
          actionDisabled
          disableUrlParams
          Show={Show}
          Form={Form}
          extraQueryVariables={extraQueryVariables}
          onFilterApply={handleFilterApply}
          onFilterReset={handleTeamSettingReset}
          externalAppliedFilters={filterState?.refineConditions}
          externalSearchValue={filterState?.searchValue}
        />
      </Box>
    </FullScreenDialog>
  );
};
