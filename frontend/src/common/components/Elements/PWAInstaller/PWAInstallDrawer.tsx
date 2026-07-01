import { useMemo, useEffect, useCallback } from 'react';

import InstallMobileIcon from '@mui/icons-material/InstallMobile';
import {
  Drawer,
  Typography,
  Button,
  Stack,
  styled,
  Checkbox,
  FormControlLabel,
  Divider,
  CircularProgress,
} from '@mui/material';
import { useSnackbar } from 'notistack';

import { LOGO } from '~/configs';
import { useTranslation } from '~/locales/hooks';

import { IOSInstallInstructions } from './components/IOSInstallInstructions';
import { usePWAInstallation } from './hooks/usePwaInstallation';
import { type PWAInstallDrawerProps } from './types';
import { clearSessionPromptState } from './utils/storage';

const AppIcon = styled('img')({
  height: 48,
});

export const PWAInstallDrawer = ({
  forceShow = false,
  onInstall,
  onDismiss,
  ignoreSession = false,
}: PWAInstallDrawerProps = {}) => {
  const { t_toasts } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const {
    open,
    isIOS,
    unsupported,
    dontShowAgain,
    loading,
    canInstall,
    handleInstall,
    handleClose,
    setDontShowAgain,
    forceShowPrompt,
  } = usePWAInstallation();

  useEffect(() => {
    if (ignoreSession) {
      const clearResult = clearSessionPromptState();
      if (!clearResult.success) {
        let message = '';
        switch (clearResult.error) {
          case 'quota_exceeded':
            message = t_toasts('pwa.storage.quotaExceeded');
            break;
          case 'storage_disabled':
            message = t_toasts('pwa.storage.disabled');
            break;
          default:
            message = t_toasts('pwa.storage.error');
        }
        enqueueSnackbar(message, { variant: 'warning' });
      }
      forceShowPrompt();
    }
  }, [ignoreSession, forceShowPrompt, t_toasts, enqueueSnackbar]);

  const isOpen = forceShow || open;

  const handleInstallClick = useCallback(async () => {
    await handleInstall();
    onInstall?.(true);
  }, [handleInstall, onInstall]);

  const handleDrawerClose = useCallback(() => {
    handleClose();
    onDismiss?.();
  }, [handleClose, onDismiss]);

  const renderContent = useMemo(() => {
    if (unsupported) {
      return (
        <Typography variant='body2' sx={{ mb: 2 }}>
          {t_toasts('pwa.unsupportedMessage')}
        </Typography>
      );
    }

    if (isIOS) {
      return <IOSInstallInstructions />;
    }

    return (
      <Typography variant='body2' sx={{ mb: 2 }}>
        {t_toasts('pwa.installPrompt')}
      </Typography>
    );
  }, [unsupported, isIOS, t_toasts]);

  const renderActions = useMemo(() => {
    if (unsupported || isIOS) {
      return (
        <Button variant='contained' fullWidth onClick={handleDrawerClose} disabled={loading}>
          {t_toasts('common.close')}
        </Button>
      );
    }

    return (
      <Stack direction='row' spacing={1} sx={{ width: '100%' }}>
        <Button fullWidth onClick={handleDrawerClose} disabled={loading}>
          {t_toasts('common.cancel')}
        </Button>
        <Button
          color='primary'
          variant='contained'
          startIcon={loading ? <CircularProgress size={16} /> : <InstallMobileIcon />}
          fullWidth
          onClick={handleInstallClick}
          disabled={!canInstall || loading}
        >
          {loading ? t_toasts('common.loading') : t_toasts('pwa.installBtn')}
        </Button>
      </Stack>
    );
  }, [unsupported, isIOS, canInstall, loading, t_toasts, handleDrawerClose, handleInstallClick]);

  return (
    <Drawer
      anchor='bottom'
      open={isOpen}
      onClose={handleDrawerClose}
      aria-labelledby='pwa-install-title'
      aria-describedby='pwa-install-description'
      slotProps={{
        paper: {
          sx: {
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            p: 2,
            backgroundColor: '#f9f9f9',
          },
          role: 'dialog',
          'aria-modal': true,
        },
      }}
    >
      <Stack sx={{ py: 2 }} alignItems='center'>
        <AppIcon src={LOGO} alt='App Logo' />
      </Stack>

      <Divider sx={{ mb: 1 }} />

      <div id='pwa-install-description'>{renderContent}</div>

      {!unsupported && (
        <FormControlLabel
          control={
            <Checkbox
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              size='small'
              disabled={loading}
            />
          }
          label={t_toasts('pwa.dontShowAgain')}
          sx={{ mt: 1 }}
        />
      )}

      <Stack spacing={1} sx={{ mt: 2 }}>
        {renderActions}
      </Stack>
    </Drawer>
  );
};
