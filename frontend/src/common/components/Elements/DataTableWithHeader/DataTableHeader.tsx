import { useMemo, type FunctionComponent } from 'react';

import AddIcon from '@mui/icons-material/Add';
import { Button } from '@mui/material';

import { Title, AddButton } from '~/common/components';
import { type DataTableBaseProps } from '~/common/components/Elements/DataTableWithHeader/DataTableWithHeader';
import { useDataTableContext } from '~/common/components/Elements/DataTableWithHeader/providers';
import { useTranslation } from '~/locales/hooks';

import { type GetStartedProps, RowsPerPage } from './components';
export interface DataTableHeaderProps extends DataTableBaseProps {
  additionalInfo?: Record<string, any>;
  getStartedProps?: Partial<GetStartedProps>;
  disableAddAction?: boolean;
  disablePagination?: boolean;
  disableDownloadQRButton?: boolean;
  onDownloadQRs?: (
    paginationParams: { per: number; page: number },
    t?: (key: string) => string,
  ) => Promise<void>;
  CustomHeader?: FunctionComponent<any>;
  CustomAction?: FunctionComponent<any>;
}

export const DataTableHeader = ({
  entryKey,
  additionalInfo,
  disableUrlParams,
  disableAddAction,
  disablePagination,
  CustomHeader,
  CustomAction,
  sx,
  mergeHeader = false,
}: DataTableHeaderProps) => {
  const { openFormModal, hasRows } = useDataTableContext();
  const { t, t_management } = useTranslation();
  const title = useMemo(() => t_management(`${entryKey}.title`), [entryKey, t_management]);
  const subtitle = useMemo(
    () =>
      additionalInfo ? t_management(`${entryKey}.subtitle`, { ...additionalInfo }) : undefined,
    [additionalInfo, entryKey, t_management],
  );
  return (
    <Title
      title={mergeHeader ? '' : title}
      subTitle={subtitle}
      sx={{
        ...sx?.headerSx,
        ...(mergeHeader
          ? {
              mb: 0,
              boxShadow: 'none',
              borderRadius: '8px 8px 0 0',
              pb: 0,
            }
          : {}),
      }}
    >
      {CustomHeader ? (
        <CustomHeader />
      ) : (
        <>
          {CustomAction ? <CustomAction /> : null}
          {!disablePagination && hasRows ? <RowsPerPage /> : null}
          {!disableAddAction &&
            (!disableUrlParams ? (
              <AddButton sx={{ ml: 2 }} />
            ) : (
              <Button
                variant='contained'
                startIcon={<AddIcon fontSize='small' />}
                onClick={() => openFormModal()}
              >
                {t('actions.new')}
              </Button>
            ))}
        </>
      )}
    </Title>
  );
};
