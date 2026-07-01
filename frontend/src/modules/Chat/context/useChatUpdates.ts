import { useCallback } from 'react';

import { useSnackbar } from 'notistack';

import { getChatStatusLabel } from '~/common/constants';
import { ChatStatus } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';

import { type IChat, type IChatMessage } from '../types';

export const useChatUpdates = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { t_toasts, t_chat } = useTranslation();

  const checkAndNotifyChatMessageUpdate = useCallback(
    (newChatMessage: IChatMessage, currentMessages: IChatMessage[]) => {
      const oldChatMessage = currentMessages.find((msg) => msg.id === newChatMessage.id);
      if (!oldChatMessage) return;

      if (oldChatMessage.isDelivering && newChatMessage.isDelivered === false) {
        enqueueSnackbar(t_toasts('chat.error.message.send'), {
          variant: 'error',
          preventDuplicate: true,
        });
      }

      if (oldChatMessage.isRetrying) {
        const variant = newChatMessage.isDelivered ? 'success' : 'error';

        enqueueSnackbar(t_toasts(`chat.${variant}.message.retried`), {
          variant,
          preventDuplicate: true,
        });
      }
    },
    [enqueueSnackbar, t_toasts],
  );

  const checkAndNotifyChatUpdate = useCallback(
    (oldChat: IChat, newChat: IChat) => {
      if (
        oldChat.chatStatus === ChatStatus.Pending &&
        newChat.chatStatus === ChatStatus.Addressing
      ) {
        enqueueSnackbar(
          t_toasts('chat.success.status.autoChanged', {
            status: t_chat(`status.${getChatStatusLabel(ChatStatus.Addressing)}`),
          }),
          {
            variant: 'success',
          },
        );
      }
    },
    [enqueueSnackbar, t_chat, t_toasts],
  );

  return {
    checkAndNotifyChatMessageUpdate,
    checkAndNotifyChatUpdate,
  };
};
