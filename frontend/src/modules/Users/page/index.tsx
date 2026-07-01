import { useCallback, useState } from 'react';

import QrCodeIcon from '@mui/icons-material/QrCode';
import { Button, Tooltip } from '@mui/material';
import { useSearchParams } from 'react-router';

import {
  DataTableWithHeader,
  type ActionItem,
} from '~/common/components/Elements/DataTableWithHeader';
import { type DataTableWithHeaderProps } from '~/common/components/Elements/DataTableWithHeader/DataTableWithHeader';
import { getFilterFromSearchParams } from '~/common/components/ListFilter/hooks/useListFilter';
import { useErrorHandledAction } from '~/common/hooks';
import { useAuthContext } from '~/context/AuthContext';
import { usePaginationContext } from '~/context/PaginationContext';
import { UsersDocument, type UsersQuery } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { useUserActions, Form, Show, useColumns, type IOperatorCountObj } from '~/modules/Users';
import { PAGES } from '~/routes/sidebar';
import { downloadOperatorsQRs } from '~/utils/file';

export const UsersPage = () => {
  const { removeUser } = useUserActions();
  const { executeAction } = useErrorHandledAction();
  const [additionalInfo, setAdditionalInfo] = useState<IOperatorCountObj>();
  const { user, isAdminUser, isManagerUser, isMe } = useAuthContext();
  const { t, t_errors } = useTranslation();
  const { pageParams } = usePaginationContext();
  const [searchParams] = useSearchParams();
  const filter = getFilterFromSearchParams(searchParams);

  let dataTableProps: Partial<DataTableWithHeaderProps> = {};
  if (user) {
    if (isAdminUser) {
      dataTableProps = {
        onDelete: removeUser,
      };
    } else {
      if (isManagerUser) {
        dataTableProps = {
          getStartedProps: {
            showAddButton: false,
          },
        };
      }
    }
  }
  const handleDownloadQRs = async () => {
    await executeAction(() => downloadOperatorsQRs(pageParams, t_errors));
  };

  const updateAdditionalInfo = useCallback(
    ({ maxOperatorCount, operatorCount }: UsersQuery) => {
      if (!isAdminUser) return;
      setAdditionalInfo({
        maxOperatorCount,
        operatorCount,
      });
    },
    [isAdminUser],
  );
  const customActions: ActionItem[] = [
    {
      key: 'downloadQR',
      label: t('actions.downloadOperatorsQR'),
      tooltip: t('tooltip.downloadOperatorsQRButton'),
      icon: <QrCodeIcon />,
      onClick: handleDownloadQRs,
    },
  ];

  return (
    <DataTableWithHeader
      entryKey={PAGES.USERS}
      query={UsersDocument}
      extraQueryVariables={filter ? { filter } : undefined}
      disableAddAction={!isAdminUser}
      editDisabled={!isAdminUser}
      checkRowProtected={({ id }) => !isMe(id)}
      additionalInfo={additionalInfo}
      useColumns={useColumns}
      updateAdditionalInfo={updateAdditionalInfo}
      CustomAction={() => (
        <>
          {customActions.map(({ key, label, tooltip, icon, onClick }) => (
            <Tooltip key={key} title={tooltip} placement='top'>
              <Button variant='outlined' onClick={onClick} startIcon={icon}>
                {label}
              </Button>
            </Tooltip>
          ))}
        </>
      )}
      Show={Show}
      Form={isAdminUser ? Form : undefined}
      {...dataTableProps}
    />
  );
};
