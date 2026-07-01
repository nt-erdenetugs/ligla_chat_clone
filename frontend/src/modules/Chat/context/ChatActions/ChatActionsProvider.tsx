import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLazyQuery, useMutation } from '@apollo/client';
import { useSnackbar } from 'notistack';
import { useSearchParams } from 'react-router';

import { useConfirmation } from '~/common/components';
import { getChatStatusLabel, ID_PARAM_KEY, DISPLAY_NAME_MAX_CHAR_LIMIT } from '~/common/constants';
import { NotificationClickEventType, type SWMessageEvent } from '~/common/types';
import { useAuthContext } from '~/context/AuthContext';
import {
  AssignOperatorToChatDocument,
  type AssignOperatorToChatMutation,
  AssignTeamToChatDocument,
  type AssignTeamToChatMutation,
  ChangeChatStatusDocument,
  type ChangeChatStatusMutation,
  ChatHistoryDocument,
  type ChatHistoryQuery,
  type ShareUploadLinkInput,
  type SendFileUploadedMessageInput,
  ChatMessageType,
  ChatStatus,
  DeleteChatMessageDocument,
  type DeleteChatMessageMutation,
  type DeleteChatMessageMutationVariables,
  RemoveChatTagDocument,
  type RemoveChatTagMutation,
  RemoveTeamFromChatDocument,
  type RemoveTeamFromChatMutation,
  RetrySendMessageDocument,
  type RetrySendMessageMutation,
  SendMessageDocument,
  type SendMessageMutation,
  SendUploadLinkDocument,
  type SendUploadLinkMutation,
  SendFileUploadedMessageDocument,
  type SendFileUploadedMessageMutation,
  SendMessageToLiglaDocument,
  type SendMessageToLiglaMutation,
  TeamsInChatDocument,
  type TeamsInChatQuery,
  UpdateChatLatestReadDocument,
  type UpdateChatLatestReadMutation,
  UpdateChatTagsDocument,
  type UpdateChatTagsMutation,
} from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import {
  type IChatActivity,
  type IChat,
  type IChatMessage,
  type IChatMessageUpdatePayload,
  type ID,
} from '~/modules/Chat';
import { isTruthy } from '~/utils';

import {
  ChatActionsContext,
  sortChatsByLastMessage,
  useChatListContext,
  useChatRoomContext,
  useChatUpdates,
} from '..';

type ChatActionsContextType = {
  children?: React.ReactNode;
};

