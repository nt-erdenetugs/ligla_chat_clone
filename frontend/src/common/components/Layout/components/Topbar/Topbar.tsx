import { AppBar, Toolbar, Stack } from '@mui/material';

import { AccountMenu, LanguageMenu } from '~/common/components';
import { useResponsive } from '~/common/hooks';

export const useTopBarHeight = () => {
  const { isMobile } = useResponsive();
  return isMobile ? 54 : 64;
};

export const Topbar = () => {
  const { isMobileOrTablet } = useResponsive();
  const topBarHeight = useTopBarHeight();

  if (!isMobileOrTablet) return null;

  return (
    <AppBar
      position='fixed'
      sx={{
        backgroundColor: '#fff',
        boxShadow: 'none',
        borderBottom: '1px solid #edeff0',
        minHeight: `${topBarHeight}px`,
        height: `${topBarHeight}px`,
      }}
    >
      <Toolbar
        sx={{
          px: '1rem',
          justifyContent: 'end',
          whiteSpace: 'nowrap',
          minHeight: `${topBarHeight}px`,
          height: `${topBarHeight}px`,
        }}
        disableGutters
      >
        <Stack direction='row'>
          <LanguageMenu showLabel={false} />
          <AccountMenu showLabel={false} />
        </Stack>
      </Toolbar>
    </AppBar>
  );
};
