import { ConfirmationDialog } from '~/common/components';
import { useTranslation } from '~/locales/hooks';

type DeleteDialogProps = {
  onClose: () => void;
  onConfirm: () => void;
  open?: boolean;
  title?: string;
  contentText?: string;
  confirmationText?: string;
  isLoading?: boolean;
};

export const DeleteDialog = ({
  onClose,
  onConfirm,
  title = '',
  open = true,
  contentText,
  confirmationText,
  isLoading,
}: DeleteDialogProps) => {
  const { t } = useTranslation();

  return (
    <ConfirmationDialog
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      contentText={contentText ?? t('info.sureToDelete')}
      confirmationText={confirmationText ?? t('actions.delete')}
      maxWidth='xs'
      fullWidth
      open={open}
      isLoading={isLoading}
    />
  );
};
