import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLocation } from 'react-router';
import { type VListHandle } from 'virtua';

import { useAuthContext } from '~/context/AuthContext';
import { SenderType } from '~/generated/graphql/types';
import { isChatMessage } from '~/utils';

import { useChatActions, useChatRoomContext } from '../context';

const THRESHOLD = 100;

export const useChatScroll = () => {
  const { targetChat, chatMessages, chatActivities, isChatAssignedToMe, isFetchingOne } =
    useChatRoomContext();
  const { updateChatLatestRead } = useChatActions();
  const { isMe } = useAuthContext();
  const { search } = useLocation();

  const [showScrollToBottomChip, setShowScrollToBottomChip] = useState(false);
  const [isNewBubbleAdded, setIsNewBubbleAdded] = useState(false);
  const [localTimestamp, setLocalTimestamp] = useState<Nullish<Date>>(null);
  const [localLatestReadTimestamp, setLocalLatestReadTimestamp] = useState<Nullish<Date>>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);

  const virtualizerRef = useRef<Nullable<VListHandle>>(null);

  const lastItem = useMemo(() => {
    const [message, activity] = [chatMessages?.[0], chatActivities?.[0]];

    if (!message && !activity) return null;
    if (!message) return activity;
    if (!activity) return message;

    return new Date(message.createdAt).getTime() > new Date(activity.createdAt).getTime()
      ? message
      : activity;
  }, [chatMessages, chatActivities]);

  useEffect(() => {
    if (
      !targetChat ||
      isFetchingOne ||
      !isChatAssignedToMe ||
      !localTimestamp ||
      !localLatestReadTimestamp
    )
      return;

    const lastMessage = chatMessages?.[0];
    if (
      lastMessage &&
      isAtBottom &&
      localTimestamp !== localLatestReadTimestamp &&
      !isMe(lastMessage.senderId)
    ) {
      updateChatLatestRead(targetChat.id, localTimestamp);
      setLocalLatestReadTimestamp(localTimestamp);
    }
  }, [
    isAtBottom,
    chatMessages,
    isChatAssignedToMe,
    isFetchingOne,
    localTimestamp,
    localLatestReadTimestamp,
    targetChat,
    isMe,
    updateChatLatestRead,
  ]);

  useEffect(() => {
    if (!targetChat?.latestMessageTimestamp) return;
    const latestTimestamp = targetChat.latestMessageTimestamp;

    if (!localTimestamp) return setLocalTimestamp(latestTimestamp);

    if (new Date(localTimestamp).getTime() === new Date(latestTimestamp).getTime()) return;

    setIsNewBubbleAdded(true);
    setLocalTimestamp(latestTimestamp);
  }, [localTimestamp, targetChat]);

  useEffect(() => {
    if (!isAtBottom) return;

    setShowScrollToBottomChip(false);
  }, [isAtBottom]);

  useEffect(() => {
    if (!isNewBubbleAdded) return;
    setIsNewBubbleAdded(false);

    if (isAtBottom) {
      return scrollToBottom();
    }

    if (
      isChatMessage(lastItem) &&
      lastItem.senderType === SenderType.Operator &&
      isMe(lastItem.senderId)
    ) {
      return scrollToBottom();
    }

    setShowScrollToBottomChip(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNewBubbleAdded]);

  useEffect(() => {
    setIsAtBottom(true);
    setShowScrollToBottomChip(false);
    setLocalLatestReadTimestamp(null);
    setShouldScrollToBottom(true);
  }, [search]);

  const onScroll = useCallback(() => {
    const { scrollSize = 0, scrollOffset = 0, viewportSize = 0 } = virtualizerRef?.current || {};

    const scrolledDistance = scrollOffset + viewportSize;
    const bottomBoundaryEdge = scrollSize - THRESHOLD;

    setIsAtBottom(scrolledDistance >= bottomBoundaryEdge);
  }, []);

  const scrollToBottom = () => {
    setShouldScrollToBottom(true);
    setIsAtBottom(true);
    setShowScrollToBottomChip(false);
    setIsNewBubbleAdded(false);
  };

  return {
    shouldScrollToBottom,
    setShouldScrollToBottom,
    virtualizerRef,
    showScrollToBottomChip,
    scrollToBottom,
    onScroll,
  };
};
