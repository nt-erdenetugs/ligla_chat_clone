import { menuItemClasses } from '@mui/material/MenuItem';
import Popover, { type PopoverOrigin } from '@mui/material/Popover';

import { StyledArrow } from './styles';
import type { MenuPopoverProps } from './types';
import { getPosition } from './utils';

export const CustomPopover = ({
  open,
  anchorEl,
  children,
  arrow = 'top-right',
  hiddenArrow,
  sx,
  ...other
}: MenuPopoverProps) => {
  const { style, anchorOrigin, transformOrigin } = getPosition(arrow);

  return (
    <Popover
      open={Boolean(open)}
      anchorEl={anchorEl}
      anchorOrigin={anchorOrigin as PopoverOrigin}
      transformOrigin={transformOrigin as PopoverOrigin}
      slotProps={{
        paper: {
          sx: {
            width: 'auto',
            overflow: 'inherit',
            ...style,
            [`& .${menuItemClasses.root}`]: {
              '& svg': {
                mr: 2,
                flexShrink: 0,
              },
            },
            ...sx,
          },
        },
      }}
      {...other}
    >
      {!hiddenArrow && <StyledArrow arrow={arrow} />}

      {children}
    </Popover>
  );
};
