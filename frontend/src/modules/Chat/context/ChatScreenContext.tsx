import { createContext, useContext } from 'react';

import {
  CHAT_DETAIL_DRAWER_OPEN_STORAGE_KEY,
  CHAT_LIST_DRAWER_OPEN_STORAGE_KEY,
} from '~/common/constants';
import { useCollapsible, useResponsive } from '~/common/hooks';

type ChatScreenContextProps = {
  isChatRoomOpen: boolean;
  isChatListOpen: boolean;
  isChatDetailOpen: boolean;
  toggleChatList: () => void;
  openChatList: () => void;
  closeChatList: () => void;
  toggleChatDetail: () => void;
  openChatDetail: () => void;
  closeChatDetail: () => void;
};

const ChatScreenContext = createContext<ChatScreenContextProps>({
  isChatRoomOpen: false,
  isChatListOpen: false,
  isChatDetailOpen: false,
  toggleChatList: () => {},
  openChatList: () => {},
  closeChatList: () => {},
  toggleChatDetail: () => {},
  openChatDetail: () => {},
  closeChatDetail: () => {},
});

type ProviderProps = {
  children: React.ReactNode;
};

const getCollapsibleHandlers = (
  collapsible: ReturnType<typeof useCollapsible>,
  lsKey: string,
  syncLocalStorage: boolean,
) => {
  const toggle = () => {
    collapsible.toggle();
    if (!syncLocalStorage) return;

    const next = !collapsible.isOpen;
    if (next) {
      localStorage.setItem(lsKey, '1');
    } else {
      localStorage.removeItem(lsKey);
    }
  };

  const open = () => {
    collapsible.open();
    if (!syncLocalStorage) return;

    localStorage.setItem(lsKey, '1');
  };

  const close = () => {
    collapsible.close();
    if (!syncLocalStorage) return;

    localStorage.removeItem(lsKey);
  };

  return { toggle, open, close };
};

export const ChatScreenProvider = ({ children }: ProviderProps) => {
  const { isMobileOrTablet } = useResponsive();

  const chatList = useCollapsible(!!localStorage.getItem(CHAT_LIST_DRAWER_OPEN_STORAGE_KEY));
  const chatDetail = useCollapsible(!!localStorage.getItem(CHAT_DETAIL_DRAWER_OPEN_STORAGE_KEY));

  const chatListHandlers = getCollapsibleHandlers(
    chatList,
    CHAT_LIST_DRAWER_OPEN_STORAGE_KEY,
    !isMobileOrTablet,
  );

  const chatDetailHandlers = getCollapsibleHandlers(
    chatDetail,
    CHAT_DETAIL_DRAWER_OPEN_STORAGE_KEY,
    !isMobileOrTablet,
  );

  const isChatRoomOpen = !chatList.isOpen && !chatDetail.isOpen;

  return (
    <ChatScreenContext.Provider
      value={{
        isChatRoomOpen,
        // ChatList
        isChatListOpen: chatList.isOpen,
        toggleChatList: chatListHandlers.toggle,
        openChatList: chatListHandlers.open,
        closeChatList: chatListHandlers.close,
        // ChatDetail
        isChatDetailOpen: chatDetail.isOpen,
        toggleChatDetail: chatDetailHandlers.toggle,
        openChatDetail: chatDetailHandlers.open,
        closeChatDetail: chatDetailHandlers.close,
      }}
    >
      {children}
    </ChatScreenContext.Provider>
  );
};

export const useChatScreenContext = () => useContext(ChatScreenContext);
