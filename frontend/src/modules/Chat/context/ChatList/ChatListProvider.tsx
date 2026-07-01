import { useMemo, useState, useEffect, useCallback } from 'react';

import { useQuery } from '@apollo/client';
import { useSearchParams } from 'react-router';

import { ID_PARAM_KEY } from '~/common/constants';
import { QUERY_RESPONSE_KEYS, useInfiniteQuery } from '~/common/hooks';
import { type InfiniteQueryResponse } from '~/context/InfiniteScrollContext';
import {
  ChatCountDocument,
  type ChatCountQuery,
  type ChatFilterInput,
  ChatsDocument,
  UnassignedChatCountDocument,
  type UnassignedChatCountQuery,
} from '~/generated/graphql/types';

import { useChatFilters } from '../../hooks';
import { type IChat } from '../../types';
import { useChatRoomContext } from '../ChatRoom';

import { ChatListContext, type ChatListContextProps } from './ChatListContext';

type ChatListProviderProps = {
  children: React.ReactNode;
};

export const sortChatsByLastMessage = (chats?: IChat[] | null): IChat[] => {
  if (!chats) return [];

  if (chats.length <= 1) return chats;

  const getLatestTime = (chat: IChat) =>
    new Date(chat.latestMessageTimestamp || chat.createdAt).getTime();

  return [...chats].sort((a, b) => getLatestTime(b) - getLatestTime(a));
};

export const ChatListProvider: React.FC<ChatListProviderProps> = ({ children }) => {
  const [chats, setChats] = useState<Nullish<IChat[]>>(null);
  const [isFetchingAll, setIsFetchingAll] = useState(false);
  const [chatsCount, setChatsCount] = useState(0);
  const [unassignedChatsCount, setUnassignedChatsCount] = useState(0);
  const { setIsFetchingOne, setChatMessages, setChatActivities } = useChatRoomContext();

  const [searchParams, setSearchParams] = useSearchParams();

  const setFirstChat = useCallback(
    (id: string) => {
      if (searchParams.get(ID_PARAM_KEY) === id) return;
      searchParams.set(ID_PARAM_KEY, id);
      setIsFetchingOne(true);
      setChatMessages([]);
      setChatActivities([]);
      setSearchParams(searchParams);
    },
    [setSearchParams, searchParams, setIsFetchingOne, setChatMessages, setChatActivities],
  );

  const {
    data: chatsData,
    getData: _getChats,
    loading,
    loadMore,
    refetch: refetchChats,
    fetchedAll,
    error,
  } = useInfiniteQuery<typeof QUERY_RESPONSE_KEYS.chats, IChat>(
    ChatsDocument,
    QUERY_RESPONSE_KEYS.chats,
    { skipInitialFetch: true },
  );

  const getChats = useCallback(
    (filter: ChatFilterInput) => {
      setIsFetchingAll(true);
      _getChats({
        filter,
      });
    },
    [_getChats],
  );

  const filters = useChatFilters(getChats);

  const infiniteQueryResponse = useMemo<InfiniteQueryResponse>(
    () => ({
      data: chatsData,
      loading,
      fetchMore: loadMore,
      fetchedAll,
      error,
    }),
    [chatsData, loading, fetchedAll, error, loadMore],
  );

  const { data: chatCountData } = useQuery<ChatCountQuery>(ChatCountDocument, {});

  useEffect(() => {
    if (!chatCountData) return;
    setChatsCount(chatCountData.chatCount);
  }, [chatCountData]);

  const { data: unassignedChatCountData, refetch: refetchUnassignedChatCount } =
    useQuery<UnassignedChatCountQuery>(UnassignedChatCountDocument);

  useEffect(() => {
    if (!chatsData) return;

    const sortedChats = sortChatsByLastMessage(chatsData);
    const firstChat = sortedChats?.[0];

    if (!firstChat) setIsFetchingOne(false);
    if (!searchParams.has(ID_PARAM_KEY) && firstChat) setFirstChat(firstChat.id);

    setChats(sortedChats);
    setIsFetchingAll(false);
  }, [chatsData]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!unassignedChatCountData) return;
    setUnassignedChatsCount(unassignedChatCountData.unassignedChatCount);
  }, [unassignedChatCountData]);

  const value = useMemo<ChatListContextProps>(
    () => ({
      chats,
      infiniteQueryResponse,
      isFetchingAll,
      setIsFetchingAll,
      chatsCount,
      unassignedChatsCount,
      ...filters,
      setChats,
      refetchChats,
      setChatsCount,
      setUnassignedChatsCount,
      refetchUnassignedChatCount,
      setFirstChat,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chats, isFetchingAll, chatsCount, unassignedChatsCount, filters],
  );

  return <ChatListContext.Provider value={value}>{children}</ChatListContext.Provider>;
};
