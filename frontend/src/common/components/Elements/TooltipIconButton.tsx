import { type ReactNode } from 'react';

import { IconButton, Tooltip, type TooltipProps, type IconButtonProps } from '@mui/material';

type TooltipIconButtonProps = Omit<TooltipProps, 'children' | 'onClick'> & {
  onClick: IconButtonProps['onClick'];
  title: ReactNode;
  icon: ReactNode;
  iconButtonProps?: IconButtonProps;
  disabled?: boolean;
};

export const TooltipIconButton = ({
  onClick,
  title,
  icon,
  iconButtonProps,
  disabled,
  ...rest
}: TooltipIconButtonProps) => {
  return (
    <Tooltip title={!disabled && title} placement='top' arrow {...rest}>
      <span>
        <IconButton onClick={onClick} disabled={disabled} {...iconButtonProps}>
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
};
