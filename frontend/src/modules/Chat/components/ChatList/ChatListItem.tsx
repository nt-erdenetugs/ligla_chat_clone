import { memo } from 'react';

import {
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Box,
  Typography,
  Avatar,
  Chip,
  Tooltip,
  Badge,
} from '@mui/material';

import { getChatStatusLabel, USER_DEFAULT_PICTURE_URL } from '~/common/constants';
import { useAuthContext } from '~/context/AuthContext';
import { ChatMessageType, ChatStatus, SenderType } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { chatListStyles, getDisplayNames, type IChat, type ID } from '~/modules/Chat';
import { formatMessageTime } from '~/plugins';
import { discardNull } from '~/utils';

type ChatListItemProps = {
  chat: IChat;
  open: boolean;
  targetChatId: string;
  isChatUploading: boolean;
  setTargetChatId: (chatId: string) => void;
};

export const ChatListItem = memo(function ChatListItem({
  chat,
  open,
  targetChatId,
  isChatUploading,
  setTargetChatId,
}: ChatListItemProps) {
  const { user } = useAuthContext();
  const { t_chat } = useTranslation();

  const {
    id,
    assignedUser,
    chatStatus,
    chatMessages = [],
    endUser: { pictureUrl, displayName } = {},
    createdAt: chatCreatedAt,
    chatUnreadCount,
  } = chat;

  const handleSelect = (id: ID) => {
    setTargetChatId(id);
  };

  const isSelected = id === targetChatId;

  const { fullName } = getDisplayNames(discardNull(displayName));

  const latestMessage = chatMessages[0] || {};

  const { content, createdAt, senderType, senderId, isDelivering, isRetrying, isDelivered, type } =
    latestMessage;

  const isMyMessage = user?.id === senderId;

  const isUnread = chatStatus !== ChatStatus.Done && (chatUnreadCount ?? 0) > 0;

  let chatContent = '';

  if (isChatUploading) {
    chatContent = t_chat('fileUpload.uploading');
  } else if (content) {
    if (senderType === SenderType.EndUser) {
      chatContent = type === ChatMessageType.Text ? content : t_chat('sentMedia');
    } else {
      const senderLabel = isMyMessage ? 'You' : 'Operator';

      let messageStatusLabel = '';
      if (isDelivering) {
        messageStatusLabel = t_chat('sending');
      } else if (isRetrying) {
        messageStatusLabel = t_chat('retrying');
      } else if (!isDelivered) {
        messageStatusLabel = t_chat('failedToSend');
      }

      chatContent = `${senderLabel}: ${messageStatusLabel || content}`;
    }
  }

  return (
    <Tooltip title={open ? '' : fullName} placement='bottom-start'>
      <ListItem key={id} disablePadding sx={chatListStyles.listItem(isSelected)}>
        <ListItemButton onClick={() => handleSelect(id)} sx={chatListStyles.listItemButton(open)}>
          <ListItemAvatar sx={{ minWidth: 0 }}>
            <Badge
              overlap='circular'
              anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
              badgeContent={isUnread ? chatUnreadCount : 0}
              color='primary'
              slotProps={{
                badge: {
                  style: {
                    fontSize: '10px',
                    padding: 0,
                  },
                },
              }}
            >
              <Avatar
                src={pictureUrl || USER_DEFAULT_PICTURE_URL}
                sx={chatListStyles.avatar(open)}
              />
            </Badge>
          </ListItemAvatar>
          {open && (
            <>
              <Typography variant='caption' sx={chatListStyles.timeAgo}>
                {formatMessageTime(createdAt || chatCreatedAt)}
              </Typography>
              <Box sx={{ flexGrow: 1 }}>
                <ListItemText
                  primary={
                    <Box display='flex' alignItems='center' justifyContent='space-between'>
                      <Typography variant='body1' sx={chatListStyles.textPrimary(isUnread)}>
                        {fullName}
                      </Typography>
                      <Chip
                        label={t_chat(`status.${getChatStatusLabel(chatStatus)}`)}
                        size='small'
                        color='primary'
                        variant='outlined'
                        sx={{ fontSize: '10px' }}
                      />
                    </Box>
                  }
                  secondary={
                    <Typography
                      variant='body2'
                      color='textSecondary'
                      sx={chatListStyles.textSecondary(isUnread)}
                    >
                      {chatContent}
                    </Typography>
                  }
                  sx={{ margin: '0px' }}
                />
              </Box>
              <Typography
                color='secondary'
                component='span'
                textAlign='right'
                sx={chatListStyles.assignedToText(!!assignedUser)}
              >
                {assignedUser ? assignedUser.displayName : t_chat('unassigned')}
              </Typography>
            </>
          )}
        </ListItemButton>
      </ListItem>
    </Tooltip>
  );
});
