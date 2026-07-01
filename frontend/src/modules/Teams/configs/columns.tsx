import { Stack, Typography } from '@mui/material';

import { type Column, ChipsWrapper, ActiveStatusChip } from '~/common/components';
import { SHOW_STORES_LIMIT, SHOW_USERS_LIMIT, UserStatusType } from '~/common/constants';
import { useUserChip } from '~/common/hooks';
import { UserRoleType } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { HtmlTooltip, useTeamActions, type ITeam } from '~/modules/Teams';

export const useColumns = (): Column<ITeam>[] => {
  const { t_management, t_errors } = useTranslation();
  const { setTargetTeam, removeTargetTeam, toggleTeamStatus } = useTeamActions();
  const { getUserStatusChipColor, getChipLabelWithStatus } = useUserChip();

  return [
    {
      name: 'isActive',
      label: t_management('status'),
      width: '15%',
      filterType: 'boolean',
      enumOptions: [
        { value: true, label: t_management('Active') },
        { value: false, label: t_management('Inactive') },
      ],
      filterable: true,
      formatValue: (record) => (
        <ActiveStatusChip
          id={record.id}
          status={Boolean(record.isActive)}
          setTarget={setTargetTeam}
          removeTarget={removeTargetTeam}
          toggleStatus={toggleTeamStatus}
          enableToggle={!record.isDefault}
        />
      ),
    },
    {
      name: 'name',
      label: t_management('teams.name'),
      width: '30%',
      filterable: true,
      searchable: true,
      formatValue: (record) => (
        <Stack direction='row' spacing={2} alignItems='center'>
          <Typography variant='body2' color='text.primary' sx={{ fontSize: '0.875rem' }}>
            {record.name}
          </Typography>
          {record.isDefault && (
            <Typography variant='caption' color='text.secondary'>
              {t_management('teams.default')}
            </Typography>
          )}
        </Stack>
      ),
    },
    {
      name: 'managers',
      label: t_management('teams.managers'),
      width: '30%',
      sortDisabled: true,
      filterable: false,
      formatValue: ({ managers }) =>
        managers && (
          <ChipsWrapper
            title={t_management('teams.managers')}
            items={managers}
            limit={SHOW_USERS_LIMIT}
            stackProps={{ direction: 'column', alignItems: 'start' }}
            getChipLabel={getChipLabelWithStatus}
            getChipColor={(user) =>
              getUserStatusChipColor({
                status: user.status,
                customStatusColors: {
                  [UserStatusType.ACTIVE]:
                    user.roleType === UserRoleType.ManagerOperator ? 'primary' : undefined,
                },
              })
            }
            getTooltipTitle={(user) =>
              user.roleType === UserRoleType.ManagerOperator
                ? t_errors('userHasBothOperatorAndManagerRoles')
                : undefined
            }
            disabled
          />
        ),
    },
    {
      name: 'operators',
      label: t_management('teams.numOfOperators'),
      width: '30%',
      sortDisabled: true,
      filterable: false,
      formatValue: ({ operators }) => (
        <HtmlTooltip
          title={
            (operators || []).length > 0 ? (
              <>
                {(operators || []).slice(0, SHOW_USERS_LIMIT).map((operator) => {
                  return <p key={operator.id}>{getChipLabelWithStatus(operator)}</p>;
                })}
              </>
            ) : (
              ''
            )
          }
        >
          <span>{operators?.length ?? 0}</span>
        </HtmlTooltip>
      ),
    },

    {
      name: 'stores',
      label: t_management('teams.stores'),
      width: '30%',
      sortDisabled: true,
      filterable: false,
      formatValue: ({ stores }) =>
        stores && (
          <ChipsWrapper
            title={t_management('teams.stores')}
            items={stores}
            limit={SHOW_STORES_LIMIT}
            getChipLabel={(store) => store.name}
            disabled
          />
        ),
    },
  ];
};
