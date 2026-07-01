import { Box } from '@mui/material';

import { AuthForm } from '~/common/components';
import { useResponsive } from '~/common/hooks';
import { useTranslation } from '~/locales/hooks';

import { AppLogo } from '.';

export const UserLogin = () => {
  const { t } = useTranslation();
  const { isMobileOrTablet } = useResponsive();

  if (isMobileOrTablet) {
    return (
      <Box display='flex' alignItems='center' justifyContent='center' width='100%' bgcolor='white'>
        <Box sx={{ width: '100%', px: 2 }}>
          <AppLogo title={t('app.title')} />
          <AuthForm isHypervisor={false} />
        </Box>
      </Box>
    );
  }

  return (
    <>
      <Box display='flex' alignItems='center' justifyContent='center' width='50%' bgcolor='white'>
        <AuthForm isHypervisor={false} />
      </Box>
      <Box
        display='flex'
        flexDirection='column'
        alignItems='center'
        justifyContent='center'
        width='50%'
        sx={{
          backgroundColor: '#EBF7F3',
          borderTopLeftRadius: '40px',
          borderBottomLeftRadius: '40px',
        }}
      >
        <AppLogo title={t('app.title')} fontSize={40} spacing={2} />
      </Box>
    </>
  );
};
