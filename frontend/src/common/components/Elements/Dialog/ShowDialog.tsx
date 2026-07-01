import { useSearchParams } from 'react-router';

import { ACTION_PARAM_KEY, ACTIONS_TYPE, ACTION_LABEL_KEYS } from '~/common/constants';
import { useTranslation } from '~/locales/hooks';

import { DraggableDialog, type DraggableDialogProps } from './DraggableDialog';

export type ShowDialogProps = Partial<DraggableDialogProps> & {
  actionKey?: string;
  paramSuffix?: string;
  editDisabled?: boolean;
  onConfirm?: () => void;
  onEdit?: () => void;
};

export const ShowDialog = ({
  children,
  onClose,
  onEdit,
  actionKey,
  editDisabled,
  onConfirm,
  ...props
}: ShowDialogProps) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const key = actionKey || ACTION_PARAM_KEY;

  const { t } = useTranslation();

  const handleClose = () => {
    onClose?.();
  };

  const handleEdit = () => {
    if (onEdit) return onEdit();

    searchParams.set(key, ACTIONS_TYPE.EDIT);
    setSearchParams(searchParams);
  };

  return (
    <DraggableDialog
      onClose={handleClose}
      open={searchParams.get(key) === ACTIONS_TYPE.SHOW}
      {...(editDisabled
        ? { hideConfirm: true }
        : {
            confirmationText: t(ACTION_LABEL_KEYS[ACTIONS_TYPE.EDIT]),
            onConfirm: onConfirm ? onConfirm : handleEdit,
          })}
      {...props}
    >
      {children}
    </DraggableDialog>
  );
};
