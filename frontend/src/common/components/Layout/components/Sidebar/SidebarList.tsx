import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import { IconButton, Tooltip, Divider, Stack, Box, Typography, styled } from '@mui/material';
import SimpleBar from 'simplebar-react';

import { SidebarListByCategory } from '~/common/components';
import { useResponsive } from '~/common/hooks';
import { LOGO, LOGO_SYMBOL } from '~/configs';
import { useAuthContext } from '~/context/AuthContext';
import { useTranslation } from '~/locales/hooks';
import { sidebarCategories } from '~/routes/sidebar';

import { AccountMenu, LanguageMenu } from '..';

const LogoImage = styled('img')({
  padding: '0.75rem 0',
});

export type SidebarListProps = {
  isSidebarExpanded: boolean;
  onToggleSidebar?: () => void;
};

export const SidebarList = ({ isSidebarExpanded, onToggleSidebar }: SidebarListProps) => {
  const { t } = useTranslation();
  const { user } = useAuthContext();
  const { isMobileOrTablet } = useResponsive();

  const logoSrc = isSidebarExpanded ? LOGO : LOGO_SYMBOL;

  const sidebarHeader = (
    <Stack alignItems='center' pt={2} px={2} overflow='clip'>
      <LogoImage src={logoSrc} alt='Ligla chat logo' sx={{ height: { xs: 62, sm: 80, lg: 62 } }} />
      {isSidebarExpanded && (
        <Tooltip title={user?.organization?.displayName} placement='right' arrow>
          <Typography
            variant='subtitle2'
            color='#222'
            width={1}
            px={1}
            pb={{ xs: 1, lg: 0 }}
            fontSize={{ xs: 14, sm: 20, lg: 14 }}
            overflow='hidden'
            textOverflow='ellipsis'
            textAlign='center'
            noWrap
          >
            {user?.organization?.displayName || t('app.title')}
          </Typography>
        </Tooltip>
      )}
    </Stack>
  );

  const sidebarFooter = (
    <>
      <Stack py={1} px={2} gap={0.5} sx={{ overflow: 'clip' }}>
        <AccountMenu showLabel={isSidebarExpanded} />
        <LanguageMenu showLabel={isSidebarExpanded} />
      </Stack>

      <Divider variant='middle' />

      <Stack
        direction='row'
        px={2}
        py={1}
        justifyContent={isSidebarExpanded ? 'flex-end' : 'center'}
      >
        <Tooltip
          key={isSidebarExpanded ? 'sidebar-open' : 'sidebar-close'}
          title={isSidebarExpanded ? t('sidebar.closeMenu') : t('sidebar.openMenu')}
          placement='right'
          arrow
        >
          <IconButton
            onClick={onToggleSidebar}
            sx={!isSidebarExpanded ? { transform: 'rotate(180deg)' } : undefined}
          >
            <MenuOpenIcon />
          </IconButton>
        </Tooltip>
      </Stack>
    </>
  );

  return (
    <>
      {sidebarHeader}

      <Box flexGrow={1} sx={{ height: '100%', overflow: 'hidden' }}>
        <SimpleBar
          forceVisible='y'
          style={{ maxHeight: '100%', padding: '.25rem 1rem 0.25rem 1rem' }}
        >
          {Object.values(sidebarCategories).map((category) => (
            <SidebarListByCategory
              key={category}
              category={category}
              isSidebarExpanded={isSidebarExpanded}
            />
          ))}
        </SimpleBar>
      </Box>

      {!isMobileOrTablet && sidebarFooter}
    </>
  );
};
