import { useState } from 'react';

import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import { Typography, Button, Box } from '@mui/material';
import { Link } from 'react-router';

import { FlexForm, TextFieldControl } from '~/common/components';
import { LOGIN_ROUTE, ROOT_ROUTE } from '~/common/constants';
import { useEmailForm } from '~/configs';
import { useTranslation } from '~/locales/hooks';
import { useAuthActions } from '~/modules/Auth';

export const ForgotPasswordForm = () => {
  const { control, handleSubmit } = useEmailForm({});
  const [isShowSuccessInfo, setIsShowSuccessInfo] = useState(false);

  const { isRequestingPasswordReset, requestPasswordReset } = useAuthActions();
  const { t } = useTranslation();

  const onSubmit = handleSubmit(async (data) => {
    try {
      const res = await requestPasswordReset(data);
      if (res?.data?.requestPasswordReset) {
        setIsShowSuccessInfo(true);
      }
    } catch (error) {
      console.error(error);
    }
  });

  const SuccessInfo = ({ successText }: { successText: string }) => (
    <Box textAlign='center'>
      <Typography color='success'>
        {successText}
        <br />
        <Link to={ROOT_ROUTE}>{t('forgotYourPassword.loginAgain')}</Link>
      </Typography>
    </Box>
  );

  if (isShowSuccessInfo) {
    return <SuccessInfo successText={t('forgotYourPassword.sendResetLink')} />;
  }

  return (
    <FlexForm onSubmit={onSubmit} sx={{ width: { xs: 1, sm: 400 } }}>
      <Box p={2} borderRadius={2} bgcolor='#ebf7f3'>
        <Typography variant='body2' align='center' color='secondary'>
          {t('forgotYourPassword.note')}
        </Typography>
      </Box>
      <TextFieldControl name='email' label={t('email')} control={control} type='email' required />

      <Button
        variant='contained'
        color='primary'
        type='submit'
        fullWidth
        disabled={isRequestingPasswordReset}
      >
        {isRequestingPasswordReset ? t('loading') : t('resetPassword')}
      </Button>
      <Link to={LOGIN_ROUTE}>
        <Button variant='text' color='primary' fullWidth startIcon={<ChevronLeftIcon />}>
          {t('forgotYourPassword.returnToLogin')}
        </Button>
      </Link>
    </FlexForm>
  );
};
