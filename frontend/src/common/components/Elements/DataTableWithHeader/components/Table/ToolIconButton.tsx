import { type ReactNode } from 'react';

import { IconButton, Paper, Tooltip } from '@mui/material';
import { useSearchParams } from 'react-router';

import { ACTION_PARAM_KEY } from '~/common/constants';
import { useAuthContext } from '~/context/AuthContext';

type ToolIconButtonProps = {
  title: string;
  icon: ReactNode;
  onClick: () => void;
  keep?: boolean;
  disabled?: boolean;
  isTableRow?: boolean;
};

export const ToolIconButton = ({
  title,
  icon,
  onClick,
  keep,
  disabled,
  isTableRow = true,
}: ToolIconButtonProps) => {
  const [searchParams] = useSearchParams();

  const { isHypervisorUser } = useAuthContext();

  const isDisabled = isTableRow
    ? isHypervisorUser
      ? false
      : searchParams.has(ACTION_PARAM_KEY) || disabled
    : disabled;

  const className = keep ? 'hover-tool-icon keep' : 'hover-tool-icon';
  return (
    <Paper
      className={className}
      elevation={3}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        visibility: 'hidden',
        position: 'absolute',
        top: '50%',
        right: '10px',
        transform: 'translate(0, -50%)',
        opacity: 0.1,
        overflow: 'hidden',
        transition: '.25s',
        padding: '2px',
        borderRadius: '50%',
      }}
    >
      <Tooltip title={title} placement='top'>
        <span>
          <IconButton size='small' color='primary' onClick={onClick} disabled={isDisabled}>
            {icon}
          </IconButton>
        </span>
      </Tooltip>
    </Paper>
  );
};
