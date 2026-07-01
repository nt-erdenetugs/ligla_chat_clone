import { useState } from 'react';

import { Chip } from '@mui/material';

import { ToggleDialog } from '~/common/components/';
import { UserStatusType } from '~/common/constants';
import { useUserChip } from '~/common/hooks';
import { useTranslation } from '~/locales/hooks';

import { useUserActions } from '../hooks';

type PropsType = {
  status: UserStatusType;
  userId?: string;
  enableToggle?: boolean;
};

export const StatusChip = ({ status, userId, enableToggle = false }: PropsType) => {
  const { getUserStatusChipColor } = useUserChip();
  const chipColor = getUserStatusChipColor({ status, fallbackColor: 'secondary' });

  const { t_management } = useTranslation();
  const [showToggle, setShowToggle] = useState(false);
  const { setTargetUser, removeTargetUser, toggleUserStatus } = useUserActions();
  const isToggleEnabled = enableToggle && userId;

  return (
    <>
      <Chip
        color={chipColor}
        sx={{ width: '5.5rem', fontWeight: 'bold', fontSize: '0.75rem' }}
        label={t_management(status.toLowerCase())}
        onClick={(e) => {
          if (!isToggleEnabled || !userId) return;

          e.stopPropagation();
          setShowToggle(true);
        }}
      />
      {isToggleEnabled && showToggle && (
        <ToggleDialog
          id={userId}
          onClose={() => setShowToggle(false)}
          status={status === UserStatusType.ACTIVE}
          setTarget={setTargetUser}
          removeTarget={removeTargetUser}
          toggleStatus={toggleUserStatus}
        />
      )}
    </>
  );
};
