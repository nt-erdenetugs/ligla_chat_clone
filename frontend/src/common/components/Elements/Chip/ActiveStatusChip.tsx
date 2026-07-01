import { useState } from 'react';

import { Chip } from '@mui/material';

import { adminRoles } from '~/common/constants';
import { useAuthContext } from '~/context/AuthContext';
import { useTranslation } from '~/locales/hooks';

import { ToggleDialog } from '../Dialog';

type PropsType = {
  id?: string;
  status: boolean;
  enableToggle?: boolean;
  setTarget?: (id: string) => void;
  removeTarget?: () => void;
  toggleStatus?: (id: string) => Promise<void>;
};

export const ActiveStatusChip = ({
  status,
  id,
  enableToggle,
  setTarget,
  removeTarget,
  toggleStatus,
}: PropsType) => {
  const { user, isHypervisorUser } = useAuthContext();
  const { t_management } = useTranslation();
  const [showToggleDialog, setShowToggleDialog] = useState(false);

  const isToggleEnabled =
    enableToggle &&
    id &&
    toggleStatus &&
    setTarget &&
    removeTarget &&
    user &&
    (adminRoles.includes(user.roleType) || isHypervisorUser);

  return (
    <>
      <Chip
        color={status ? 'success' : 'secondary'}
        sx={{ width: '5.5rem', fontWeight: 'bold', fontSize: '0.75rem' }}
        label={status ? t_management('active') : t_management('inactive')}
        onClick={(e) => {
          if (!isToggleEnabled || !id) return;
          e.stopPropagation();
          setShowToggleDialog(true);
        }}
      />
      {isToggleEnabled && showToggleDialog && (
        <ToggleDialog
          id={id}
          onClose={() => setShowToggleDialog(false)}
          status={Boolean(status)}
          setTarget={setTarget}
          removeTarget={removeTarget}
          toggleStatus={toggleStatus}
        />
      )}
    </>
  );
};
