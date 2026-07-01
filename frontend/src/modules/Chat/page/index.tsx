import { useState, memo, useCallback, useMemo } from 'react';

import { Box } from '@mui/material';

import { useTopBarHeight } from '~/common/components';
import { useEdgeSwipe, useResponsive } from '~/common/hooks';
import {
  ChatProvider,
  ChatList,
  ChatRoom,
  ChatScreenProvider,
  useChatScreenContext,
  ChatFileProvider,
} from '~/modules/Chat';

export type ChatPageProps = {
  isMounting: boolean;
  setIsMounting?: (value: boolean) => void;
};

const ChatLayoutWrapper = memo(() => {
  const [isMounting, setIsMounting] = useState(true);
  const topBarHeight = useTopBarHeight();

  const {
    isChatRoomOpen,
    isChatListOpen,
    closeChatList,
    openChatList,
    isChatDetailOpen,
    openChatDetail,
    closeChatDetail,
  } = useChatScreenContext();
  const { isDesktop } = useResponsive();

  useEdgeSwipe({
    onSwipeLeft: () => {
      if (isDesktop) return;
      if (isChatRoomOpen) return openChatDetail();
      if (isChatListOpen) return closeChatList();
    },
    onSwipeRight: () => {
      if (isDesktop) return;
      if (isChatRoomOpen) return openChatList();
      if (isChatDetailOpen) return closeChatDetail();
    },
  });

  const handleSetIsMounting = useCallback((value: boolean) => {
    setIsMounting(value);
  }, []);

  const pageLayout = useMemo(
    () => (
      <Box
        sx={{
          display: 'flex',
          height: { xs: `calc(100dvh - ${topBarHeight}px)`, lg: '100vh' },
          zIndex: (theme) => theme.zIndex.appBar + 1,
          mt: { xs: -1, lg: -2 },
          pt: { xs: 1, lg: 0 },
          position: { xs: 'fixed', lg: 'static' },
          left: 0,
          right: 0,
          px: { xs: 1, lg: 0 },
        }}
      >
        <ChatList isMounting={isMounting} setIsMounting={handleSetIsMounting} />
        <ChatRoom isMounting={isMounting} />
      </Box>
    ),
    [topBarHeight, isMounting, handleSetIsMounting],
  );

  return pageLayout;
});

ChatLayoutWrapper.displayName = 'ChatLayoutWrapper';

export const ChatPage = memo(() => (
  <ChatProvider>
    <ChatScreenProvider>
      <ChatFileProvider>
        <ChatLayoutWrapper />
      </ChatFileProvider>
    </ChatScreenProvider>
  </ChatProvider>
));

ChatPage.displayName = 'ChatPage';
