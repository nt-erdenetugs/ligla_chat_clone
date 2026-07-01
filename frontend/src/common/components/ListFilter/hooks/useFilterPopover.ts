import { useState, type MouseEvent } from 'react';

export const useFilterPopover = () => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const handleOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const open = Boolean(anchorEl);
  return { anchorEl, open, handleOpen, handleClose } as const;
};
