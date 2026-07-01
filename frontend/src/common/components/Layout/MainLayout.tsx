import { useEffect } from 'react';

import { Box } from '@mui/material';
import { Outlet, useLocation } from 'react-router';

import { useBoolean, useResponsive } from '~/common/hooks';

import { Topbar, Sidebar, useTopBarHeight } from './components';

export const MainLayout = () => {
  const mobileSidebar = useBoolean();
  const location = useLocation();
  const { isMobileOrTablet } = useResponsive();
  const topBarHeight = useTopBarHeight();

  useEffect(() => {
    if (mobileSidebar.value) {
      mobileSidebar.onFalse();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const layoutMarginTop = `${topBarHeight}px`;

  const layoutSx = {
    flexGrow: 1,
    px: 1,
    pt: isMobileOrTablet ? 1 : 2,
    minHeight: isMobileOrTablet ? `calc(100vh - ${layoutMarginTop})` : '100vh',
    mt: isMobileOrTablet ? layoutMarginTop : 0,
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <Topbar />
      <Sidebar mobileOpen={mobileSidebar.value} onMobileClose={mobileSidebar.onFalse} />
      <Box component='main' sx={layoutSx}>
        <Outlet />
      </Box>
    </Box>
  );
};
