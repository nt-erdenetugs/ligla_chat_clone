import { useCallback, useEffect, useMemo, useState } from 'react';

import { enqueueSnackbar } from 'notistack';

import { adminRoles, CHAT_ROOM_ITEMS_PER_PAGE, managerRoles } from '~/common/constants';
import { QUERY_RESPONSE_KEYS, useInfiniteQuery, useResponsive } from '~/common/hooks';
import { useAuthContext } from '~/context/AuthContext';
import { type InfiniteQueryResponse } from '~/context/InfiniteScrollContext';
import {
  ChatDataDocument,
  type ChatDataQuery,
  ChatItemType,
  CursorDirection,
  type QueryChatDataArgs,
  UserRoleType,
} from '~/generated/graphql/types';
import { compareObjectsByDate, isValidDateValue } from '~/utils';

import { type IChat, type IChatActivity, type IChatMessage, type ITeamsInChat } from '../../types';

import { ChatRoomContext, type ChatRoomContextProps } from './ChatRoomContext';

type ChatRoomProviderProps = {
  children: React.ReactNode;
};

export const ChatRoomProvider: React.FC<ChatRoomProviderProps> = ({ children }) => {
  const [targetChat, setTargetChat] = useState<Nullish<IChat>>(null);
  const [prevTargetChat, setPrevTargetChat] = useState<Nullish<IChat>>(null);
  const [chatMessages, setChatMessages] = useState<IChatMessage[]>([]);
  const [chatActivities, setChatActivities] = useState<IChatActivity[]>([]);
  const [isFetchingOne, setIsFetchingOne] = useState<boolean>(true);
  const [teamsInChat, setTeamsInChat] = useState<ITeamsInChat[]>([]);
  const [deletedMessagesByChat, setDeletedMessagesByChat] = useState<Record<string, Set<string>>>(
    {},
  );

  const { isMe, user, isOperatorUser } = useAuthContext();
  const { isMobileOrTablet } = useResponsive();

  const {
    data: chatData,
    getData: _getChatData,
    loading,
    fetchedAll,
    loadMore,
    error,
    cursorId,
    cursorCreatedAt,
  } = useInfiniteQuery<typeof QUERY_RESPONSE_KEYS.chatData, ChatDataQuery>(
    ChatDataDocument,
    QUERY_RESPONSE_KEYS.chatData,
    {
      skipInitialFetch: true,
      itemsPerPage: CHAT_ROOM_ITEMS_PER_PAGE,
      debounceDelay: 500,
      eventCallbacks: {
        onError: (error) => {
          enqueueSnackbar(error.message, { variant: 'error' });
          setIsFetchingOne(false);
        },
      },
    },
  );

  const {
    data: syncedItems,
    getData: syncItems,
    fetchedAll: syncFinished,
    loadMore: loadMoreSyncItems,
  } = useInfiniteQuery<typeof QUERY_RESPONSE_KEYS.chatData, ChatDataQuery>(
    ChatDataDocument,
    QUERY_RESPONSE_KEYS.chatData,
    { skipInitialFetch: true },
  );

  const isMessageDeleted = useCallback(
    (chatId: string, messageId: string) => {
      return !!deletedMessagesByChat[chatId]?.has(messageId);
    },
    [deletedMessagesByChat],
  );

  const infiniteQueryResponse = useMemo<InfiniteQueryResponse>(
    () => ({
      loading,
      fetchMore: loadMore,
      fetchedAll,
      error,
      cursorId,
      cursorCreatedAt,
    }),
    [loading, loadMore, fetchedAll, error, cursorId, cursorCreatedAt],
  );

  const createChatItems = useCallback(
    (data: NonNullable<typeof chatData>) => {
      const currentChatId = targetChat?.id || '';
      if (!currentChatId) {
        setChatMessages([]);
        setChatActivities([]);
        return;
      }

      const chatMessages: IChatMessage[] = [];
      const chatActivities: IChatActivity[] = [];

      data.forEach((item) => {
        if (item.itemType === ChatItemType.Message) {
          if (!item.message) return;
          const messageId = item.message.id;

          if (
            !isMessageDeleted(currentChatId, messageId) &&
            item.message.chatId === currentChatId
          ) {
            chatMessages.push(item.message);
          }
        } else {
          if (!item.activity || item.activity.chatId !== currentChatId) return;
          chatActivities.push(item.activity);
        }
      });

      setChatMessages((prevChatMessages) => {
        const filteredPrevMessages = prevChatMessages.filter(
          (msg) => !isMessageDeleted(currentChatId, msg.id) && msg.chatId === currentChatId,
        );

        const uniqueMessages = Array.from(
          new Set([...filteredPrevMessages, ...chatMessages].map((msg) => msg.id)),
        ).map((id) => [...chatMessages, ...filteredPrevMessages].find((msg) => msg.id === id)!);

        const MAX_SAFE_LENGTH = Number.MAX_SAFE_INTEGER - 1;
        if (uniqueMessages.length > MAX_SAFE_LENGTH) {
          return uniqueMessages.slice(-MAX_SAFE_LENGTH);
        }

        return uniqueMessages;
      });

      setChatActivities((prevActivities) => {
        const filteredPrevActivities = prevActivities.filter(
          (activity) => activity.chatId === currentChatId,
        );

        const uniqueActivities = Array.from(
          new Set([...filteredPrevActivities, ...chatActivities].map((activity) => activity.id)),
        ).map(
          (id) =>
            [...chatActivities, ...filteredPrevActivities].find((activity) => activity.id === id)!,
        );

        const MAX_SAFE_LENGTH = Number.MAX_SAFE_INTEGER - 1;
        if (uniqueActivities.length > MAX_SAFE_LENGTH) {
          return uniqueActivities.slice(-MAX_SAFE_LENGTH);
        }

        return uniqueActivities;
      });
    },
    [isMessageDeleted, targetChat?.id],
  );

  useEffect(() => {
    if (!chatData) return;
    try {
      createChatItems(chatData);
    } catch (error) {
      console.error('Error in chat message processing:', error);
      return;
    } finally {
      setIsFetchingOne(false);
    }
  }, [chatData, createChatItems]);

  const isChatAssignedToMe = useMemo(() => {
    if (!targetChat || !targetChat.assignedUserId) return false;
    return isMe(targetChat.assignedUserId);
  }, [targetChat, isMe]);

  const isChatUnassigned = useMemo(() => {
    if (!targetChat) return false;
    return targetChat.assignedUserId === null;
  }, [targetChat]);

  const assignedId = useMemo(() => {
    return targetChat?.assignedUser?.id ?? targetChat?.assignedUserId ?? null;
  }, [targetChat]);

  const isAssignedOperator = useMemo(() => {
    if (!user || !assignedId) return false;
    return isOperatorUser && user.id === assignedId;
  }, [user, isOperatorUser, assignedId]);

  const isManagerOfTeamChat = useMemo(() => {
    if (!user?.roleType) return false;
    const isManager = managerRoles.includes(user.roleType);
    if (!isManager || !user?.teams || !targetChat?.chatTeamAssignment) return false;
    const managerTeamIds = user.teams.map((team) => team.id);
    return targetChat.chatTeamAssignment.some((assignment) =>
      managerTeamIds.includes(assignment.teamId),
    );
  }, [user?.teams, targetChat?.chatTeamAssignment, user?.roleType]);
  const isAdmin = adminRoles.includes(user?.roleType ?? '');

  const isFileUploadConfigured = Boolean(user?.organization?.fileUploadLiffId);
  const isChatHasAssignee = assignedId != null;
  const isAdminOperator = user?.roleType === UserRoleType.AdminOperator;
  const hasElevatedUploadAccess = isAdminOperator && isChatHasAssignee;
  const isChatFileUploadEnabled =
    (isAssignedOperator || hasElevatedUploadAccess) && isFileUploadConfigured;
  const isChatFileDownloadEnabled = useMemo(() => {
    return isAssignedOperator || isManagerOfTeamChat || isAdmin;
  }, [isAssignedOperator, isManagerOfTeamChat, isAdmin]);

  const isChatFileDeleteEnabled = useCallback(
    ({ isOperatorUploadedFile }: { isOperatorUploadedFile: boolean }) =>
      (isAssignedOperator && isOperatorUploadedFile) || isManagerOfTeamChat || isAdmin,
    [isAssignedOperator, isManagerOfTeamChat, isAdmin],
  );

  useEffect(() => {
    if (!isMobileOrTablet || !targetChat) return;

    if (chatMessages.length === 0 && chatActivities.length === 0) return;

    const latestItem = compareObjectsByDate(chatMessages[0], chatActivities[0]);

    if (!latestItem) return;

    const chatSyncInput: QueryChatDataArgs = {
      chatId: targetChat.id,
      cursorCreatedAt: latestItem.createdAt,
      cursorId: latestItem.id,
      cursorDirection: CursorDirection.Forward,
    };

    const syncChatOnFocus = () => {
      if (document.hidden) return;
      syncItems(chatSyncInput);
    };
    document.addEventListener('visibilitychange', syncChatOnFocus);

    return () => {
      document.removeEventListener('visibilitychange', syncChatOnFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncItems, isMobileOrTablet]);

  useEffect(() => {
    if (!syncedItems || syncedItems.length === 0 || !targetChat) return;

    createChatItems(syncedItems);
    if (!isValidDateValue(syncedItems[0].message?.createdAt) || !syncedItems[0].message) return;

    const latestMessageTimestamp = new Date(syncedItems[0].message.createdAt);
    setTargetChat((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        latestMessageTimestamp,
      };
    });

    if (!syncFinished) {
      loadMoreSyncItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createChatItems, syncedItems]);

  const value = useMemo<ChatRoomContextProps>(
    () => ({
      targetChat,
      infiniteQueryResponse,
      chatMessages,
      chatActivities,
      teamsInChat,
      prevTargetChat,
      isFetchingOne,
      isChatAssignedToMe,
      isChatUnassigned,
      isChatFileUploadEnabled,
      isFileUploadConfigured,
      isChatFileDownloadEnabled,
      isChatFileDeleteEnabled,
      deletedMessagesByChat,
      setTargetChat,
      setPrevTargetChat,
      setChatMessages,
      setChatActivities,
      setTeamsInChat,
      setIsFetchingOne,
      setDeletedMessagesByChat,
      isMessageDeleted,
      getChatDataFunction: _getChatData,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      targetChat,
      infiniteQueryResponse,
      chatMessages,
      chatActivities,
      teamsInChat,
      prevTargetChat,
      deletedMessagesByChat,
      isFetchingOne,
      isChatAssignedToMe,
      isChatUnassigned,
      isChatFileUploadEnabled,
      isFileUploadConfigured,
      isChatFileDownloadEnabled,
      isChatFileDeleteEnabled,
    ],
  );

  return <ChatRoomContext.Provider value={value}>{children}</ChatRoomContext.Provider>;
};
