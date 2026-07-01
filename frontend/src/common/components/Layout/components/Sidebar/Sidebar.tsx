import { useState } from 'react';

import { Drawer, type Theme } from '@mui/material';

import { useResponsive } from '~/common/hooks';

import { SidebarList } from './SidebarList';

type SidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
};

const SIDEBAR_EXPANDED_WIDTH = 270;
const SIDEBAR_COLLAPSED_WIDTH = 80;
const SIDEBAR_LOCAL_STORAGE_KEY = 'ligla-sidebar-open';

export const Sidebar = ({ mobileOpen, onMobileClose }: SidebarProps) => {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(
    !!localStorage.getItem(SIDEBAR_LOCAL_STORAGE_KEY),
  );
  const { isMobileOrTablet } = useResponsive();

  if (isMobileOrTablet) {
    return (
      <Drawer
        open={mobileOpen}
        onClose={onMobileClose}
        PaperProps={{ sx: { width: '80%', maxWidth: 400 } }}
      >
        <SidebarList isSidebarExpanded />
      </Drawer>
    );
  }

  const handleToggleSidebar = () => {
    const nextState = !isSidebarExpanded;
    setIsSidebarExpanded(nextState);

    if (nextState) {
      localStorage.setItem(SIDEBAR_LOCAL_STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(SIDEBAR_LOCAL_STORAGE_KEY);
    }
  };

  const drawerWidth = isSidebarExpanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH;

  const drawerTransition = (theme: Theme) =>
    theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    });

  return (
    <Drawer
      variant='permanent'
      anchor='left'
      sx={{
        flexShrink: 0,
        width: drawerWidth,
        whiteSpace: 'nowrap',
        overflowX: 'hidden',
        transition: drawerTransition,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          borderRight: '1px solid #edeff0',
          boxSizing: 'border-box',
          transition: drawerTransition,
        },
      }}
    >
      <SidebarList isSidebarExpanded={isSidebarExpanded} onToggleSidebar={handleToggleSidebar} />
    </Drawer>
  );
};
