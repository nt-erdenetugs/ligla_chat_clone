import { Box, Typography } from '@mui/material';

import { useTranslation } from '~/locales/hooks';
import { ForgotPasswordForm } from '~/modules/Auth';

export const ForgotPasswordPage = () => {
  const { t } = useTranslation();

  return (
    <Box
      display='flex'
      alignItems='center'
      justifyContent='center'
      minHeight='100vh'
      height='100vh'
      bgcolor='white'
      p={2}
    >
      <Box display='flex' flexDirection='column' alignItems='center' justifyContent='center'>
        <Box width='100%' textAlign='center'>
          <Typography variant='h6' fontWeight='bold' mb={3}>
            {t('forgotYourPassword.title')}
          </Typography>
        </Box>
        <Box borderRadius={5}>
          <ForgotPasswordForm />
        </Box>
      </Box>
    </Box>
  );
};