export const ChatActionsProvider = ({ children }: ChatActionsContextType) => {
  const [message, setMessage] = useState<string>('');

  const { isUserNameTooLong, user } = useAuthContext();

  const { chats, setChats, refetchChats, setFirstChat, refetchUnassignedChatCount, setChatsCount } =
    useChatListContext();
  const {
    targetChat,
    chatMessages,
    infiniteQueryResponse,
    setPrevTargetChat,
    setTeamsInChat,
    setIsFetchingOne,
    setChatMessages,
    setChatActivities,
    setTargetChat,
    isMessageDeleted,
    setDeletedMessagesByChat,
    getChatDataFunction,
  } = useChatRoomContext();

  const targetChatRef = useRef(targetChat);
  useEffect(() => {
    targetChatRef.current = targetChat;
  }, [targetChat]);

  const chatMessagesRef = useRef(chatMessages);
  useEffect(() => {
    chatMessagesRef.current = chatMessages;
  }, [chatMessages]);

  const { enqueueSnackbar } = useSnackbar();
  const { t_chat, t_toasts, t } = useTranslation();
  const { requestConfirmation } = useConfirmation();
  const [searchParams, setSearchParams] = useSearchParams();

  const { checkAndNotifyChatMessageUpdate, checkAndNotifyChatUpdate } = useChatUpdates();

  const id = useMemo(() => searchParams.get(ID_PARAM_KEY) ?? '', [searchParams]);

  const [getTeamsInChat] = useLazyQuery<TeamsInChatQuery>(TeamsInChatDocument, {
    fetchPolicy: 'no-cache',
  });

  const markMessageAsDeleted = useCallback(
    (chatId: string, messageId: string) => {
      setDeletedMessagesByChat((prev) => {
        const chatDeletedMessages = prev[chatId] || new Set();
        return {
          ...prev,
          [chatId]: new Set([...chatDeletedMessages, messageId]),
        };
      });
    },
    [setDeletedMessagesByChat],
  );

  const [_getChat, { refetch: _refetchTargetChat, error }] = useLazyQuery<ChatHistoryQuery>(
    ChatHistoryDocument,
    {
      fetchPolicy: 'network-only',
    },
  );

  const updateChatState = useCallback(
    (chatId: string, updater: (chat: IChat) => IChat) => {
      setChats((prevChats) =>
        sortChatsByLastMessage(
          prevChats?.map((chat) => (chat.id === chatId ? updater(chat) : chat)) ?? [],
        ),
      );

      setTargetChat((prevChat) =>
        prevChat && prevChat.id === chatId ? updater(prevChat) : prevChat,
      );
    },
    [setChats, setTargetChat],
  );

  useEffect(() => {
    if (error) {
      console.warn(error);
      enqueueSnackbar(error.message, { variant: 'error' });
      searchParams.delete(ID_PARAM_KEY);
      setSearchParams(searchParams);
      setIsFetchingOne(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const [_sendMessage, { loading: isMessageSending }] =
    useMutation<SendMessageMutation>(SendMessageDocument);

  const [_sendUploadLink, { loading: isSendingUploadLink }] = useMutation<SendUploadLinkMutation>(
    SendUploadLinkDocument,
    {
      onError(error) {
        enqueueSnackbar(error.message, { variant: 'error' });
      },
    },
  );

  const [_sendFileUploadedMessage] = useMutation<SendFileUploadedMessageMutation>(
    SendFileUploadedMessageDocument,
    {
      onError(error) {
        enqueueSnackbar(error.message, { variant: 'error' });
      },
    },
  );

  const [_retryMessage, { loading: isRetryingMessage }] = useMutation<RetrySendMessageMutation>(
    RetrySendMessageDocument,
    {
      onError(error) {
        enqueueSnackbar(error.message, { variant: 'error' });
      },
    },
  );

  const [_sendMessageToLigla] = useMutation<SendMessageToLiglaMutation>(
    SendMessageToLiglaDocument,
    {
      onError(error) {
        enqueueSnackbar(error.message, { variant: 'error' });
      },
    },
  );

  const [_deleteChatMessage] = useMutation<DeleteChatMessageMutation>(DeleteChatMessageDocument, {
    onCompleted({ deleteChatMessage }, options) {
      if (!deleteChatMessage) return;

      const { deleteMessageInput } = options?.variables as DeleteChatMessageMutationVariables;

      if (!deleteMessageInput) return;

      const { chatId, messageId } = deleteMessageInput;

      markMessageAsDeleted(chatId, messageId);

      if (targetChat?.id !== chatId) return;

      const newChatMessages = chatMessages.filter((msg) => msg.id !== messageId);
      const nextLastMessage = newChatMessages[0] ?? null;

      setChatMessages(newChatMessages);

      const replaceChatMessage = (chat: IChat): IChat => ({
        ...chat,
        chatMessages: [nextLastMessage],
      });

      setChats((prevChats) =>
        sortChatsByLastMessage(
          prevChats
            ? prevChats.map((chat) => (chat.id === chatId ? replaceChatMessage(chat) : chat))
            : null,
        ),
      );

      enqueueSnackbar(t_toasts('chat.success.message.delete'), { variant: 'success' });
    },
    onError(_error, options) {
      enqueueSnackbar(t_toasts('chat.error.message.delete'), { variant: 'error' });

      const { deleteMessageInput } = options?.variables as DeleteChatMessageMutationVariables;

      if (!deleteMessageInput) return;

      const { chatId, messageId } = deleteMessageInput;

      handleChatMessageUpdate({
        chatId,
        messageId,
        isDeleting: false,
      });
    },
  });

  const [_changeChatStatus, { loading: isChangingChatStatus }] =
    useMutation<ChangeChatStatusMutation>(ChangeChatStatusDocument, {
      onCompleted(data) {
        if (!data || !targetChat || data.changeChatStatus?.chatId !== targetChat.id) return;

        setChatActivities((prevChatActivities) => [...prevChatActivities, data.changeChatStatus]);

        refetchTargetChat();
        refetchChats();

        enqueueSnackbar(
          t_toasts('chat.success.status.changed', {
            status: t_chat(`status.${getChatStatusLabel(data.changeChatStatus.newStatus!)}`),
          }),
          {
            variant: 'success',
          },
        );
      },
      onError(error) {
        enqueueSnackbar(error.message, { variant: 'error' });
      },
    });

  const [_removeChatTag] = useMutation<RemoveChatTagMutation>(RemoveChatTagDocument, {
    refetchQueries: [],
    onCompleted(data) {
      if (!data) return;
      setTargetChat(data.removeChatTag as IChat);
    },
    onError(error) {
      enqueueSnackbar(error.message, { variant: 'error' });
      throw error;
    },
  });

  const [_updateChatTags] = useMutation<UpdateChatTagsMutation>(UpdateChatTagsDocument, {
    refetchQueries: [],
    onCompleted(data) {
      if (!data) return;
      setTargetChat(data.updateChatTags as IChat);
    },
    onError(error) {
      enqueueSnackbar(error.message, { variant: 'error' });
      throw error;
    },
  });

  const [_updateChatLatestRead] = useMutation<UpdateChatLatestReadMutation>(
    UpdateChatLatestReadDocument,
    {
      onError(error) {
        enqueueSnackbar(error.message, { variant: 'error' });
        throw error;
      },
    },
  );

  const [_assignOperator] = useMutation<AssignOperatorToChatMutation>(
    AssignOperatorToChatDocument,
    {
      refetchQueries: ['teamsInChat'],
      onCompleted(data) {
        if (!data || !targetChat || data.assignOperatorToChat?.chatId !== targetChat.id) return;

        setChatActivities((prevChatActivities) => [
          ...prevChatActivities,
          data.assignOperatorToChat,
        ]);
        refetchChats();
        refetchTargetChat();
      },
      onError(error) {
        enqueueSnackbar(error.message, { variant: 'error' });
      },
    },
  );

  const [_assignTeamToChat] = useMutation<AssignTeamToChatMutation>(AssignTeamToChatDocument, {
    refetchQueries: ['teamsInChat'],
    onCompleted(data) {
      if (!data || !targetChat || data.assignTeamToChat?.chatId !== targetChat.id) return;

      setChatActivities((prevChatActivities) => [...prevChatActivities, data.assignTeamToChat]);
      refetchTargetChat();
    },
    onError(error) {
      enqueueSnackbar(error.message, { variant: 'error' });
    },
  });

  const [_unassignTeamFromChat] = useMutation<RemoveTeamFromChatMutation>(
    RemoveTeamFromChatDocument,
    {
      refetchQueries: ['teamsInChat'],
      onCompleted(data) {
        if (!data || !targetChat || data.removeTeamFromChat?.chatId !== targetChat.id) return;

        setChatActivities((prevChatActivities) => [...prevChatActivities, data.removeTeamFromChat]);
        refetchTargetChat();
      },
      onError(error) {
        enqueueSnackbar(error.message, { variant: 'error' });
      },
    },
  );

  const sendMessage = useCallback(
    async (chatId: string, text: string) => {
      const { data, errors } = await _sendMessage({
        variables: {
          chatMessageInput: {
            chatId,
            message: {
              text,
              type: ChatMessageType.Text,
            },
          },
        },
      });

      if (errors) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw errors;
      }

      return data?.sendMessage;
    },
    [_sendMessage],
  );

  const sendUploadLink = useCallback(
    async (input: ShareUploadLinkInput) => {
      const { data, errors } = await _sendUploadLink({
        variables: {
          input,
        },
      });

      if (errors) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw errors;
      }

      return data?.sendUploadLink;
    },
    [_sendUploadLink],
  );

  const sendFileUploadedMessage = useCallback(
    async (input: SendFileUploadedMessageInput) => {
      const { data, errors } = await _sendFileUploadedMessage({
        variables: {
          input,
        },
      });

      if (errors) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw errors;
      }

      return data?.sendFileUploadedMessage;
    },
    [_sendFileUploadedMessage],
  );

  const updateChatMessages = (
    chatMessages: IChatMessage[],
    chatMessageUpdatePayload: IChatMessageUpdatePayload,
  ): IChatMessage[] => {
    const { messageId, ...messageUpdates } = chatMessageUpdatePayload;
    let isMessageUpdated = false;
    const updatedMessages = chatMessages.map((msg) => {
      if (msg.id !== messageId) {
        return msg;
      }
      isMessageUpdated = true;
      return {
        ...msg,
        isDelivering: false,
        isRetrying: false,
        isDeleting: false,
        ...messageUpdates,
      };
    });

    if (isMessageUpdated) {
      return updatedMessages;
    }
    return chatMessages;
  };

  const handleChatMessageUpdate = useCallback(
    (chatMessageUpdatePayload: IChatMessageUpdatePayload) => {
      const { chatId, messageId, ...messageUpdates } = chatMessageUpdatePayload;

      setChats((prevChats) =>
        sortChatsByLastMessage(
          prevChats?.map((chat) => {
            if (chat.id !== chatId) {
              return chat;
            }
            return {
              ...chat,
              chatMessages: chat.chatMessages
                ? updateChatMessages(chat.chatMessages, chatMessageUpdatePayload)
                : chat.chatMessages,
            };
          }),
        ),
      );

      if (targetChatRef.current?.id === chatId) {
        const currentMessages = chatMessagesRef.current;
        const oldMessage = currentMessages.find((msg) => msg.id === messageId);

        if (oldMessage) {
          const nextMessage = {
            ...oldMessage,
            isDelivering: false,
            isRetrying: false,
            isDeleting: false,
            ...messageUpdates,
          };
          checkAndNotifyChatMessageUpdate(nextMessage, currentMessages);
        }

        setChatMessages((prevChatMessages) => {
          if (!prevChatMessages) return [];
          return updateChatMessages(prevChatMessages, chatMessageUpdatePayload);
        });
      }
    },
    [checkAndNotifyChatMessageUpdate, setChatMessages, setChats],
  );

  const sendMessageToLigla = useCallback(
    async (chatId: string, messageId: string) => {
      if (isUserNameTooLong) {
        enqueueSnackbar(
          t_toasts('user.warning.nameTooLongToSendMessage', { limit: DISPLAY_NAME_MAX_CHAR_LIMIT }),
          { variant: 'warning', autoHideDuration: 5000, preventDuplicate: true },
        );
      }

      try {
        const response = (await _sendMessageToLigla({
          variables: {
            chatId,
            messageId,
            cursorId: infiniteQueryResponse.cursorId,
            cursorCreatedAt: infiniteQueryResponse.cursorCreatedAt,
          },
        })) as { data?: { sendMessageToLigla?: IChatMessage } };

        const updatedMessage = response.data?.sendMessageToLigla;

        if (updatedMessage) {
          handleChatMessageUpdate({
            chatId: updatedMessage.chatId ?? chatId,
            messageId: updatedMessage.id ?? messageId,
            isDelivered: Boolean(updatedMessage.isDelivered),
          });
        } else {
          console.warn(
            `[ChatActionsProvider] sendMessageToLigla: mutation succeeded but no message data returned for chatId=${chatId}, messageId=${messageId}`,
          );
        }

        return updatedMessage;
      } catch (error) {
        handleChatMessageUpdate({
          chatId,
          messageId,
          isDelivered: false,
        });
        throw error;
      }
    },
    [
      _sendMessageToLigla,
      enqueueSnackbar,
      handleChatMessageUpdate,
      infiniteQueryResponse.cursorCreatedAt,
      infiniteQueryResponse.cursorId,
      t_toasts,
      isUserNameTooLong,
    ],
  );

  const retryMessage = useCallback(
    async (chatId: string, messageId: string) => {
      const { data } = await _retryMessage({
        variables: {
          retryMessageInput: {
            chatId,
            messageId,
          },
        },
      });

      return data?.retrySendMessage;
    },
    [_retryMessage],
  );

  const assignOperator = useCallback(
    async (chatId: string, assignedUserId: string): Promise<boolean> => {
      const { data } = await _assignOperator({
        variables: {
          chatAssignInput: {
            chatId,
            assignedUserId,
          },
        },
      });
      const success = !!data?.assignOperatorToChat;

      if (success) {
        const isMe = user?.id === assignedUserId;

        updateChatState(chatId, (chat) => ({
          ...chat,
          assignedUserId,
          chatUnreadCount: isMe ? chat.chatUnreadCount : 0,
        }));
      }

      return success;
    },
    [_assignOperator, updateChatState, user?.id],
  );
  const assignTeam = useCallback(
    async (chatId: string, teamId: string): Promise<boolean> => {
      const { data } = await _assignTeamToChat({
        variables: {
          chatTeamAssignInput: {
            chatId,
            teamId,
          },
        },
      });
      return !!data?.assignTeamToChat;
    },

    [_assignTeamToChat],
  );

  const unassignTeam = useCallback(
    async (chatId: string, teamId: string): Promise<boolean> => {
      const { data } = await _unassignTeamFromChat({
        variables: {
          chatTeamAssignInput: {
            chatId,
            teamId,
          },
        },
      });

      return !!data?.removeTeamFromChat;
    },
    [_unassignTeamFromChat],
  );

  const removeChatTag = useCallback(
    async (chatId: string, tagId: string) => {
      await _removeChatTag({
        variables: {
          chatTagInput: {
            chatId,
            tagId,
          },
        },
      });
    },
    [_removeChatTag],
  );

  const updateChatTags = useCallback(
    async (chatId: string, tagIds: string[]) => {
      await _updateChatTags({
        variables: {
          updateChatTagsInput: {
            chatId,
            tagIds,
          },
        },
      });
    },
    [_updateChatTags],
  );

  const updateChatLatestRead = useCallback(
    async (chatId: string, timestamp: Date) => {
      const listChat = chats?.find((chat) => chat.id === chatId);
      const isAssignedToMe =
        listChat?.assignedUserId === user?.id ||
        (targetChat?.id === chatId && targetChat?.assignedUserId === user?.id);

      if (!isAssignedToMe) return;

      await _updateChatLatestRead({
        variables: {
          chatLatestReadInput: {
            chatId,
            timestamp,
          },
        },
      });
      updateChatState(chatId, (chat) => ({
        ...chat,
        latestReadTimestamp: timestamp,
        chatUnreadCount: 0,
      }));
    },

    [_updateChatLatestRead, chats, targetChat, updateChatState, user?.id],
  );

  const isMessageDirty = useMemo(() => {
    return message.trim().length > 0;
  }, [message]);

  const confirmDiscardMessage = useCallback(async () => {
    if (!isMessageDirty) return true;

    const isConfirmed = await requestConfirmation({
      title: t('confirmation'),
      message: t('info.sureToDiscardMsg'),
      confirmText: t('actions.confirm'),
      cancelText: t('actions.cancel'),
    });

    return !!isConfirmed;
  }, [isMessageDirty, requestConfirmation, t]);

  const changeChatStatus = useCallback(
    async (chatId: string, status: ChatStatus, onSuccess?: () => void) => {
      if (!targetChat) return;

      if (!(await confirmDiscardMessage())) return;
      setMessage('');

      const prevStatus = targetChat.chatStatus;
      const nextUnreadCount = status === ChatStatus.Done ? 0 : targetChat.chatUnreadCount;
      const rollbackStatus = () => {
        setTargetChat(
          (prevChat) =>
            prevChat && {
              ...prevChat,
              chatStatus: prevStatus,
              chatUnreadCount: targetChat.chatUnreadCount,
            },
        );
        setChats((prevChats) =>
          sortChatsByLastMessage(
            prevChats?.map((chat) =>
              chat.id === chatId
                ? {
                    ...chat,
                    chatStatus: prevStatus,
                    chatUnreadCount: targetChat.chatUnreadCount,
                  }
                : chat,
            ) ?? [],
          ),
        );
      };

      setTargetChat(
        (prevChat) =>
          prevChat && { ...prevChat, chatStatus: status, chatUnreadCount: nextUnreadCount },
      );
      setChats((prevChats) =>
        sortChatsByLastMessage(
          prevChats?.map((chat) =>
            chat.id === chatId
              ? { ...chat, chatStatus: status, chatUnreadCount: nextUnreadCount }
              : chat,
          ) ?? [],
        ),
      );

      try {
        const { errors } = await _changeChatStatus({
          variables: {
            chatStatusInput: {
              chatId,
              status,
            },
          },
        });

        if (errors) {
          rollbackStatus();
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        onSuccess && onSuccess();
      } catch {
        rollbackStatus();
      }
    },
    [_changeChatStatus, confirmDiscardMessage, targetChat, setChats, setTargetChat],
  );

  const setTargetChatId = useCallback(
    async (id: ID) => {
      if (!(await confirmDiscardMessage())) return;

      setFirstChat(id);
    },
    [confirmDiscardMessage, setFirstChat],
  );

  const resetTargetChat = useCallback(() => {
    setIsFetchingOne(true);
    setChatMessages([]);
    setChatActivities([]);
    setTargetChat(null);
    setMessage('');
  }, [setTargetChat, setChatMessages, setChatActivities, setIsFetchingOne]);

  const clearTargetChat = useCallback(() => {
    resetTargetChat();
    searchParams.delete(ID_PARAM_KEY);
    setSearchParams(searchParams);
  }, [resetTargetChat, searchParams, setSearchParams]);

  const getChat = useCallback(
    async (id: string) => {
      if (!id) return;

      const result = await _getChat({
        variables: { id },
      });

      if (result?.data) {
        const { chatHistory } = result.data;

        setTargetChat((prev) => {
          setPrevTargetChat(prev);
          return chatHistory as IChat;
        });

        if (chatHistory) {
          const chatId = chatHistory.id;

          const teamsInChatQueryResult = await getTeamsInChat({
            variables: {
              chatId,
            },
          });

          if (teamsInChatQueryResult.data) {
            const teamsInChatData = teamsInChatQueryResult.data;
            setTeamsInChat(teamsInChatData.teamsInChat);
          }
        }
      }
    },
    [_getChat, getTeamsInChat, setPrevTargetChat, setTargetChat, setTeamsInChat],
  );

  const refetchTargetChat = async () => {
    const response = await _refetchTargetChat();
    if (response.data) {
      setTargetChat(response.data.chatHistory as IChat);
    }
  };

  const handleChatMessageDelete = useCallback(
    async (chatId: ID, messageId: ID) => {
      if (isMessageDeleted(chatId, messageId)) {
        enqueueSnackbar(t_toasts('chat.success.message.delete'), { variant: 'success' });
        return;
      }

      const isConfirmed = await requestConfirmation({
        title: t('confirmation'),
        message: t('info.sureToDeleteMsg'),
        confirmText: t('actions.delete'),
        cancelText: t('actions.cancel'),
      });

      if (!isConfirmed) return;

      handleChatMessageUpdate({
        chatId,
        messageId,
        isDeleting: true,
      });

      _deleteChatMessage({
        variables: {
          deleteMessageInput: {
            chatId,
            messageId,
          },
        },
      });
    },
    [
      _deleteChatMessage,
      handleChatMessageUpdate,
      isMessageDeleted,
      requestConfirmation,
      t,
      t_toasts,
      enqueueSnackbar,
    ],
  );

  const handleChatUpdate = useCallback(
    (chatPayload: IChat) => {
      const { id: payloadChatId, chatMessages, chatActivities, ...rest } = chatPayload;
      const targetChatMessage = chatMessages?.[0];
      const newChatActivities = chatActivities || [];
      const chatDetails = Object.keys(rest).length > 0 ? rest : null;

      // Update chat list
      setChats((prevChats) => {
        if (!prevChats || !payloadChatId) return prevChats;

        const isExistingChat = prevChats.some((chat) => chat.id === payloadChatId);

        if (!isExistingChat) {
          setChatsCount((prevCount) => prevCount + 1);
          refetchUnassignedChatCount();
          return sortChatsByLastMessage([chatPayload, ...prevChats]);
        }

        return sortChatsByLastMessage(
          prevChats.map((chat) =>
            chat.id === payloadChatId
              ? {
                  ...chat,
                  ...chatDetails,
                  chatMessages: targetChatMessage ? [targetChatMessage] : chat.chatMessages,
                }
              : chat,
          ),
        );
      });

      const currentTargetChat = targetChatRef.current;
      if (!currentTargetChat || !payloadChatId || currentTargetChat.id !== payloadChatId) return;

      setTargetChat((prev) => {
        if (!prev || prev.id !== payloadChatId) return prev;
        return {
          ...prev,
          ...chatDetails,
          chatMessages: targetChatMessage ? [targetChatMessage] : prev.chatMessages,
        };
      });

      setChatMessages((prevChatMessages) => {
        if (!prevChatMessages) return [];

        const payloadMessages = chatMessages ?? [];
        const payloadMap = new Map(payloadMessages.map((msg) => [msg.id, msg]));
        const updated = prevChatMessages.map((msg) => payloadMap.get(msg.id) ?? msg);

        for (const msg of prevChatMessages) {
          payloadMap.delete(msg.id);
        }

        const newMessages = Array.from(payloadMap.values());

        return [...updated, ...newMessages].filter((msg) => isTruthy(msg));
      });

      if (newChatActivities.length > 0) {
        setChatActivities((prevActivities) => {
          const activityMap = new Map();

          for (const activity of newChatActivities) {
            activityMap.set(activity.id, activity);
          }

          for (const activity of prevActivities) {
            if (!activityMap.has(activity.id)) {
              activityMap.set(activity.id, activity);
            }
          }

          const mergedActivities = Array.from(activityMap.values()) as IChatActivity[];

          if (infiniteQueryResponse?.cursorCreatedAt) {
            const cursorCreatedAt = new Date(infiniteQueryResponse.cursorCreatedAt);

            return mergedActivities.filter(
              (activity) => new Date(activity.createdAt) >= cursorCreatedAt,
            );
          }

          return mergedActivities;
        });
      }

      if (targetChatMessage) {
        checkAndNotifyChatMessageUpdate(targetChatMessage, chatMessagesRef.current);
      }

      checkAndNotifyChatUpdate(currentTargetChat, chatPayload);
    },
    [
      setChats,
      setChatsCount,
      refetchUnassignedChatCount,
      setTargetChat,
      setChatMessages,
      checkAndNotifyChatUpdate,
      setChatActivities,
      infiniteQueryResponse,
      checkAndNotifyChatMessageUpdate,
    ],
  );

  const getChatData = useCallback(
    (chatId: string) => {
      getChatDataFunction({ chatId });
    },
    [getChatDataFunction],
  );

  useEffect(() => {
    resetTargetChat();
    if (!id) return;

    getChat(id);
    getChatData(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, getChat, resetTargetChat]);

  useEffect(() => {
    const notificationClicked = async (event: MessageEvent<SWMessageEvent>) => {
      if (event.data.type !== NotificationClickEventType.CHAT_NOTIFICATION_CLICKED) return;
      const targetChatId = event.data.data.chatId as string;
      await setTargetChatId(targetChatId);
    };

    navigator.serviceWorker.addEventListener('message', notificationClicked);

    return () => navigator.serviceWorker.removeEventListener('message', notificationClicked);
  }, [setTargetChatId]);

  const value = useMemo(
    () => ({
      message,
      handleChatUpdate,
      handleChatMessageUpdate,
      setMessage,
      getTeamsInChat,
      getChat,
      setTargetChatId,
      handleChatMessageDelete,
      clearTargetChat,
      confirmDiscardMessage,
      sendMessage,
      sendUploadLink,
      sendFileUploadedMessage,
      sendMessageToLigla,
      refetchTargetChat,
      isMessageSending,
      isSendingUploadLink,
      isRetryingMessage,
      isChangingChatStatus,
      retryMessage,
      assignOperator,
      assignTeam,
      unassignTeam,
      changeChatStatus,
      removeChatTag,
      updateChatTags,
      updateChatLatestRead,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      message,
      isMessageSending,
      isSendingUploadLink,
      isRetryingMessage,
      isChangingChatStatus,
      targetChat,
      handleChatUpdate,
    ],
  );

  return <ChatActionsContext.Provider value={value}>{children}</ChatActionsContext.Provider>;
};
