import { useEffect, useState } from 'react';

import { ContentCopy } from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Typography,
  Tab,
  Tabs,
  TextField,
  Switch,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';

import {
  TooltipIconButton,
  LabeledGrid,
  SkeletonSuspense,
  UserNameTooLong,
} from '~/common/components';
import { LabelWithHint } from '~/common/components/Form/components';
import { EditableTextLabel } from '~/common/components/Form/EditableTextLabel';
import { QRCode } from '~/common/components/QRCode';
import { NOTIFICATION_DISABLED_KEY, DISPLAY_NAME_MAX_CHAR_LIMIT } from '~/common/constants';
import { allOperatorRoles } from '~/common/constants/roles';
import { useResponsive } from '~/common/hooks';
import { useAuthContext } from '~/context/AuthContext';
import { usePushNotifications } from '~/context/NotificationContext';
import { useTranslation } from '~/locales/hooks';
import { useAuthActions } from '~/modules/Auth/hooks';
import { uniqueKey } from '~/utils';

import { EditPassword } from './EditPassword';
import UploadProfile from './UploadProfile';

type AccountDialogProps = {
  settingsOpen: boolean;
  initialTabIndex?: number;
  onClose: () => void;
};

interface NavigatorStandalone extends Navigator {
  standalone?: boolean;
}

