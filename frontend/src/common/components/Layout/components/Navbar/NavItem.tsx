import { type MouseEventHandler, type ReactNode } from 'react';

import { ListItemButton, ListItemIcon, ListItemText, type Theme, Tooltip } from '@mui/material';
import { Link, useLocation } from 'react-router';

export type NavItemProps = {
  icon: ReactNode;
  label: ReactNode | string;
  showLabel: boolean;
  tooltip?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  path?: string;
};

export const NavItem = ({ icon, label, tooltip, showLabel, onClick, path }: NavItemProps) => {
  const location = useLocation();
  const isLink = !!path;

  const isSelected = isLink ? location.pathname.endsWith(path) : false;

  const buttonStyles = {
    borderRadius: 1,
    px: 1.5,
    width: 1,
    color: 'rgba(58, 53, 65, 0.87)',
    '&.Mui-selected': {
      color: (theme: Theme) => theme.palette.primary.main,
      '& .MuiListItemIcon-root': {
        color: (theme: Theme) => theme.palette.primary.main,
      },
    },
  };

  const iconStyles = {
    color: 'inherit',
    ...(showLabel ? {} : { minWidth: 'unset' }),
  };

  const renderLabel =
    typeof label === 'string' ? (
      <ListItemText
        primary={label}
        slotProps={{
          primary: {
            fontSize: { xs: 16, sm: 20, lg: 16 },
          },
        }}
      />
    ) : (
      label
    );

  return (
    <Tooltip title={!showLabel && tooltip} placement='right' arrow>
      <ListItemButton
        selected={isSelected}
        sx={buttonStyles}
        {...(isLink ? { component: Link, to: path } : { onClick })}
      >
        <ListItemIcon sx={iconStyles}>{icon}</ListItemIcon>
        {showLabel && renderLabel}
      </ListItemButton>
    </Tooltip>
  );
};
