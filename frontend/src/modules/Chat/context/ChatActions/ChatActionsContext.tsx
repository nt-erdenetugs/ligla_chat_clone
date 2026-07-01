import { createContext, useContext } from 'react';

import { type LazyQueryExecFunction, type OperationVariables } from '@apollo/client';

import { type ChatStatus, type TeamsInChatQuery } from '~/generated/graphql/types';
import {
  type IChat,
  type IChatMessage,
  type IChatMessageUpdatePayload,
  type ID,
} from '~/modules/Chat/';

interface ChatActionsContextType {
  message: string;
  isMessageSending: boolean;
  isSendingUploadLink: boolean;
  isRetryingMessage: boolean;
  isChangingChatStatus: boolean;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  getTeamsInChat: LazyQueryExecFunction<TeamsInChatQuery, OperationVariables> | undefined;
  handleChatUpdate: (chatPayload: IChat) => void;
  handleChatMessageUpdate: (chatMessageUpdatePayload: IChatMessageUpdatePayload) => void;
  getChat: (id: string) => Promise<void>;
  setTargetChatId: (id: ID) => Promise<void>;
  handleChatMessageDelete: (chatId: ID, messageId: ID) => Promise<void>;
  clearTargetChat: () => void;
  confirmDiscardMessage: () => Promise<boolean>;
  sendMessage: (chatId: string, text: string) => Promise<IChatMessage | undefined>;
  sendUploadLink: (input: { chatId: string }) => Promise<IChatMessage | undefined>;
  sendFileUploadedMessage: (input: {
    chatId: string;
    fileName: string;
    altText?: string;
  }) => Promise<IChatMessage | undefined>;
  sendMessageToLigla: (chatId: string, messageId: string) => Promise<IChatMessage | undefined>;
  refetchTargetChat: () => Promise<void>;
  retryMessage: (chatId: string, messageId: string) => Promise<IChatMessage | undefined>;
  assignOperator: (chatId: string, assignedUserId: string) => Promise<boolean>;
  assignTeam: (chatId: string, teamId: string) => Promise<boolean>;
  unassignTeam: (chatId: string, teamId: string) => Promise<boolean>;
  changeChatStatus: (chatId: string, status: ChatStatus, onSuccess?: () => void) => Promise<void>;
  removeChatTag: (chatId: string, tagId: string) => Promise<void>;
  updateChatTags: (chatId: string, tagIds: string[]) => Promise<void>;
  updateChatLatestRead: (chatId: string, timestamp: Date) => Promise<void>;
}

const defaultValue: ChatActionsContextType = {
  message: '',
  isMessageSending: false,
  isSendingUploadLink: false,
  isRetryingMessage: false,
  isChangingChatStatus: false,
  setMessage: () => {},
  getTeamsInChat: undefined,
  handleChatUpdate: () => {},
  handleChatMessageUpdate: () => {},
  getChat: async () => {},
  setTargetChatId: async () => await new Promise((resolve) => resolve(undefined)),
  handleChatMessageDelete: async () => await new Promise((resolve) => resolve(undefined)),
  clearTargetChat: () => {},
  confirmDiscardMessage: async () => await new Promise((resolve) => resolve(false)),
  sendMessage: async () => await new Promise((resolve) => resolve(undefined)),
  sendUploadLink: async () => await new Promise((resolve) => resolve(undefined)),
  sendFileUploadedMessage: async () => await new Promise((resolve) => resolve(undefined)),
  sendMessageToLigla: async () => await new Promise((resolve) => resolve(undefined)),
  refetchTargetChat: async () => await new Promise((resolve) => resolve(undefined)),
  retryMessage: async () => await new Promise((resolve) => resolve(undefined)),
  assignOperator: async () => await new Promise((resolve) => resolve(false)),
  assignTeam: async () => await new Promise((resolve) => resolve(false)),
  unassignTeam: async () => await new Promise((resolve) => resolve(false)),
  changeChatStatus: async () => await new Promise((resolve) => resolve(undefined)),
  removeChatTag: async () => await new Promise((resolve) => resolve(undefined)),
  updateChatTags: async () => await new Promise((resolve) => resolve(undefined)),
  updateChatLatestRead: async () => await new Promise((resolve) => resolve(undefined)),
};

export const ChatActionsContext = createContext<ChatActionsContextType>(defaultValue);

export const useChatActions = () => {
  const context = useContext(ChatActionsContext);
  if (context === undefined) {
    throw new Error('useChatActionsContext must be used within a ChatActionsProvider');
  }
  return context;
};
