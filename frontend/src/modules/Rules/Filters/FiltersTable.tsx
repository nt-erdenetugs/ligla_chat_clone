import { useCallback, useMemo, useState } from 'react';

import { Stack } from '@mui/material';

import { DataTableWithHeader, DraggableDialog } from '~/common/components';
import { ChatAssignFiltersDocument, type FilterOptionInput } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import {
  handleTeamSettingFilterApply,
  handleTeamSettingFilterReset,
} from '~/modules/Organizations/utils/teamSettings';

import { useFiltersActions, FilterForm, useColumns, Show } from '.';

type FiltersTableProps = {
  onClose: () => void;
};

export const FiltersTable = ({ onClose }: FiltersTableProps) => {
  const { t } = useTranslation();
  const { disableFilter } = useFiltersActions();
  type ChatAssignFilterState = {
    refineConditions?: FilterOptionInput[];
    searchValue?: string;
  };
  const [filterState, setFilterState] = useState<ChatAssignFilterState | undefined>(undefined);

  const onFilterApply = useCallback(
    (filters?: FilterOptionInput[], searchValue?: string) => {
      handleTeamSettingFilterApply({ filterState, setFilterState }, filters, searchValue);
    },
    [filterState, setFilterState],
  );

  const onFilterReset = useCallback(() => {
    handleTeamSettingFilterReset({ setFilterState });
  }, [setFilterState]);

  const extraQueryVariables = useMemo(() => ({ filter: filterState }), [filterState]);

  return (
    <DraggableDialog
      onClose={onClose}
      cancelText={t('actions.close')}
      contentSx={{ p: 0 }}
      hideConfirm
      heightFixed
      open
    >
      <Stack width={900} maxHeight='80vh'>
        <DataTableWithHeader
          entryKey='chatAssignFilters'
          query={ChatAssignFiltersDocument}
          getRowStyle={(row) => (row.isActive ? {} : { backgroundColor: '#f5f5f9', opacity: 0.5 })}
          useColumns={useColumns}
          Form={FilterForm}
          Show={Show}
          onDelete={disableFilter}
          sx={{
            headerSx: { boxShadow: 'unset', mb: 0 },
            tableSx: { boxShadow: 'unset' },
          }}
          disableUrlParams
          extraQueryVariables={extraQueryVariables}
          onFilterApply={onFilterApply}
          onFilterReset={onFilterReset}
          externalAppliedFilters={filterState?.refineConditions}
          externalSearchValue={filterState?.searchValue}
        />
      </Stack>
    </DraggableDialog>
  );
};
