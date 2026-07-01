import { useState, memo, useCallback, useMemo, lazy, Suspense } from 'react';

import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import {
  Button,
  Popover,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  Tooltip,
  Skeleton,
} from '@mui/material';

import { useTranslation } from '~/locales/hooks';
import { type AssignSelectorBaseProps, type IChat, useChatRoomContext } from '~/modules/Chat';

const AssignSelector = lazy(() =>
  import('~/modules/Chat').then((mod) => ({ default: mod.AssignSelector })),
);

const renderAssignSelector = (onChange: AssignSelectorBaseProps['onChange']) => {
  return (
    <Suspense fallback={<Skeleton variant='rounded' width={100} height={35} />}>
      <AssignSelector onChange={onChange} />
    </Suspense>
  );
};

const getAssigneeName = (targetChat: IChat, t_chat: (key: string) => string, showFull = false) => {
  const { assignedUser, chatTeamAssignment } = targetChat;
  const assigneeDisplayName = assignedUser?.displayName ?? t_chat('unassigned');

  if (!chatTeamAssignment || chatTeamAssignment.length === 0) {
    return assigneeDisplayName;
  }
  const chatTeams = chatTeamAssignment.map((chat) => chat?.team).filter(Boolean);
  if (chatTeams.length === 0) return assigneeDisplayName;

  const firstTeamName = chatTeams[0].name || '';
  const restTeamCount = Math.max(0, chatTeams.length - 1);
  const assignedTeam = showFull
    ? chatTeams.map((team) => team.name).join(', ')
    : restTeamCount > 0
      ? `${firstTeamName} (+${restTeamCount})`
      : firstTeamName;

  return `${assigneeDisplayName} | ${assignedTeam}`;
};

export const AssignPopover = memo(({ onChange }: AssignSelectorBaseProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const { targetChat } = useChatRoomContext();
  const { t, t_chat } = useTranslation();

  const handleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const open = Boolean(anchorEl);

  const assigneeDisplayName = useMemo(
    () => (targetChat ? getAssigneeName(targetChat, t_chat, false) : t_chat('unassigned')),
    [targetChat, t_chat],
  );
  const assigneeFullDisplayName = useMemo(
    () => (targetChat ? getAssigneeName(targetChat, t_chat, true) : t_chat('unassigned')),
    [targetChat, t_chat],
  );

  const assignButton = useMemo(
    () => (
      <Button
        onClick={handleClick}
        startIcon={<PeopleAltOutlinedIcon fontSize='small' />}
        variant='outlined'
        color='success'
        sx={{
          borderRadius: 2,
          textTransform: 'none',
          py: 0.5,
          px: 1,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Tooltip title={assigneeFullDisplayName} placement='top'>
          <Typography noWrap sx={{ fontSize: 12, minWidth: 80 }}>
            {assigneeDisplayName}
          </Typography>
        </Tooltip>
      </Button>
    ),
    [handleClick, assigneeDisplayName, assigneeFullDisplayName],
  );

  if (!targetChat) return null;

  return (
    <>
      {assignButton}

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        closeAfterTransition={true}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        slotProps={{
          paper: {
            sx: {
              width: '350px',
              mt: 0.5,
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {t_chat('selectTeamsOperators')}
        </DialogTitle>
        <DialogContent>{renderAssignSelector(onChange)}</DialogContent>
        <DialogActions
          sx={{
            borderTop: '1px solid',
            borderColor: 'grey.200',
            py: 1,
            px: 2,
          }}
        >
          <Button onClick={handleClose} color='inherit' sx={{ fontSize: 14 }} size='small'>
            {t('actions.close')}
          </Button>
        </DialogActions>
      </Popover>
    </>
  );
});

AssignPopover.displayName = 'AssignPopover';
