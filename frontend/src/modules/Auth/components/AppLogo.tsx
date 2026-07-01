import { Stack, Typography } from '@mui/material';

import { useResponsive } from '~/common/hooks';
import { LOGO } from '~/configs';

type PropsType = {
  title: string;
  icon?: React.ReactNode;
  fontSize?: number;
  spacing?: number;
};

export const AppLogo = ({ title, icon, fontSize = 20, spacing = 1 }: PropsType) => {
  const { isTablet } = useResponsive();

  return (
    <Stack spacing={spacing} alignItems='center' mb='1.5rem' width={1}>
      <img
        src={LOGO}
        alt='Ligla app logo'
        width='50%'
        style={{ maxWidth: isTablet ? 200 : 'unset' }}
      />
      {icon ? (
        <Stack spacing={1} direction='row'>
          {icon}
          <Typography variant='body1' color='black'>
            {title}
          </Typography>
        </Stack>
      ) : (
        <Typography fontSize={fontSize} color='black'>
          {title}
        </Typography>
      )}
    </Stack>
  );
};
