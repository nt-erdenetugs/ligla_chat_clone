import { Typography, Button, Link } from '@mui/material';

import { FlexForm, TextFieldControl, PasswordInput } from '~/common/components';
import { useAuthContext } from '~/context/AuthContext';
import { useTranslation } from '~/locales/hooks';
import { defaultValues, useForm, type LoginPropsType } from '~/modules/Auth';

export const AuthForm = ({ isHypervisor }: LoginPropsType) => {
  const { control, handleSubmit } = useForm({ values: defaultValues });
  const { login, error, clearError, isAuthenticating } = useAuthContext();

  const { t } = useTranslation();

  const formSubmit = handleSubmit((data) => login(data, isHypervisor));

  return (
    <FlexForm onSubmit={formSubmit} sx={{ width: { xs: 1, sm: 400, margin: '0 auto' } }}>
      <TextFieldControl
        name='email'
        label={t('email')}
        control={control}
        onFocus={clearError}
        type='email'
        required
      />

      <PasswordInput
        name='password'
        label={t('password')}
        control={control}
        onFocus={clearError}
        required
      />

      {error && <Typography color='error'>{error}</Typography>}

      {!isHypervisor && <Link href='forgot-password'>{t('forgotPassword')}</Link>}

      <Button
        variant='contained'
        color='primary'
        type='submit'
        fullWidth
        disabled={isAuthenticating}
      >
        {isAuthenticating ? t('loggingIn') : t('login')}
      </Button>
    </FlexForm>
  );
};
