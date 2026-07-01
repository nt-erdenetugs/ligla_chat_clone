import { Avatar, Stack, Typography } from '@mui/material';

import { ChipsWrapper, RoleTooltipChip, UserNameTooLong, type Column } from '~/common/components';
import { SHOW_TEAMS_LIMIT, USER_DEFAULT_PICTURE_URL, UserStatusType } from '~/common/constants';
import { UserRoleTypes } from '~/common/constants/roles';
import { useAuthContext } from '~/context/AuthContext';
import { useTranslation } from '~/locales/hooks';
import { StatusChip, type IUser } from '~/modules/Users';

export const useColumns = (): Column<IUser>[] => {
  const { t_management } = useTranslation();
  const { isMe, isAdminUser } = useAuthContext();

  const isStatusLockedOrPending = (status: UserStatusType) =>
    [UserStatusType.LOCKED, UserStatusType.PENDING].includes(status);

  const isToggledStatus = (id: string, status: UserStatusType) =>
    isAdminUser && !isMe(id) && !isStatusLockedOrPending(status);

  return [
    {
      name: 'status',
      label: t_management('status'),
      width: '10%',
      filterType: 'isEnum',
      enumOptions: Object.values(UserStatusType).map((v) => ({ value: v, label: v })),
      formatValue: ({ status, id }) => (
        <StatusChip
          userId={id}
          status={status as UserStatusType}
          enableToggle={isToggledStatus(id, status as UserStatusType)}
        />
      ),
    },
    {
      name: 'pictureUrl',
      label: t_management('users.profile'),
      width: '8%',
      sortDisabled: true,
      filterable: false,
      formatValue: ({ pictureUrl }) => (
        <Avatar sx={{ width: 40, height: 40 }} src={pictureUrl || USER_DEFAULT_PICTURE_URL} />
      ),
    },
    {
      name: 'displayName',
      label: t_management('users.name'),
      width: '17%',
      formatValue: ({ displayName }) => (
        <Stack direction='column'>
          <Typography variant='body2'>{displayName}</Typography>
          <UserNameTooLong name={displayName} />
        </Stack>
      ),
      searchable: true,
    },
    {
      name: 'senderName',
      label: t_management('users.senderName'),
      width: '15%',
      formatValue: ({ senderName }) => <Typography variant='body2'>{senderName}</Typography>,
      searchable: true,
    },
    {
      name: 'email',
      label: t_management('users.email'),
      width: '20%',
      formatValue: ({ email }) => <Typography variant='body2'>{email}</Typography>,
      searchable: true,
    },
    {
      name: 'roleType',
      label: t_management('users.role'),
      width: '12%',
      filterType: 'isEnum',
      enumOptions: UserRoleTypes.map((v) => ({ value: v, label: v })),
      formatValue: ({ roleType }) => roleType && <RoleTooltipChip roleType={roleType} />,
    },
    {
      name: 'teams',
      label: t_management('users.teams'),
      width: '18%',
      filterable: false,
      formatValue: ({ teams }) =>
        teams && (
          <ChipsWrapper
            title={t_management('users.teams')}
            limit={SHOW_TEAMS_LIMIT}
            items={teams}
            getChipLabel={(team) => team.name}
            disabled
          />
        ),
    },
  ];
};
