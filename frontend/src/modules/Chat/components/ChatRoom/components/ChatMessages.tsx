import { forwardRef, useEffect, useMemo, useState, useCallback, memo } from 'react';

import SpeakerNotesOffOutlinedIcon from '@mui/icons-material/SpeakerNotesOffOutlined';
import { Box, Stack, Typography } from '@mui/material';
import { type VListHandle } from 'virtua';

import { ListboxComponent, Loading } from '~/common/components';
import { useAuthContext } from '~/context/AuthContext';
import { type InfiniteQueryResponse } from '~/context/InfiniteScrollContext';
import { SenderType } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import {
  ChatBubbleType,
  type IChatActivity,
  type IChatMessage,
  ActivityBubble,
  MessageBubble,
  MessageSeparator,
  useChatRoomContext,
} from '~/modules/Chat';
import { formatDateTime } from '~/plugins';

type WithChatBubbleType<T> = T & { bubbleType: ChatBubbleType };
type IChatBubble = WithChatBubbleType<IChatMessage | IChatActivity>;
type GroupedChatBubbles = {
  key: string;
  bubbles: IChatBubble[];
};

const toMessageBubble = (message: IChatMessage): IChatBubble => ({
  ...message,
  bubbleType: ChatBubbleType.MESSAGE,
});

const toActivityBubble = (activity: IChatActivity): IChatBubble => ({
  ...activity,
  bubbleType: ChatBubbleType.ACTIVITY,
});

const mergeAndSortChatBubbles = (
  messages: IChatMessage[],
  activities: IChatActivity[],
): IChatBubble[] => {
  const merged = [...messages.map(toMessageBubble), ...activities.map(toActivityBubble)];
  return merged.sort((a, b) => {
    const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    if (a.bubbleType !== b.bubbleType) {
      return a.bubbleType === ChatBubbleType.ACTIVITY ? -1 : 1;
    }
    return a.id.localeCompare(b.id);
  });
};

const groupChatBubblesByDate = (chatBubbles: IChatBubble[]): GroupedChatBubbles[] =>
  chatBubbles.reduce((groups, bubble) => {
    const dateKey = formatDateTime(bubble.createdAt);
    const group = groups.find((g) => g.key === dateKey);

    if (group) {
      group.bubbles.push(bubble);
    } else {
      groups.push({ key: dateKey, bubbles: [bubble] });
    }

    return groups;
  }, [] as GroupedChatBubbles[]);

const isChatMessage = (bubble: IChatBubble): bubble is WithChatBubbleType<IChatMessage> =>
  bubble.bubbleType === ChatBubbleType.MESSAGE;

const isChatActivity = (bubble: IChatBubble): bubble is WithChatBubbleType<IChatActivity> =>
  bubble.bubbleType === ChatBubbleType.ACTIVITY;

const NoMessages = () => {
  const { t_chat } = useTranslation();

  return (
    <Stack alignItems='center' my={10}>
      <SpeakerNotesOffOutlinedIcon sx={{ fontSize: 100 }} />
      <Typography mt={3}>{t_chat('noMessagesInThisChat')}</Typography>
    </Stack>
  );
};

type Props = {
  openLightbox: (index: string) => void;
  infiniteQueryResponse: InfiniteQueryResponse;
  shouldScrollToBottom: boolean;
  setShouldScrollToBottom: (value: boolean) => void;
  onScroll: () => void;
};

