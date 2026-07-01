import { createContext, useContext } from 'react';

import { type ApolloQueryResult, type OperationVariables } from '@apollo/client';

import { type InfiniteQueryResponse } from '~/context/InfiniteScrollContext';
import { type UnassignedChatCountQuery } from '~/generated/graphql/types';

import {
  defaultFilters,
  type FilterCategoriesType,
  type FilterItem,
  type UseChatFiltersType,
} from '../../hooks/useChatFilters';
import { type ChatFiltersType, type IChat } from '../../types';

export type ChatListContextProps = {
  chats: Nullish<IChat[]>;
  setChats: React.Dispatch<React.SetStateAction<Nullish<IChat[]>>>;
  refetchChats: () => void;
  infiniteQueryResponse?: InfiniteQueryResponse;
  isFetchingAll: boolean;
  setIsFetchingAll: React.Dispatch<React.SetStateAction<boolean>>;
  chatsCount: number;
  setChatsCount: React.Dispatch<React.SetStateAction<number>>;
  setFirstChat: (id: string) => void;
  unassignedChatsCount: number;
  refetchUnassignedChatCount: (
    variables?: Partial<OperationVariables>,
  ) => Promise<ApolloQueryResult<UnassignedChatCountQuery> | undefined>;
} & UseChatFiltersType;

const defaultValue: ChatListContextProps = {
  chats: null,
  setChats: () => {},
  refetchChats: () => {},
  infiniteQueryResponse: undefined,
  isFetchingAll: false,
  setIsFetchingAll: () => {},
  chatsCount: 0,
  setChatsCount: () => {},
  unassignedChatsCount: 0,
  setFirstChat: () => {},
  refetchUnassignedChatCount: async () => await new Promise((resolve) => resolve(undefined)),
  filters: defaultFilters,
  applyFilters: () => {},
  initializeFilters: () => {},
  isFiltersApplied: false,
  isFetchingAllOptions: false,
  clearFilters: () => {},
  filterCategories: {} as FilterCategoriesType,
  filtersOptions: {} as Record<ChatFiltersType, FilterItem[]>,
  setFilters: () => {},
};

export const ChatListContext = createContext<ChatListContextProps>(defaultValue);

export const useChatListContext = () => {
  const context = useContext(ChatListContext);
  if (!context) {
    throw new Error('useChatListContext must be used within a ChatListProvider');
  }
  return context;
};
