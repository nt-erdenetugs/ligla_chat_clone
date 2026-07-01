import { useMemo, memo } from 'react';

import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { Box, Stack, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';

import { Suspense, useLightBox } from '~/common/components';
import Lightbox from '~/common/components/Elements/Lightbox';
import { useChatFileValidation } from '~/common/hooks';
import { useAuthContext } from '~/context/AuthContext';
import { InfiniteQueryProvider } from '~/context/InfiniteScrollContext';
import { ChatMessageType, ChatStatus } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import {
  useChatScroll,
  ChatMessages,
  ChatRoomHeader,
  ChatRoomInput,
  ScrollToBottomChip,
  type ChatPageProps,
  useChatRoomContext,
  useChatActions,
  ChatDetail,
  ChatRoomHeaderHeight,
} from '~/modules/Chat';
import { FileUploadDialog } from '~/modules/Chat/components/ChatFile/components/ChatFileUploadDialog';
import { useChatFileContext } from '~/modules/Chat/context';
import { useChatDragAndDropUpload } from '~/modules/Chat/hooks';

import { UploadingChip } from './components/UploadingChip';

export const ChatRoom = memo(function ChatRoom({ isMounting }: ChatPageProps) {
  const { user } = useAuthContext();
  const { t_chat, t_toasts } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { addFiles, isUploadDialogOpen, closeUploadDialog } = useChatFileContext();
  const { validateFiles } = useChatFileValidation();
  const {
    isFetchingOne,
    chatMessages,
    targetChat,
    infiniteQueryResponse,
    isChatFileUploadEnabled,
  } = useChatRoomContext();
  const {
    message,
    isMessageSending,
    isChangingChatStatus,
    changeChatStatus,
    sendMessage,
    sendUploadLink,
    sendFileUploadedMessage,
    sendMessageToLigla,
    handleChatUpdate,
    setMessage,
  } = useChatActions();
  const {
    virtualizerRef,
    showScrollToBottomChip,
    scrollToBottom,
    shouldScrollToBottom,
    setShouldScrollToBottom,
    onScroll,
  } = useChatScroll();

  const slides = useMemo(
    () =>
      chatMessages
        ?.filter((message) => message.type === ChatMessageType.Image)
        .map((message) => ({ src: message.content })),
    [chatMessages],
  );

  const lightbox = useLightBox(slides || []);

  const isLoading = isFetchingOne || isMounting;

  const assignedUser = useMemo(() => targetChat?.assignedUser || null, [targetChat?.assignedUser]);

  const targetChatProps = useMemo(
    () =>
      targetChat
        ? {
            id: targetChat.id,
            sessionActive: targetChat.sessionActive,
            isUserBlocked: targetChat.isUserBlocked,
            endUserId: targetChat.endUserId,
            assignedUserId: targetChat.assignedUserId || '',
            assignedUser,
            chatStatus: targetChat.chatStatus,
          }
        : null,
    [targetChat, assignedUser],
  );

  const { isDraggingOver, handleDragEnter, handleDragOver, handleDragLeave, handleDrop } =
    useChatDragAndDropUpload({
      isEnabled: Boolean(isChatFileUploadEnabled) && targetChat?.chatStatus !== ChatStatus.Done,
      targetChatId: targetChat?.id ?? null,
      onFilesDropped: async (files) => {
        const validFiles = await validateFiles(files);
        if (validFiles.length > 0) addFiles(validFiles);
      },
      onPermissionDenied: () =>
        enqueueSnackbar(t_toasts('chat.error.file.permission'), { variant: 'error' }),
    });

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 1,
        flex: 1,
        minWidth: 0,
      }}
    >
      <ChatRoomHeader
        targetChat={targetChat}
        user={user}
        isLoading={isLoading}
        isChangingChatStatus={isChangingChatStatus}
        onChange={scrollToBottom}
        changeChatStatus={changeChatStatus}
      />
      <Box sx={{ height: `calc(100% - ${ChatRoomHeaderHeight}px)`, display: 'flex' }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            height: 1,
            bgcolor: '#ACB5BD',
            position: 'relative',
          }}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Box sx={{ height: 1, overflow: 'hidden', position: 'relative' }}>
            <Suspense isLoading={isLoading}>
              <InfiniteQueryProvider infiniteQueryResponse={infiniteQueryResponse}>
                <ChatMessages
                  ref={virtualizerRef}
                  openLightbox={lightbox.onOpen}
                  infiniteQueryResponse={infiniteQueryResponse}
                  shouldScrollToBottom={shouldScrollToBottom}
                  setShouldScrollToBottom={setShouldScrollToBottom}
                  onScroll={onScroll}
                />
              </InfiniteQueryProvider>
            </Suspense>

            <Box
              sx={{
                position: 'absolute',
                bottom: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                pointerEvents: 'none',
              }}
            >
              {showScrollToBottomChip && (
                <ScrollToBottomChip show={showScrollToBottomChip} handleClick={scrollToBottom} />
              )}
              <UploadingChip />
            </Box>
          </Box>

          <Lightbox
            index={lightbox.selected}
            slides={slides}
            disabledVideo
            disabledTotal
            open={lightbox.open}
            close={lightbox.onClose}
          />

          {!isLoading && targetChatProps && (
            <ChatRoomInput
              targetChatId={targetChatProps.id}
              isUserBlocked={targetChatProps.isUserBlocked}
              message={message}
              isMessageSending={isMessageSending}
              assignedUserId={targetChatProps.assignedUserId}
              assignedUser={targetChatProps.assignedUser}
              chatStatus={targetChatProps.chatStatus}
              setMessage={setMessage}
              sendMessage={sendMessage}
              sendUploadLink={sendUploadLink}
              sendFileUploadedMessage={sendFileUploadedMessage}
              sendMessageToLigla={sendMessageToLigla}
              handleChatUpdate={handleChatUpdate}
            />
          )}

          {targetChatProps && (
            <FileUploadDialog
              open={isUploadDialogOpen}
              onClose={closeUploadDialog}
              chatId={targetChatProps.id}
            />
          )}

          {isDraggingOver && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                bgcolor: 'rgba(33, 33, 33, 0.78)',
                border: '2px dashed',
                borderColor: '#6CE131',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                pointerEvents: 'none',
              }}
            >
              <Stack spacing={1.5} alignItems='center' textAlign='center'>
                <CloudUploadIcon sx={{ fontSize: 48, color: '#6CE131' }} />
                <Typography variant='h6' color='common.white'>
                  {t_chat('fileUpload.dropTitle')}
                </Typography>
              </Stack>
            </Box>
          )}
        </Box>
        <ChatDetail isMounting={isMounting} />
      </Box>
    </Box>
  );
});

ChatRoom.displayName = 'ChatRoom';
