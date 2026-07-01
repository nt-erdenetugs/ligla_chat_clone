import { Outlet } from 'react-router';

import { PWAInstallDrawer } from '~/common/components';

export const MaintenanceModeLayout = () => (
  <>
    <PWAInstallDrawer />
    <Outlet />
  </>
);
