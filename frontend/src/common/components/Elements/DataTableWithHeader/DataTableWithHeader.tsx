import { Box, type SxProps } from '@mui/material';
import { type DocumentNode } from 'graphql';

import {
  DataTableHeader,
  type DataTableHeaderProps,
} from '~/common/components/Elements/DataTableWithHeader/DataTableHeader';
import { useResponsive } from '~/common/hooks';
import { type FilterOptionInput } from '~/generated/graphql/types';

import { DataTable, type DataTableProps } from './DataTable';
import { useDataTableContext } from './providers/index';
import { type TableKey } from './types';

export interface DataTableBaseProps {
  entryKey: TableKey;
  query: DocumentNode;
  extraQueryVariables?: Record<string, any>;
  disableUrlParams?: boolean;
  externalAppliedFilters?: FilterOptionInput[];
  externalSearchValue?: string;
  onFilterApply?: (filters?: FilterOptionInput[], searchValue?: string) => void;
  onFilterReset?: () => void;
  filterColumn?: boolean;
  sx?: {
    headerSx?: SxProps;
    tableSx?: SxProps;
  };
  mergeHeader?: boolean;
}
export interface DataTableWithHeaderProps extends DataTableHeaderProps, DataTableProps {
  customPagination?: boolean;
}
export const DataTableWithHeader = ({
  entryKey,
  query,
  Form,
  Show,
  extraQueryVariables,
  additionalInfo,
  disableUrlParams,
  actionDisabled,
  editDisabled,
  getStartedProps,
  disableAddAction = false,
  disablePagination = false,
  disableDownloadQRButton = true,
  useColumns,
  updateAdditionalInfo,
  getRowStyle,
  checkRowProtected,
  onDelete,
  onRestore,
  onDownloadQRs,
  hideActionsColumn,
  CustomHeader,
  CustomAction,
  onFilterApply,
  onFilterReset,
  externalAppliedFilters,
  externalSearchValue,
  filterColumn,
  sx,
  mergeHeader = false,
}: DataTableWithHeaderProps) => {
  const { layoutMarginTop } = useDataTableContext();
  const { isMobileOrTablet } = useResponsive();

  return (
    <Box
      sx={{
        maxHeight: isMobileOrTablet
          ? `calc(100dvh - ${layoutMarginTop} - 16px)`
          : `calc(100dvh - 16px)`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ height: 'auto' }}>
        <DataTableHeader
          entryKey={entryKey}
          query={query}
          extraQueryVariables={extraQueryVariables}
          additionalInfo={additionalInfo}
          disableUrlParams={disableUrlParams}
          disableAddAction={disableAddAction}
          disablePagination={disablePagination}
          disableDownloadQRButton={disableDownloadQRButton}
          onDownloadQRs={onDownloadQRs}
          CustomHeader={CustomHeader}
          CustomAction={CustomAction}
          mergeHeader={mergeHeader}
          sx={sx}
        />
      </Box>
      <DataTable
        entryKey={entryKey}
        query={query}
        Form={Form}
        Show={Show}
        extraQueryVariables={extraQueryVariables}
        disableUrlParams={disableUrlParams}
        actionDisabled={actionDisabled}
        editDisabled={editDisabled}
        getStartedProps={getStartedProps}
        disableAddAction={disableAddAction}
        disablePagination={disablePagination}
        hideActionsColumn={hideActionsColumn}
        useColumns={useColumns}
        updateAdditionalInfo={updateAdditionalInfo}
        getRowStyle={getRowStyle}
        checkRowProtected={checkRowProtected}
        onDelete={onDelete}
        onRestore={onRestore}
        onFilterApply={onFilterApply}
        onFilterReset={onFilterReset}
        externalAppliedFilters={externalAppliedFilters}
        externalSearchValue={externalSearchValue}
        filterColumn={filterColumn}
        mergeHeader={mergeHeader}
        sx={sx}
      />
    </Box>
  );
};
