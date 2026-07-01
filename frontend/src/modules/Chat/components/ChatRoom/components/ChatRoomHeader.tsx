import { memo, lazy, Suspense } from 'react';

import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import { Box, IconButton, Skeleton, Tooltip } from '@mui/material';

import { useResponsive } from '~/common/hooks';
import { type ChatStatus as ChatStatusType } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { chatListStyles, useChatScreenContext, type IChat, ChatUserInfo } from '~/modules/Chat';
import { type IUser } from '~/modules/Users';

const ChatStatus = lazy(() =>
  import('~/modules/Chat').then((mod) => ({ default: mod.ChatStatus })),
);
const AssignPopover = lazy(() =>
  import('./AssignSelector').then((mod) => ({ default: mod.AssignPopover })),
);

const StatusFallback = () => <Skeleton variant='rounded' width={80} height={24} />;
const AssignPopoverFallback = () => <Skeleton variant='rounded' width={100} height={35} />;

const HeaderSkeleton = ({ isMobileOrTablet = false }) => (
  <Box
    sx={{
      ...chatListStyles.header,
      justifyContent: 'space-between',
    }}
  >
    <Box display='flex' gap={4}>
      <Skeleton width={120} />
      {!isMobileOrTablet && <Skeleton width={200} />}
    </Box>
    <Box display='flex' gap={isMobileOrTablet ? 2 : 4}>
      {<Skeleton width={isMobileOrTablet ? 120 : 150} />}
      <Skeleton width={30} />
    </Box>
  </Box>
);

export const ChatRoomHeader = memo(
  function ChatRoomHeader({
    targetChat,
    user,
    isLoading,
    isChangingChatStatus,
    onChange,
    changeChatStatus,
  }: {
    targetChat: Nullish<IChat>;
    user: Nullish<IUser>;
    isLoading: boolean;
    isChangingChatStatus: boolean;
    onChange?: () => void;
    changeChatStatus: (chatId: string, status: ChatStatusType, onSuccess?: () => void) => void;
  }) {
    const { isChatDetailOpen, toggleChatDetail } = useChatScreenContext();
    const { t_chat } = useTranslation();
    const { isMobileOrTablet } = useResponsive();

    if (isLoading) return <HeaderSkeleton isMobileOrTablet={isMobileOrTablet} />;
    if (!targetChat || !user) return <Box sx={chatListStyles.header} />;

    return (
      <Box
        sx={{
          ...chatListStyles.header,
          flexGrow: 1,
          justifyContent: 'space-between',
          borderRight: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <ChatUserInfo direction='row' chat={targetChat} isTruncate />
          {!isMobileOrTablet && (
            <Suspense fallback={<AssignPopoverFallback />}>
              <AssignPopover onChange={onChange} />
            </Suspense>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, sm: 3 } }}>
          <Suspense fallback={<StatusFallback />}>
            <ChatStatus
              assignedUserId={targetChat.assignedUserId ?? ''}
              chatStatus={targetChat.chatStatus}
              chatId={targetChat.id}
              isChangingChatStatus={isChangingChatStatus}
              changeChatStatus={(chatId, status) => changeChatStatus(chatId, status, onChange)}
            />
          </Suspense>
          <Tooltip
            key={isChatDetailOpen ? 'chat-info-open' : 'chat-info-close'}
            title={
              isChatDetailOpen
                ? `${t_chat('action.chatInfo.close')}`
                : `${t_chat('action.chatInfo.open')}`
            }
            placement='bottom'
            arrow
          >
            <IconButton onClick={toggleChatDetail} sx={{ p: 0 }}>
              <MenuOpenIcon sx={{ rotate: isChatDetailOpen ? '180deg' : 0 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.targetChat === nextProps.targetChat &&
      prevProps.isLoading === nextProps.isLoading &&
      prevProps.isChangingChatStatus === nextProps.isChangingChatStatus
    );
  },
);

ChatRoomHeader.displayName = 'ChatRoomHeader';
