import { Box } from '@mui/material';

import { SplashLoader } from '~/common/components';
import { useAuthContext } from '~/context/AuthContext';
import { UserLogin, HypervisorLogin } from '~/modules/Auth';

export type LoginPropsType = {
  isHypervisor?: boolean;
};

export const LoginPage = ({ isHypervisor }: LoginPropsType) => {
  const { isUserLoading } = useAuthContext();

  if (isUserLoading) {
    return <SplashLoader />;
  }

  return (
    <Box display='flex' minHeight='100vh' height='100vh'>
      {isHypervisor ? <HypervisorLogin /> : <UserLogin />}
    </Box>
  );
};
