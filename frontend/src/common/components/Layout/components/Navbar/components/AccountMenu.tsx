import { useState, type MouseEvent } from 'react';

import { QrCode2Outlined } from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import {
  Avatar,
  Divider,
  Drawer,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
  Box,
  ListItem,
  type MenuItemProps,
  Badge,
  Stack,
} from '@mui/material';
import { red } from '@mui/material/colors';

import { UserNameTooLong } from '~/common/components/Elements';
import { USER_DEFAULT_PICTURE_URL } from '~/common/constants';
import { allOperatorRoles } from '~/common/constants/roles';
import { useResponsive } from '~/common/hooks';
import { useAuthContext } from '~/context/AuthContext';
import { SystemUserType } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { AccountSettingsDialog } from '~/modules/Account';
import { getDisplayNames } from '~/modules/Chat';

import { type NavItemProps, NavItem } from '..';

import { SignOutDialog } from '.';

const textTruncateProps = {
  noWrap: true,
  sx: { overflow: 'hidden', textOverflow: 'ellipsis' },
};

const mobileLogoutStyle = {
  bgcolor: red[100],
  display: 'flex',
  justifyContent: 'center',
  pr: 5,
  '&:hover': {
    bgcolor: red[100],
  },
  mb: 2,
};

export const AccountMenu = ({ showLabel }: Pick<NavItemProps, 'showLabel'>) => {
  const [anchorEl, setAnchorEl] = useState<Nullable<HTMLElement>>(null);
  const [isSignOutOpen, setSignOutOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isMobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [initialTabIndex, setInitialTabIndex] = useState(0);

  const { isMobileOrTablet } = useResponsive();
  const { user, isHypervisorUser, isUserNameTooLong } = useAuthContext();
  const { t } = useTranslation();

  const profilePic = user?.pictureUrl ?? USER_DEFAULT_PICTURE_URL;
  const displayName =
    user?.systemUserType === SystemUserType.Hypervisor
      ? 'Hypervisor'
      : (user?.displayName ?? 'Unknown');
  const { fullName } = getDisplayNames(displayName);

  const openMenu = (event: MouseEvent<HTMLElement>) => {
    if (isMobileOrTablet) {
      setMobileDrawerOpen(true);
    } else {
      setAnchorEl(event.currentTarget);
    }
  };

  const closeAll = () => {
    setAnchorEl(null);
    setSignOutOpen(false);
    setSettingsOpen(false);
    setMobileDrawerOpen(false);
  };

  const handleSignOutClick = () => {
    setSignOutOpen(true);
    setMobileDrawerOpen(false);
  };

  const handleSettingsClick = () => {
    setInitialTabIndex(0);
    setSettingsOpen(true);
  };

  const handleQrCodeClick = () => {
    setInitialTabIndex(1);
    setSettingsOpen(true);
  };

  const renderAccountSettingsItem = (
    <MenuItem onClick={handleSettingsClick}>
      <ListItemIcon>
        <ManageAccountsIcon fontSize='small' sx={{ fontSize: { xs: 20, sm: 25, lg: 20 } }} />
      </ListItemIcon>
      <ListItemText
        slotProps={{
          primary: {
            sx: { fontSize: { xs: 16, sm: 20, lg: 16 } },
          },
        }}
      >
        {t('sidebar.accountSettings')}
      </ListItemText>
    </MenuItem>
  );

  const renderLogoutItem = (sx?: MenuItemProps['sx']) => (
    <MenuItem
      onClick={handleSignOutClick}
      sx={{
        borderRadius: 1,
        color: 'error.main',
        ...sx,
      }}
    >
      <ListItemIcon>
        <LogoutOutlinedIcon fontSize='small' color='error' />
      </ListItemIcon>
      <ListItemText sx={{ flex: 'none' }}>{t('sidebar.logout')}</ListItemText>
    </MenuItem>
  );

  const pcMenu = (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={closeAll}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ '& .MuiMenu-paper': { minWidth: 240, maxWidth: 340 } }}
      keepMounted
    >
      <ListItem>
        <ListItemIcon>
          <Badge
            overlap='circular'
            anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
            badgeContent='!'
            color='warning'
            invisible={!isUserNameTooLong}
          >
            <Avatar src={profilePic} sx={{ width: 40, height: 40, mr: 1 }} />
          </Badge>
        </ListItemIcon>
        <Stack direction='column'>
          <ListItemText
            primary={fullName}
            secondary={user?.email}
            slotProps={{
              primary: textTruncateProps,
              secondary: textTruncateProps,
            }}
          />
          <UserNameTooLong />
        </Stack>
      </ListItem>
      <Divider sx={{ mb: 1 }} />
      {!isHypervisorUser && renderAccountSettingsItem}
      {renderLogoutItem()}
    </Menu>
  );

  const allowQrMenu = user?.roleType ? allOperatorRoles.includes(user?.roleType) : false;

  const mobileMenu = (
    <Drawer
      anchor='bottom'
      open={isMobileDrawerOpen}
      onClose={() => setMobileDrawerOpen(false)}
      PaperProps={{
        sx: {
          p: 2,
          width: '100%',
          height: '90%',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        },
      }}
    >
      <Box>
        <Box display='flex' justifyContent='flex-start' mb={2}>
          <IconButton onClick={() => setMobileDrawerOpen(false)}>
            <CloseIcon />
          </IconButton>
        </Box>

        <Box display='flex' alignItems='center' flexDirection='column' mb={3}>
          <Avatar
            src={profilePic}
            sx={{
              width: { xs: 100, sm: 150, lg: 100 },
              height: { xs: 100, sm: 150, lg: 100 },
              mb: 3,
            }}
          />
          <Typography fontWeight='medium' fontSize={{ xs: 20, sm: 25, lg: 20 }}>
            {fullName}
          </Typography>
          <UserNameTooLong />
        </Box>

        {!isHypervisorUser && (
          <>
            {allowQrMenu && (
              <MenuItem onClick={handleQrCodeClick} sx={{ mb: { xs: 0, sm: 1, lg: 0 } }}>
                <ListItemIcon>
                  <QrCode2Outlined sx={{ fontSize: { xs: 20, sm: 25, lg: 20 } }} />
                </ListItemIcon>
                <ListItemText
                  slotProps={{
                    primary: {
                      sx: { fontSize: { xs: 16, sm: 20, lg: 16 } },
                    },
                  }}
                >
                  {t('user.qrCode')}
                </ListItemText>
              </MenuItem>
            )}
            {renderAccountSettingsItem}
          </>
        )}
      </Box>

      {renderLogoutItem(mobileLogoutStyle)}
    </Drawer>
  );

  return (
    <>
      <NavItem
        icon={
          <Badge
            overlap='circular'
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            badgeContent='!'
            color='warning'
            invisible={!isUserNameTooLong}
          >
            <Avatar src={profilePic} sx={{ width: 25, height: 25 }} />
          </Badge>
        }
        label={
          <Typography maxWidth='12rem' color='secondary' {...textTruncateProps}>
            {fullName}
          </Typography>
        }
        tooltip={t('sidebar.accountSettings')}
        showLabel={showLabel}
        onClick={openMenu}
      />

      {pcMenu}
      {mobileMenu}

      <SignOutDialog open={isSignOutOpen} onClose={closeAll} />

      {!isHypervisorUser && (
        <AccountSettingsDialog
          settingsOpen={isSettingsOpen}
          initialTabIndex={initialTabIndex}
          onClose={isMobileOrTablet ? () => setSettingsOpen(false) : closeAll}
        />
      )}
    </>
  );
};
