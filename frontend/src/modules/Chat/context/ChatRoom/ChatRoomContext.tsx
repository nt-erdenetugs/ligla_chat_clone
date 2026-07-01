import { createContext, useContext } from 'react';

import { type InfiniteQueryResponse } from '~/context/InfiniteScrollContext';
import type { IChatActivity, IChatMessage, ITeamsInChat, IChat } from '~/modules/Chat';

export type ChatRoomContextProps = {
  targetChat: Nullish<IChat>;
  setTargetChat: React.Dispatch<React.SetStateAction<Nullish<IChat>>>;
  infiniteQueryResponse: InfiniteQueryResponse;
  chatCursorId?: Nullable<string>;
  chatCursorCreatedAt?: Nullable<Date>;

  chatMessages: IChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<IChatMessage[]>>;
  chatActivities: IChatActivity[];
  setChatActivities: React.Dispatch<React.SetStateAction<IChatActivity[]>>;

  teamsInChat: ITeamsInChat[];
  setTeamsInChat: React.Dispatch<React.SetStateAction<ITeamsInChat[]>>;
  deletedMessagesByChat: Record<string, Set<string>>;
  setDeletedMessagesByChat: React.Dispatch<React.SetStateAction<Record<string, Set<string>>>>;

  prevTargetChat: Nullish<IChat>;
  setPrevTargetChat: React.Dispatch<React.SetStateAction<Nullish<IChat>>>;

  isFetchingOne: boolean;
  setIsFetchingOne: React.Dispatch<React.SetStateAction<boolean>>;
  isChatAssignedToMe: boolean;
  isChatUnassigned: boolean;
  isChatFileUploadEnabled: boolean;
  isFileUploadConfigured: boolean;
  isChatFileDownloadEnabled: boolean;
  isChatFileDeleteEnabled: (params: { isOperatorUploadedFile: boolean }) => boolean;

  isMessageDeleted: (chatId: string, messageId: string) => boolean;
  getChatDataFunction: (params: Record<string, unknown>) => void;
};

const defaultValue: ChatRoomContextProps = {
  targetChat: null,
  setTargetChat: () => {},

  chatMessages: [],
  setChatMessages: () => {},
  chatActivities: [],
  setChatActivities: () => {},

  infiniteQueryResponse: {
    loading: false,
    fetchMore: async () => await new Promise((resolve) => resolve(undefined)),
    fetchedAll: false,
    error: undefined,
  },

  teamsInChat: [],
  setTeamsInChat: () => {},
  deletedMessagesByChat: {},
  setDeletedMessagesByChat: () => {},

  prevTargetChat: null,
  setPrevTargetChat: () => {},

  isFetchingOne: false,
  setIsFetchingOne: () => {},
  isChatAssignedToMe: false,
  isChatUnassigned: false,
  isChatFileUploadEnabled: false,
  isFileUploadConfigured: false,
  isChatFileDownloadEnabled: false,
  isChatFileDeleteEnabled: () => false,

  isMessageDeleted: () => false,
  getChatDataFunction: () => {},
};

export const ChatRoomContext = createContext<ChatRoomContextProps>(defaultValue);

export const useChatRoomContext = () => {
  const context = useContext(ChatRoomContext);
  if (!context) {
    throw new Error('useChatRoomContext must be used within a ChatRoomProvider');
  }
  return context;
};
