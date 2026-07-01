import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { Box } from '@mui/material';

import { AuthForm } from '~/common/components';
import { useResponsive } from '~/common/hooks';
import { useTranslation } from '~/locales/hooks';

import { AppLogo } from '.';

export const HypervisorLogin = () => {
  const { t } = useTranslation();
  const { isMobileOrTablet } = useResponsive();

  const containerStyles = isMobileOrTablet
    ? { width: '100%', px: 2 }
    : { backgroundColor: 'white', padding: '6rem 4rem', borderRadius: '0.75rem' };

  return (
    <Box
      display='flex'
      alignItems='center'
      justifyContent='center'
      width='100%'
      bgcolor={isMobileOrTablet ? 'white' : '#F5F5F5'}
    >
      <Box sx={containerStyles}>
        <AppLogo
          title={t('systemAdministratorPortal')}
          icon={<VerifiedUserIcon color='primary' />}
          spacing={2}
        />
        <AuthForm isHypervisor={true} />
      </Box>
    </Box>
  );
};