export const ChatMessages = memo(
  forwardRef<VListHandle, Props>(function ChatMessages(
    { openLightbox, infiniteQueryResponse, ...rest },
    virtualizerRef,
  ) {
    const { user } = useAuthContext();
    const {
      chatMessages,
      prevTargetChat,
      chatActivities,
      targetChat,
      isFetchingOne,
      isChatAssignedToMe,
    } = useChatRoomContext();
    const { t_chat } = useTranslation();
    const [localLatestReadTimestamp, setLocalLatestReadTimestamp] = useState<Nullish<Date>>(null);

    useEffect(() => {
      setLocalLatestReadTimestamp(null);
    }, [prevTargetChat]);

    useEffect(() => {
      if (
        !isFetchingOne &&
        targetChat &&
        !localLatestReadTimestamp &&
        targetChat.latestReadTimestamp
      ) {
        setLocalLatestReadTimestamp(targetChat.latestReadTimestamp);
      }
    }, [isFetchingOne, localLatestReadTimestamp, targetChat?.latestReadTimestamp, targetChat]);

    const filteredChatMessages = useMemo(() => {
      if (!targetChat || !chatMessages) return [];
      return chatMessages.filter((message) => {
        const isOperatorMessage = message.senderType === SenderType.Operator;
        if (!isOperatorMessage) return true;
        return user?.id === message.sender.id || message.isDelivered;
      });
    }, [chatMessages, targetChat, user?.id]);

    const groupedBubbles = useMemo(() => {
      if (!targetChat) return [];

      const chatBubbles = mergeAndSortChatBubbles(filteredChatMessages, chatActivities);
      return groupChatBubblesByDate(chatBubbles);
    }, [filteredChatMessages, chatActivities, targetChat]);

    const renderMessageBubble = useCallback(
      (bubble: IChatMessage, prevBubble: IChatBubble | undefined) => {
        const showSender = Boolean(
          (bubble.senderType === SenderType.Operator || bubble.senderType === SenderType.System) &&
          user?.id !== bubble.sender.id,
        );
        const showProfile =
          !prevBubble || !isChatMessage(prevBubble) || prevBubble.senderId !== bubble.senderId;

        return (
          <Box key={`message-${bubble.id}`}>
            <MessageBubble
              id={bubble.id}
              chatId={targetChat!.id}
              createdAt={bubble.createdAt}
              content={bubble.content}
              type={bubble.type}
              sender={bubble.sender}
              senderType={bubble.senderType}
              showSender={showSender}
              showProfile={showProfile}
              onLightboxOpen={openLightbox}
              isDelivered={bubble.isDelivered}
              isDelivering={bubble.isDelivering}
              isRetrying={bubble.isRetrying}
              isDeleting={bubble.isDeleting}
              contentUrl={bubble.contentUrl}
              duration={bubble.duration}
              latitude={bubble.latitude}
              longitude={bubble.longitude}
              isUnsent={bubble.isUnsent}
              previewImageUrl={bubble.previewImageUrl}
            />
          </Box>
        );
      },
      [openLightbox, targetChat, user?.id],
    );

    const renderActivityBubble = useCallback((activity: IChatActivity) => {
      return (
        <Box key={`activity-${activity.id}`}>
          <ActivityBubble activity={activity} />
        </Box>
      );
    }, []);

    const chatItems = useMemo(() => {
      if (!targetChat) return [];

      const items: React.ReactNode[] = [];
      const chatCreatedAt = formatDateTime(targetChat.createdAt);

      if (infiniteQueryResponse.fetchedAll) {
        items.push(
          <Box key='chat-started-separator'>
            <MessageSeparator content={chatCreatedAt} />
          </Box>,
        );
      }

      groupedBubbles.forEach(({ key: date, bubbles }) => {
        if (date !== chatCreatedAt) {
          items.push(
            <Box key={`date-separator-${date}`}>
              <MessageSeparator content={date} />
            </Box>,
          );
        }

        let hasShownUnreadMessages = false;

        bubbles.forEach((bubble, index, _bubbles) => {
          const prevBubble = index > 0 ? _bubbles[index - 1] : undefined;

          const showUnreadMessages = !!(
            isChatMessage(bubble) &&
            isChatAssignedToMe &&
            localLatestReadTimestamp &&
            new Date(bubble.createdAt) > localLatestReadTimestamp
          );

          if (showUnreadMessages && !hasShownUnreadMessages) {
            hasShownUnreadMessages = true;
            items.push(
              <Box key={`unread-separator-${bubble.id}`}>
                <MessageSeparator content={t_chat('activity.newMessages')} isLinear />
              </Box>,
            );
          }

          if (isChatMessage(bubble)) {
            items.push(renderMessageBubble(bubble, prevBubble));
          } else if (isChatActivity(bubble)) {
            items.push(renderActivityBubble(bubble));
          }
        });
      });

      return items;
    }, [
      infiniteQueryResponse.fetchedAll,
      groupedBubbles,
      targetChat,
      isChatAssignedToMe,
      localLatestReadTimestamp,
      t_chat,
      renderMessageBubble,
      renderActivityBubble,
    ]);

    if (isFetchingOne) return <Loading />;
    if (!targetChat) return <NoMessages />;

    return (
      <ListboxComponent ref={virtualizerRef} scrollDirection='top' isRefVirtualizer {...rest}>
        {chatItems}
      </ListboxComponent>
    );
  }),
);

ChatMessages.displayName = 'ChatMessages';
