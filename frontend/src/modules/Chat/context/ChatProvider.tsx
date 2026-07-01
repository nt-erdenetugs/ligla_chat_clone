import { ChatActionsProvider } from './ChatActions';
import { ChatListProvider } from './ChatList';
import { ChatRoomProvider } from './ChatRoom';
import { ChatSSEHandler } from './ChatSSEHandler';

type ChatProviderProps = {
  children: React.ReactNode;
};

export const ChatProvider = ({ children }: ChatProviderProps) => {
  return (
    <ChatRoomProvider>
      <ChatListProvider>
        <ChatActionsProvider>
          <ChatSSEHandler />
          {children}
        </ChatActionsProvider>
      </ChatListProvider>
    </ChatRoomProvider>
  );
};
