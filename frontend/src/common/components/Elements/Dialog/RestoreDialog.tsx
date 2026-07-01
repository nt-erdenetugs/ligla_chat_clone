import { ConfirmationDialog } from '~/common/components';
import { useTranslation } from '~/locales/hooks';

type RestoreDialog = {
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  contentText?: string;
  confirmationText?: string;
};

export const RestoreDialog = ({ onClose, onConfirm, title = '' }: RestoreDialog) => {
  const { t } = useTranslation();
  return (
    <ConfirmationDialog
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      contentText={t('info.sureToRestore')}
      confirmationText={t('actions.restore')}
      maxWidth='xs'
      fullWidth
      open
    />
  );
};
