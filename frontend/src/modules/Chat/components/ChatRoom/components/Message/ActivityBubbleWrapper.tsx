import ComputerIcon from '@mui/icons-material/Computer';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { Box, Typography } from '@mui/material';

import { ActorType } from '~/generated/graphql/types';
import { type IChatActivity } from '~/modules/Chat';
import { formatDateTo_HHmm } from '~/plugins';

type PropsType = Pick<IChatActivity, 'actorType' | 'createdAt'> & {
  activityText: string;
};

export const ActivityBubbleWrapper = (props: PropsType) => {
  const { actorType, createdAt, activityText } = props;

  const isSystem = actorType === ActorType.System;

  const IconComponent = isSystem ? ComputerIcon : NotificationsIcon;

  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
        justifyContent: 'center',
        textAlign: 'center',
        color: 'white',
        my: 1,
        p: 0,
      }}
    >
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'flex-start',
          mt: { xs: '3px', sm: 0 },
          mx: 0.5,
        }}
      >
        <IconComponent
          sx={{
            fontSize: 12,
            color: isSystem ? 'action.active' : 'inherit',
          }}
        />
        <Typography
          variant='caption'
          fontSize={10}
          lineHeight={1.2}
          sx={{
            opacity: 0.7,
            whiteSpace: 'nowrap',
          }}
        >
          {formatDateTo_HHmm(createdAt)}
        </Typography>
      </Box>

      <Box
        sx={{
          flexShrink: 0,
          maxWidth: '60%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Typography
          variant='caption'
          sx={{
            fontSize: { xs: 13, sm: 10 },
            lineHeight: 1.2,
            textAlign: 'center',
            width: 'fit-content',
            maxWidth: '100%',
          }}
        >
          {activityText}
        </Typography>
      </Box>

      <Box sx={{ flex: 1 }} />
    </Box>
  );
};
