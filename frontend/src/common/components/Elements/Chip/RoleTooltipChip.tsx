import { Chip, Tooltip } from '@mui/material';

import { getRoleLabel } from '~/common/constants';
import { UserRoleType } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';

export const RoleTooltipChip = ({ roleType }: { roleType: string }) => {
  const { t_management, t_errors } = useTranslation();
  return (
    <Tooltip
      title={
        roleType === UserRoleType.ManagerOperator
          ? t_errors('userHasBothOperatorAndManagerRoles')
          : ''
      }
    >
      <Chip
        color={roleType === UserRoleType.ManagerOperator ? 'primary' : undefined}
        label={t_management(`roles.${getRoleLabel(roleType)}`)}
      />
    </Tooltip>
  );
};
