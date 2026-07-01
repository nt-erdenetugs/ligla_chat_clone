import { type Column, ActiveStatusChip, ChipsWrapper } from '~/common/components';
import { adminRoles, SHOW_USERS_LIMIT, UserStatusType } from '~/common/constants';
import { useUserChip } from '~/common/hooks';
import { useTranslation } from '~/locales/hooks';
import { useOrganizationActions, type IOrganization } from '~/modules/Organizations';
import { type IUser } from '~/modules/Users';

const renderMultilineText = (text?: string | null) => {
  if (!text) return null;
  return text.split('\n').map((line, index) => (
    <span key={index}>
      {line}
      {index !== text.split('\n').length - 1 && <br />}
    </span>
  ));
};

export const useColumns = (): Column<IOrganization>[] => {
  const { t_management } = useTranslation();
  const { setTargetOrganization, removeTargetOrganization, toggleOrganizationStatus } =
    useOrganizationActions();
  const { getChipLabelWithStatus, getUserStatusChipColor } = useUserChip();

  const renderAdmins = (users?: Nullable<IUser[]>) => {
    if (!users || users.length === 0) return null;

    const admins = users.filter((user) => adminRoles.includes(user.roleType));

    return (
      <ChipsWrapper
        items={admins}
        limit={SHOW_USERS_LIMIT}
        stackProps={{ direction: 'column', alignItems: 'start' }}
        getChipLabel={getChipLabelWithStatus}
        disabled
        getChipColor={(user) =>
          getUserStatusChipColor({
            status: user.status,
            customStatusColors: {
              [UserStatusType.ACTIVE]: undefined,
            },
          })
        }
        getTooltipTitle={(user) =>
          (user.status || UserStatusType.PENDING) === UserStatusType.PENDING
            ? t_management('organizations.userInvitationPending')
            : undefined
        }
      />
    );
  };

  return [
    {
      name: 'isActive',
      label: t_management('status'),
      width: '10%',
      filterType: 'boolean',
      enumOptions: [
        { value: true, label: t_management('Active') },
        { value: false, label: t_management('Inactive') },
      ],
      filterable: true,
      formatValue: (record) => (
        <ActiveStatusChip
          id={record.name}
          status={Boolean(record.isActive)}
          setTarget={setTargetOrganization}
          removeTarget={removeTargetOrganization}
          toggleStatus={toggleOrganizationStatus}
        />
      ),
    },
    {
      name: 'name',
      label: t_management('organizations.companyCodeName'),
      width: '10%',
      filterable: true,
      searchable: true,
    },
    {
      name: 'loginLiffId',
      label: t_management('organizations.loginLiffId'),
      width: '10%',
      filterable: true,
      searchable: true,
    },
    {
      name: 'fileUploadLiffId',
      label: t_management('organizations.fileUploadLiffId'),
      width: '10%',
      filterable: true,
      searchable: true,
    },
    {
      name: 'displayName',
      label: t_management('organizations.companyName'),
      width: '10%',
      filterable: true,
      searchable: true,
    },
    {
      name: 'users',
      label: t_management('organizations.companyAdministratorEmail'),
      sortDisabled: true,
      width: '20%',
      filterable: false,
      formatValue: ({ users }) => renderAdmins(users),
    },
    {
      name: 'operatorCount',
      label: t_management('organizations.activeOperators'),
      filterable: false,
      formatValue: ({ operatorCount }) => <span>{operatorCount ? operatorCount : 0}</span>,
      width: '10%',
    },
    {
      name: 'maxOperator',
      label: t_management('organizations.operatorLimit'),
      width: '10%',
      filterable: true,
      filterType: 'number',
    },
    {
      name: 'description',
      label: t_management('organizations.notes'),
      width: '30%',
      filterable: true,
      searchable: true,
      formatValue: ({ description }) => renderMultilineText(description),
    },
  ];
};
