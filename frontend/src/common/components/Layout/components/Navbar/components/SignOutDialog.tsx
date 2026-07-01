import { ConfirmationDialog } from '~/common/components';
import { useAuthContext } from '~/context/AuthContext';
import { useTranslation } from '~/locales/hooks';

type SignOutDialogProps = {
  open: boolean;
  onClose: () => void;
};

export const SignOutDialog = ({ open, onClose }: SignOutDialogProps) => {
  const { logOut } = useAuthContext();

  const handleConfirm = () => {
    logOut();
  };

  const { t } = useTranslation();

  return (
    <ConfirmationDialog
      onClose={onClose}
      onConfirm={handleConfirm}
      title={t('logout')}
      contentText={t('info.sureToLogout')}
      open={open}
    />
  );
};