export const AccountSettingsDialog = ({
  settingsOpen,
  onClose,
  initialTabIndex = 0,
}: AccountDialogProps) => {
  const { t } = useTranslation();
  const { user, isUserLoading, setUserFields } = useAuthContext();
  const { updateDisplayName, updateSenderName } = useAuthActions();
  const { isBrowserSubscribed, subscribeUser, unsubscribeUser } = usePushNotifications();

  const [isEditingPassword, setIsEditingPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [tabIndex, setTabIndex] = useState(initialTabIndex);
  const [isIosNotPWA, setisIosNotPWA] = useState(false);

  const { isMobile, isMobileOrTablet } = useResponsive();

  const allowQrTab = user?.roleType ? allOperatorRoles.includes(user?.roleType) : false;

  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase());
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as NavigatorStandalone).standalone === true;

    if (isIOS && !isStandalone) {
      setisIosNotPWA(true);
    }
  }, []);

  useEffect(() => {
    setTabIndex(initialTabIndex);
  }, [initialTabIndex]);

  const handleDialogClose = () => {
    onClose();
  };

  const handleUpdateName = async (updatedName: string) => {
    await updateDisplayName(updatedName).then(() => {
      setUserFields({ displayName: updatedName });
    });
  };

  const handleUpdateSenderName = async (updatedSenderName: string) => {
    await updateSenderName(updatedSenderName).then(() => {
      setUserFields({ senderName: updatedSenderName });
    });
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  const qrUrl = user?.qrUrl || '';

  const copyToClipboard = async () => {
    if (!qrUrl) return;

    try {
      await navigator.clipboard.writeText(qrUrl).then(() => {
        enqueueSnackbar(t('user.copied'), { variant: 'success' });
      });
    } catch {
      enqueueSnackbar(t('user.copyFailed'), { variant: 'error' });
    }
  };

  const handleNotificationToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoading(true);
    try {
      if (!e.target.checked) {
        await unsubscribeUser();
        localStorage.setItem(NOTIFICATION_DISABLED_KEY, 'true');
        enqueueSnackbar(t('user.notificationsDisabled'), { variant: 'info' });
      } else {
        await subscribeUser();
        localStorage.removeItem(NOTIFICATION_DISABLED_KEY);
        enqueueSnackbar(t('user.notificationsEnabled'), { variant: 'success' });
      }
    } catch {
      enqueueSnackbar(t('user.notificationsError'), { variant: 'error' });
    }
    setLoading(false);
  };

  const renderPersonalInfo = () => (
    <>
      <UploadProfile />
      <LabeledGrid
        width={{ xs: '100%', lg: 550 }}
        showBottomDivider
        flexColumn={isMobileOrTablet}
        rows={[
          [
            t('currentEmailAddress'),
            <SkeletonSuspense isLoading={isUserLoading} key={uniqueKey()}>
              <Typography variant='body1'>{user?.email}</Typography>
            </SkeletonSuspense>,
          ],
          [
            t('currentAccountName'),
            user && (
              <>
                <EditableTextLabel
                  label={user.displayName}
                  onSubmit={handleUpdateName}
                  maxLength={DISPLAY_NAME_MAX_CHAR_LIMIT}
                />
                <UserNameTooLong />
              </>
            ),
          ],
          [
            <LabelWithHint
              key='senderNameLabel'
              label={t('currentSenderName')}
              hint={t('senderNameHint')}
            />,
            user && (
              <EditableTextLabel
                label={user.senderName || ''}
                onSubmit={handleUpdateSenderName}
                maxLength={DISPLAY_NAME_MAX_CHAR_LIMIT}
                allowEmpty
                emptyPlaceholder={t('notSpecified')}
              />
            ),
          ],
          [
            t('currentPassword'),
            <>
              {!isEditingPassword && (
                <Stack
                  key={uniqueKey()}
                  direction='row'
                  alignItems='center'
                  gap={1}
                  width='100%'
                  justifyContent='space-between'
                >
                  <Typography variant='muted'>●●●●●●●●</Typography>
                  <TooltipIconButton
                    title={t('actions.edit')}
                    icon={<EditIcon />}
                    onClick={() => setIsEditingPassword(true)}
                    iconButtonProps={{ size: 'small' }}
                  />
                </Stack>
              )}
              <EditPassword open={isEditingPassword} onClose={() => setIsEditingPassword(false)} />
            </>,
          ],
          [
            <LabelWithHint
              key='enableNotificationsLabel'
              label={t('enableNotifications')}
              hint={isIosNotPWA ? t('notificationsIOSnotPWADevice') : t('notificationsPerDevice')}
            />,
            <>
              <Switch
                checked={isBrowserSubscribed}
                disabled={loading}
                onChange={handleNotificationToggle}
              />
            </>,
          ],
        ]}
      />
    </>
  );

  const renderQRCode = () => (
    <Stack
      justifyContent='center'
      alignItems='center'
      sx={{
        width: { xs: '100%', lg: 400 },
        maxWidth: 400,
        p: 2,
        margin: '0 auto',
      }}
      gap={3}
    >
      {qrUrl ? (
        <>
          <QRCode value={qrUrl} size={isMobile ? 150 : isMobileOrTablet ? 250 : 200} />
          <Stack gap={1} width='100%'>
            <Typography fontSize={14} variant='caption'>
              {t('user.shareUrl')}
            </Typography>
            <TextField
              value={qrUrl}
              fullWidth
              variant='outlined'
              size='small'
              slotProps={{
                input: {
                  readOnly: true,
                  disabled: true,
                  endAdornment: (
                    <InputAdornment position='end'>
                      <IconButton size='small' onClick={copyToClipboard}>
                        <ContentCopy fontSize='small' />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Stack>
        </>
      ) : (
        <Stack direction='column' alignItems='center' gap={1}>
          <QrCode2Icon sx={{ fontSize: { xs: 80, sm: 120 } }} />
          <Typography mx={5} textAlign='center'>
            {t('user.notFoundQrUrl')}
          </Typography>
        </Stack>
      )}
    </Stack>
  );

  return (
    <Dialog
      PaperComponent={Paper}
      onClose={handleDialogClose}
      open={settingsOpen}
      fullScreen={isMobileOrTablet}
    >
      <DialogTitle>
        <Stack direction='row' alignItems='center' justifyContent='space-between'>
          {t('sidebar.accountSettings')}
          <IconButton aria-label='close' onClick={handleDialogClose} color='secondary'>
            <CloseIcon />
          </IconButton>
        </Stack>
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          variant={isMobileOrTablet ? 'fullWidth' : 'standard'}
        >
          <Tab label={t('user.personalInfo')} />
          {allowQrTab && <Tab label={t('user.qrCode')} />}
        </Tabs>
      </DialogTitle>
      <DialogContent
        sx={{
          overflowX: 'hidden',
        }}
      >
        {tabIndex === 0 && renderPersonalInfo()}
        {tabIndex === 1 && renderQRCode()}
      </DialogContent>
      <DialogActions>
        <Button
          color='secondary'
          size='medium'
          onClick={handleDialogClose}
          fullWidth={isMobileOrTablet}
          sx={{ mb: { xs: 2, sm: 0 } }}
        >
          {t('actions.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
