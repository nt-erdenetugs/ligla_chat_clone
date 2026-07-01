import { useState, type ReactNode } from 'react';

import { Button, Tooltip, type ButtonProps } from '@mui/material';
import { useSearchParams } from 'react-router';

type OpenDialogButtonProps = Partial<ButtonProps> & {
  dialog: (handleClose: () => void, open?: boolean) => ReactNode;
  paramKey?: string;
  paramValue?: string;
  helpTip?: ReactNode;
};

export const OpenDialogButton = ({
  dialog,
  paramKey = 'action',
  paramValue,
  helpTip,
  children,
  disabled,
  ...props
}: OpenDialogButtonProps) => {
  const [open, setOpen] = useState<boolean>(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const handleOpen = () => {
    if (paramValue) {
      searchParams.set(paramKey, paramValue);
      setSearchParams(searchParams);
    } else {
      setOpen(true);
    }
  };

  const handleClose = () => {
    if (paramValue) {
      searchParams.delete(paramKey);
      setSearchParams(searchParams);
    } else {
      setOpen(false);
    }
  };

  const dialogOpen = paramValue ? searchParams.get(paramKey) === paramValue : open;

  return (
    <>
      <Tooltip title={helpTip} placement='top'>
        <span style={{ width: 'fit-content' }}>
          <Button
            variant='outlined'
            onClick={handleOpen}
            disabled={disabled || dialogOpen}
            {...props}
          >
            {children}
          </Button>
        </span>
      </Tooltip>

      {dialogOpen && !disabled && dialog(handleClose, dialogOpen)}
    </>
  );
};
