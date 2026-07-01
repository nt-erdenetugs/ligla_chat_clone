import { Box, Button, CircularProgress, Stack } from '@mui/material';
import { enqueueSnackbar } from 'notistack';

import { UploadProfileImage } from '~/common/components';
import { useUploadProfile } from '~/common/hooks';
import { useAuthContext } from '~/context/AuthContext';
import { useTranslation } from '~/locales/hooks';

export default function UploadProfile() {
  const { t, t_toasts, t_errors } = useTranslation();
  const { user, updatePictureUrl } = useAuthContext();

  const { pictureUrl, isUploading, isChanged, handleDrop, upload, reset } = useUploadProfile(
    user?.pictureUrl,
  );

  const handleSubmit = async () => {
    if (!pictureUrl) return;

    const success = await upload();
    if (success) {
      updatePictureUrl(pictureUrl);
      enqueueSnackbar(t_toasts('auth.success.updateProfile'), { variant: 'success' });
    } else {
      enqueueSnackbar(t_errors('failedToSave'), { variant: 'error' });
    }
  };

  return (
    <Stack sx={{ mb: 2 }}>
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <UploadProfileImage fileUrl={pictureUrl} isLoading={isUploading} onDrop={handleDrop} />
      </Box>

      {isChanged && (
        <Stack direction='row' justifyContent='flex-end' gap={1}>
          <Button
            startIcon={isUploading && <CircularProgress size={12} />}
            variant='contained'
            onClick={handleSubmit}
            disabled={isUploading}
          >
            {t('actions.keep')}
          </Button>
          <Button variant='outlined' color='secondary' onClick={reset}>
            {t('actions.cancel')}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
