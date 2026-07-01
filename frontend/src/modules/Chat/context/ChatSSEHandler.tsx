import { useCallback } from 'react';

import { isChatPayload, isMessageUpdatePayload } from '~/utils';

import { useChatEventSource } from '../hooks';
import { type IChat, type IChatMessageUpdatePayload } from '../types';

import { useChatActions } from '.';

export const ChatSSEHandler = () => {
  const { handleChatUpdate, handleChatMessageUpdate } = useChatActions();
  const handleChatEvent = useCallback(
    (payload: IChat | IChatMessageUpdatePayload) => {
      if (isMessageUpdatePayload(payload)) {
        return handleChatMessageUpdate(payload);
      }
      if (isChatPayload(payload)) {
        return handleChatUpdate(payload);
      }

      console.error('Unknown SSE payload type!');
    },
    [handleChatMessageUpdate, handleChatUpdate],
  );

  useChatEventSource(handleChatEvent);

  return <></>;
};
