import { useMemo, useState } from 'react';

import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Button, Collapse, List, Stack } from '@mui/material';

import { NavItem, type SidebarListProps } from '~/common/components';
import { useAuthContext } from '~/context/AuthContext';
import { useTranslation } from '~/locales/hooks';
import { hypervisorSidebarRoutes, getSidebarRoutesByRole } from '~/routes/sidebar';

type PropsType = Pick<SidebarListProps, 'isSidebarExpanded'> & { category: string };

export const SidebarListByCategory = ({ category, isSidebarExpanded }: PropsType) => {
  const { t } = useTranslation();
  const { isHypervisorUser, user } = useAuthContext();

  const lsKey = `ligla-sidebar-collapse-${category}`;
  const [isCollapsed, setIsCollapsed] = useState(!!localStorage.getItem(lsKey));

  const toggleCollapse = () => {
    if (isCollapsed) {
      localStorage.removeItem(lsKey);
    } else {
      localStorage.setItem(lsKey, '1');
    }
    setIsCollapsed((prev) => !prev);
  };

  const filteredRoutes = useMemo(() => {
    const availableRoutes = isHypervisorUser
      ? hypervisorSidebarRoutes
      : user
        ? getSidebarRoutesByRole(user.roleType)
        : [];

    return availableRoutes
      .filter((route) => route.category === category)
      .map((route) => ({
        ...route,
        label: t(`sidebar.${route.label}`),
      }));
  }, [isHypervisorUser, user, category, t]);

  if (filteredRoutes.length === 0) return null;

  const collapseButtonStyle = {
    width: '100%',
    justifyContent: 'flex-start',
    margin: '.25rem 0 .2rem',
    gap: 1,
    fontWeight: 'bold',
    fontSize: '0.875rem',
    color: 'rgba(58, 53, 65, 0.45)',
  };

  return (
    <List
      aria-labelledby={category}
      subheader={
        isSidebarExpanded && (
          <Button size='small' sx={collapseButtonStyle} color='secondary' onClick={toggleCollapse}>
            <KeyboardArrowDownIcon
              fontSize='small'
              sx={isCollapsed ? { transform: 'rotate(-90deg)' } : undefined}
            />
            {t(`sidebar.${category}`)}
          </Button>
        )
      }
    >
      <Collapse timeout={250} in={!isSidebarExpanded || !isCollapsed}>
        <Stack pb={1}>
          {filteredRoutes.map((route) => (
            <NavItem
              key={route.label}
              icon={route.icon}
              path={route.path}
              showLabel={isSidebarExpanded}
              label={route.label}
              tooltip={route.label}
            />
          ))}
        </Stack>
      </Collapse>
    </List>
  );
};
