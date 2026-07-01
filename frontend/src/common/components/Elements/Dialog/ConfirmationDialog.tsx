import { type ReactNode } from 'react';

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  type DialogProps,
  CircularProgress,
} from '@mui/material';

import { useTranslation } from '~/locales/hooks';

export type ConfirmationDialogProps = Omit<DialogProps, 'content'> & {
  open: boolean;
  onConfirm: () => void;
  onClose: () => void;
  title?: string;
  contentText?: ReactNode;
  confirmationText?: string;
  cancelText?: string;
  isLoading?: boolean;
};

export const ConfirmationDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  contentText,
  confirmationText,
  cancelText,
  children,
  isLoading,
  ...props
}: ConfirmationDialogProps) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} {...props}>
      <DialogTitle> {title || t('confirmation')}</DialogTitle>
      <DialogContent>
        {contentText && <DialogContentText>{contentText}</DialogContentText>}
        {children}
      </DialogContent>
      <DialogActions>
        {isLoading && <CircularProgress size='1rem' sx={{ mr: 'auto', ml: '1rem' }} />}
        <Button onClick={onClose} color='secondary'>
          {cancelText || t('actions.cancel')}
        </Button>
        <Button onClick={onConfirm} disabled={isLoading}>
          {confirmationText || t('actions.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
