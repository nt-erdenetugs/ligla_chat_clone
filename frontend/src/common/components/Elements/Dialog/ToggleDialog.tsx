import { useEffect } from 'react';

import { Typography } from '@mui/material';

import { ConfirmationDialog, type ToggleProps } from '~/common/components';
import { useErrorHandledAction } from '~/common/hooks';
import { useTranslation } from '~/locales/hooks';

export const ToggleDialog = ({
  id,
  onClose,
  dialogProps,
  status,
  setTarget,
  removeTarget,
  toggleStatus,
}: ToggleProps) => {
  const { t_management } = useTranslation();
  const { executeAction } = useErrorHandledAction();

  useEffect(() => {
    setTarget(String(id));
  }, [id, setTarget]);

  const handleClose = () => {
    removeTarget();
    onClose();
  };

  const handleToggle = async (id: string) => {
    await executeAction(() => toggleStatus(id), handleClose);
  };

  return (
    <ConfirmationDialog
      open
      onClose={onClose}
      title={t_management('toggle.title')}
      onConfirm={() => handleToggle(String(id))}
      confirmationText={t_management('toggle.action')}
      onClick={(e) => e.stopPropagation()}
      {...dialogProps}
    >
      <Typography>
        {t_management(`toggle.${status ? 'switchingToInactive' : 'switchingToActive'}`)}
      </Typography>
    </ConfirmationDialog>
  );
};
