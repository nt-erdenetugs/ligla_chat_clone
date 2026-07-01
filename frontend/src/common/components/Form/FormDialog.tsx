import { useState } from 'react';

import {
  ConfirmationDialog,
  DraggableDialog,
  type DraggableDialogProps,
} from '~/common/components';
import { useTranslation } from '~/locales/hooks';

export type FormDialogProps = DraggableDialogProps & {
  isDirty?: boolean;
};

export const FormDialog = ({
  isDirty,
  onClose,
  confirmationText,
  open,
  ...rest
}: FormDialogProps) => {
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  const handleClose = () => {
    if (isDirty) {
      setShowConfirm(true);
    } else {
      _onClose();
    }
  };

  const _onClose = () => {
    setShowConfirm(false);
    onClose();
  };

  const { t } = useTranslation();

  return (
    <>
      <DraggableDialog
        onClose={handleClose}
        confirmationText={confirmationText}
        open={open}
        confirmButtonProps={!isDirty ? { disabled: true } : {}}
        {...rest}
      />
      <ConfirmationDialog
        open={showConfirm}
        onConfirm={_onClose}
        isLoading={rest.isLoading}
        onClose={() => setShowConfirm(false)}
        contentText={t('info.sureToCancelEdit')}
        confirmationText={t('actions.ok')}
      />
    </>
  );
};
