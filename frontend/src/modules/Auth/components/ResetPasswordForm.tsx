import { useState, useEffect } from 'react';

import { Typography, Button, Box } from '@mui/material';
import { useLocation, Link } from 'react-router';

import { PasswordInput, FlexForm } from '~/common/components';
import { ROOT_ROUTE } from '~/common/constants';
import { useAuthContext } from '~/context/AuthContext';
import { useTranslation } from '~/locales/hooks';
import { useResetPasswordForm, useAuthActions } from '~/modules/Auth';

const SuccessInfo = ({ successText }: { successText: string }) => {
  return (
    <Box textAlign='center'>
      <Typography color='success'>
        {successText}
        <br />
        <Link to={ROOT_ROUTE}>Log in again</Link>
      </Typography>
    </Box>
  );
};

export const ResetPasswordForm = ({ token, initial }: { token: string; initial?: boolean }) => {
  const location = useLocation();
  const { control, handleSubmit } = useResetPasswordForm({});
  const { isResettingPassword, resetPasswordByToken } = useAuthActions();
  const { logOut } = useAuthContext();
  const [isShowSuccessInfo, setIsShowSuccessInfo] = useState(false);

  const { t } = useTranslation();

  useEffect(() => {
    return () => {
      logOut();
    };
  }, [location, logOut]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      const res = await resetPasswordByToken({
        token,
        newPassword: data.password,
      });

      if (res?.data?.resetPasswordByToken.success) {
        setIsShowSuccessInfo(true);
      }
      if (!initial) {
        logOut();
      }
    } catch (error) {
      console.error(error);
    }
  });

  if (isShowSuccessInfo) {
    return <SuccessInfo successText={t('resetSuccess')} />;
  }

  return (
    <>
      <Box sx={{ flexDirection: 'column', display: 'flex', mb: 3 }}>
        <Typography fontSize={24} fontWeight={600}>
          {initial ? t('initialLogin') : t('resetPassword')}
        </Typography>
      </Box>
      <FlexForm onSubmit={onSubmit} sx={{ width: { xs: 1, sm: 400 } }}>
        <PasswordInput name='password' label={t('newPassword')} control={control} required />
        <PasswordInput
          name='validatePassword'
          label={t('newPasswordForConfirmation')}
          control={control}
          required
        />
        <Button
          variant='contained'
          color='primary'
          type='submit'
          fullWidth
          disabled={isResettingPassword}
        >
          {isResettingPassword ? t('loading') : initial ? t('login') : t('resetPassword')}
        </Button>
      </FlexForm>
    </>
  );
};
