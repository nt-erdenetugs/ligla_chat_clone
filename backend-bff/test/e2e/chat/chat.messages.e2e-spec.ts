import { CHAT_QUERIES } from '../../fixtures/graphql/chat.queries';
import { TestValidators } from '../../utils/test-setup';

import {
  ChatTestContext,
  getSharedChatTestApp,
  cleanupSharedChatTestApp,
  setupChatTests,
} from './chat-test.setup';

const ERROR_MESSAGES = {
  FORBIDDEN_RESOURCE: 'Forbidden resource',
  FORBIDDEN: 'Forbidden',
  UNAUTHORIZED: 'Unauthorized',
  COMPLETED_CHAT: 'You cannot send a message to a completed chat',

  BLOCKED_USER: 'You cannot send a message to a user who has blocked this conversation',
  NOT_FOUND: 'not found',
  CHAT_NOT_FOUND: 'Chat message not found',
  NOT_AUTHORIZED_DELETE: 'You are not authorized to delete message from this chat',
  NOT_AUTHORIZED_INTERACT: 'not authorized to interact',
} as const;

const TEST_MESSAGES = {
  TEXT: 'Test message from operator',
  ADMIN_OPERATOR: 'Test message from admin operator',
  MANAGER_OPERATOR: 'Test message from manager operator',
  EMPTY: '',
  LONG: 'A'.repeat(5000),
  SPECIAL_CHARS: '!@#$%^&*()_+-=[]{}|;\':",./<>?`~\n\t',
  UNICODE: '你好世界 🌟 مرحبا بالعالم',
  URL: 'https://example.com/image.jpg',
  NUMERIC: '12345',
  MIXED: 'Check this out: https://example.com/file.pdf',
  LOCATION: 'Tokyo Station, Chiyoda City, Tokyo',
  EMOJI: '👍 Great!',
  MULTILINE: 'Line 1\nLine 2\nLine 3',
  PENDING_RESPONSE: 'Response to pending chat',
  DONE_RESPONSE: 'Message to done chat',
} as const;

// Test Helper Class
class ChatMessagesTestHelpers {
  static createChatMessageInput(chatId: string, text: string) {
    return {
      chatId,
      message: { type: 'TEXT', text },
    };
  }

  static createDeleteMessageInput(chatId: string, messageId: string) {
    return {
      chatId,
      messageId,
    };
  }

  static createRetryMessageInput(chatId: string, messageId: string) {
    return {
      chatId,
      messageId,
    };
  }

  static validateMessageResponse(response: any, chatId: string, expectedSenderType = 'OPERATOR') {
    TestValidators.validateChatMessage(response, {
      chatId,
      senderType: expectedSenderType,
    });
  }
}

describe('Chat Messages (E2E)', () => {
  let context: ChatTestContext;

  beforeAll(async () => {
    const baseContext = await getSharedChatTestApp();
    context = await setupChatTests(baseContext, 'chat_messages');
  });

  beforeEach(async () => {
    const updated = await setupChatTests(context, 'chat_messages');
    Object.assign(context, updated);
  });

  afterEach(async () => {
    await context.cleaner.cleanChatTestData(context.tenantSchemaNames);
  });

  afterAll(async () => {
    await cleanupSharedChatTestApp();
  });

  describe('sendMessage', () => {
    let endUser: any;
    let testChat: any;

    beforeEach(async () => {
      endUser = await context.factory.createEndUser(context.org1.name);
      testChat = await context.factory.createChat(context.org1.name, endUser.userId, {
        chatStatus: 'ADDRESSING',
      });
      await context.factory.assignUserToChat(testChat.id, context.operatorUser.id);
    });

    describe('successful message sending', () => {
      it('should send message as assigned OPERATOR', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.SEND_MESSAGE,
          {
            chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
              testChat.id,
              TEST_MESSAGES.TEXT,
            ),
          },
          context.operatorToken,
        );

        ChatMessagesTestHelpers.validateMessageResponse(response.sendMessage, testChat.id);
        expect(response.sendMessage.isDelivered).toBe(false);
      });

      it('should send message as ADMIN_OPERATOR', async () => {
        const adminOp = await context.factory.createUser(context.org1.name, 'ADMIN_OPERATOR');
        const adminOpToken = context.authHelper.generateToken(adminOp.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.SEND_MESSAGE,
          {
            chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
              testChat.id,
              TEST_MESSAGES.ADMIN_OPERATOR,
            ),
          },
          adminOpToken,
        );

        ChatMessagesTestHelpers.validateMessageResponse(response.sendMessage, testChat.id);
      });

      it('should send message as MANAGER_OPERATOR', async () => {
        const managerOp = await context.factory.createUser(context.org1.name, 'MANAGER_OPERATOR');
        const managerOpToken = context.authHelper.generateToken(managerOp.id);

        const managerOpChat = await context.factory.createChat(context.org1.name, endUser.userId, {
          chatStatus: 'ADDRESSING',
          assignedUserId: managerOp.id,
        });

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.SEND_MESSAGE,
          {
            chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
              managerOpChat.id,
              TEST_MESSAGES.MANAGER_OPERATOR,
            ),
          },
          managerOpToken,
        );

        ChatMessagesTestHelpers.validateMessageResponse(response.sendMessage, managerOpChat.id);
      });
    });

    describe('authorization', () => {
      it('should deny MANAGER from sending message (not operator role)', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.SEND_MESSAGE,
          ERROR_MESSAGES.FORBIDDEN_RESOURCE,
          {
            chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
              testChat.id,
              TEST_MESSAGES.TEXT,
            ),
          },
          context.managerToken,
        );
      });

      it('should deny ADMIN from sending message (not operator role)', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.SEND_MESSAGE,
          ERROR_MESSAGES.FORBIDDEN_RESOURCE,
          {
            chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
              testChat.id,
              TEST_MESSAGES.TEXT,
            ),
          },
          context.adminToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.SEND_MESSAGE,
          ERROR_MESSAGES.UNAUTHORIZED,
          {
            chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
              testChat.id,
              TEST_MESSAGES.TEXT,
            ),
          },
        );
      });
    });

    describe('validation', () => {
      it('should reject sending message to DONE chat', async () => {
        const doneChat = await context.factory.createChat(context.org1.name, endUser.userId, {
          chatStatus: 'DONE',
          assignedUserId: context.operatorUser.id,
        });

        await context.client.queryExpectError(
          CHAT_QUERIES.SEND_MESSAGE,
          ERROR_MESSAGES.COMPLETED_CHAT,
          {
            chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
              doneChat.id,
              TEST_MESSAGES.TEXT,
            ),
          },
          context.operatorToken,
        );
      });

      it('should reject sending message to blocked user', async () => {
        const blockedChat = await context.factory.createChat(context.org1.name, endUser.userId, {
          chatStatus: 'ADDRESSING',
          isUserBlocked: true,
          assignedUserId: context.operatorUser.id,
        });

        await context.client.queryExpectError(
          CHAT_QUERIES.SEND_MESSAGE,
          ERROR_MESSAGES.BLOCKED_USER,
          {
            chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
              blockedChat.id,
              TEST_MESSAGES.TEXT,
            ),
          },
          context.operatorToken,
        );
      });

      it('should reject message to non-existent chat', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.SEND_MESSAGE,
          ERROR_MESSAGES.NOT_FOUND,
          {
            chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
              '00000000-0000-0000-0000-000000000000',
              TEST_MESSAGES.TEXT,
            ),
          },
          context.operatorToken,
        );
      });
    });

    describe('multi-tenancy', () => {
      it('should prevent cross-organization message send', async () => {
        const org2Chat = await context.factory.createChat(context.org2.name, endUser.userId, {
          assignedUserId: context.operatorUser.id,
        });

        await context.client.queryExpectError(
          CHAT_QUERIES.SEND_MESSAGE,
          ERROR_MESSAGES.NOT_FOUND,
          {
            chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
              org2Chat.id,
              TEST_MESSAGES.TEXT,
            ),
          },
          context.operatorToken,
        );
      });
    });

    describe('message content variations', () => {
      it('should handle empty message text', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.SEND_MESSAGE,
          {
            chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
              testChat.id,
              TEST_MESSAGES.EMPTY,
            ),
          },
          context.operatorToken,
        );

        expect(response.sendMessage).toBeDefined();
      });

      it('should handle very long message text', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.SEND_MESSAGE,
          {
            chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
              testChat.id,
              TEST_MESSAGES.LONG,
            ),
          },
          context.operatorToken,
        );

        expect(response.sendMessage).toBeDefined();
      });

      it('should handle special characters in message', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.SEND_MESSAGE,
          {
            chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
              testChat.id,
              TEST_MESSAGES.SPECIAL_CHARS,
            ),
          },
          context.operatorToken,
        );

        expect(response.sendMessage).toBeDefined();
      });

      it('should handle unicode characters in message', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.SEND_MESSAGE,
          {
            chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
              testChat.id,
              TEST_MESSAGES.UNICODE,
            ),
          },
          context.operatorToken,
        );

        expect(response.sendMessage).toBeDefined();
      });
    });

    describe('message with different content types', () => {
      let adminOp: any;
      let adminOpToken: string;

      beforeEach(async () => {
        adminOp = await context.factory.createUser(context.org1.name, 'ADMIN_OPERATOR');
        adminOpToken = context.authHelper.generateToken(adminOp.id);
      });

      it('should send message with URL content', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.SEND_MESSAGE,
          {
            chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
              testChat.id,
              TEST_MESSAGES.URL,
            ),
          },
          adminOpToken,
        );

        ChatMessagesTestHelpers.validateMessageResponse(response.sendMessage, testChat.id);
      });

      it('should send message with numeric content', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.SEND_MESSAGE,
          {
            chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
              testChat.id,
              TEST_MESSAGES.NUMERIC,
            ),
          },
          adminOpToken,
        );

        expect(response.sendMessage.chatId).toBe(testChat.id);
      });

      it('should send message with mixed content', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.SEND_MESSAGE,
          {
            chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
              testChat.id,
              TEST_MESSAGES.MIXED,
            ),
          },
          adminOpToken,
        );

        expect(response.sendMessage.chatId).toBe(testChat.id);
      });

      it('should send message with location-like text', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.SEND_MESSAGE,
          {
            chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
              testChat.id,
              TEST_MESSAGES.LOCATION,
            ),
          },
          adminOpToken,
        );

        expect(response.sendMessage.chatId).toBe(testChat.id);
      });

      it('should send message with emoji', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.SEND_MESSAGE,
          {
            chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
              testChat.id,
              TEST_MESSAGES.EMOJI,
            ),
          },
          adminOpToken,
        );

        expect(response.sendMessage.chatId).toBe(testChat.id);
      });

      it('should send message with multiline text', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.SEND_MESSAGE,
          {
            chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
              testChat.id,
              TEST_MESSAGES.MULTILINE,
            ),
          },
          adminOpToken,
        );

        expect(response.sendMessage.chatId).toBe(testChat.id);
      });
    });

    describe('concurrent operations', () => {
      it('should handle rapid consecutive messages', async () => {
        const messages = [];
        for (let i = 0; i < 3; i++) {
          messages.push(
            context.client.queryExpectSuccess(
              CHAT_QUERIES.SEND_MESSAGE,
              {
                chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
                  testChat.id,
                  `Message ${i}`,
                ),
              },
              context.operatorToken,
            ),
          );
        }

        const responses = await Promise.all(messages);
        expect(responses.length).toBe(3);
        responses.forEach((response) => {
          expect(response.sendMessage).toBeDefined();
        });
      });
    });

    describe('chat status changes', () => {
      it('should auto-change status from PENDING to ADDRESSING when message sent to Ligla', async () => {
        const pendingChat = await context.factory.createChat(context.org1.name, endUser.userId, {
          chatStatus: 'PENDING',
          assignedUserId: context.operatorUser.id,
        });

        const message = await context.factory.createChatMessage(
          pendingChat.id,
          context.operatorUser.id,
          {
            content: JSON.stringify({ text: 'Test message', type: 'text' }),
            isDelivered: false,
          },
        );

        await context.client.queryExpectSuccess(
          CHAT_QUERIES.SEND_MESSAGE_TO_LIGLA,
          {
            chatId: pendingChat.id,
            messageId: message.id,
          },
          context.operatorToken,
        );

        const updatedChat = await context.factory.getChat(pendingChat.id);
        expect(updatedChat.chatStatus).toBe('ADDRESSING');
      });

      it('should not change status if already ADDRESSING', async () => {
        const message = await context.factory.createChatMessage(
          testChat.id,
          context.operatorUser.id,
          {
            content: JSON.stringify({ text: 'Test message', type: 'text' }),
            isDelivered: false,
          },
        );

        await context.client.queryExpectSuccess(
          CHAT_QUERIES.SEND_MESSAGE_TO_LIGLA,
          {
            chatId: testChat.id,
            messageId: message.id,
          },
          context.operatorToken,
        );

        const updatedChat = await context.factory.getChat(testChat.id);
        expect(updatedChat.chatStatus).toBe('ADDRESSING');
      });

      it('should send message to PENDING chat', async () => {
        const pendingChat = await context.factory.createChat(context.org1.name, endUser.userId, {
          chatStatus: 'PENDING',
          assignedUserId: context.operatorUser.id,
        });

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.SEND_MESSAGE,
          {
            chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
              pendingChat.id,
              TEST_MESSAGES.PENDING_RESPONSE,
            ),
          },
          context.operatorToken,
        );

        expect(response.sendMessage).toBeDefined();
        expect(response.sendMessage.chatId).toBe(pendingChat.id);
      });

      it('should reject sending message to DONE chat', async () => {
        const doneChat = await context.factory.createChat(context.org1.name, endUser.userId, {
          chatStatus: 'DONE',
          assignedUserId: context.operatorUser.id,
        });

        await context.client.queryExpectError(
          CHAT_QUERIES.SEND_MESSAGE,
          ERROR_MESSAGES.COMPLETED_CHAT,
          {
            chatMessageInput: ChatMessagesTestHelpers.createChatMessageInput(
              doneChat.id,
              TEST_MESSAGES.DONE_RESPONSE,
            ),
          },
          context.operatorToken,
        );
      });
    });
  });

  describe('deleteChatMessage', () => {
    let endUser: any;
    let testChat: any;
    let testMessage: any;

    beforeEach(async () => {
      endUser = await context.factory.createEndUser(context.org1.name);
      testChat = await context.factory.createChat(context.org1.name, endUser.userId, {
        assignedUserId: context.operatorUser.id,
      });
      testMessage = await context.factory.createChatMessage(testChat.id, context.operatorUser.id);
    });

    describe('successful deletion', () => {
      it('should delete message as ADMIN_OPERATOR', async () => {
        const adminOp = await context.factory.createUser(context.org1.name, 'ADMIN_OPERATOR');
        const adminOpToken = context.authHelper.generateToken(adminOp.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.DELETE_CHAT_MESSAGE,
          {
            deleteMessageInput: ChatMessagesTestHelpers.createDeleteMessageInput(
              testChat.id,
              testMessage.id,
            ),
          },
          adminOpToken,
        );

        expect(response.deleteChatMessage).toBe(true);

        const deletedMessage = await context.factory.getChatMessageById(testMessage.id);
        expect(deletedMessage).toBeNull();
      });

      it('should delete message as MANAGER_OPERATOR', async () => {
        const managerOp = await context.factory.createUser(context.org1.name, 'MANAGER_OPERATOR');
        const managerOpToken = context.authHelper.generateToken(managerOp.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.DELETE_CHAT_MESSAGE,
          {
            deleteMessageInput: ChatMessagesTestHelpers.createDeleteMessageInput(
              testChat.id,
              testMessage.id,
            ),
          },
          managerOpToken,
        );

        expect(response.deleteChatMessage).toBe(true);
      });
    });

    describe('authorization', () => {
      it('should deny OPERATOR from deleting message from unassigned chat', async () => {
        const anotherOperator = await context.factory.createUser(context.org1.name, 'OPERATOR');
        const unassignedChat = await context.factory.createChat(context.org1.name, endUser.userId, {
          assignedUserId: anotherOperator.id,
        });
        const unassignedMessage = await context.factory.createChatMessage(
          unassignedChat.id,
          anotherOperator.id,
        );

        await context.client.queryExpectError(
          CHAT_QUERIES.DELETE_CHAT_MESSAGE,
          ERROR_MESSAGES.NOT_AUTHORIZED_DELETE,
          {
            deleteMessageInput: ChatMessagesTestHelpers.createDeleteMessageInput(
              unassignedChat.id,
              unassignedMessage.id,
            ),
          },
          context.operatorToken,
        );
      });

      it('should deny ADMIN from deleting message (not operator role)', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.DELETE_CHAT_MESSAGE,
          ERROR_MESSAGES.FORBIDDEN,
          {
            deleteMessageInput: ChatMessagesTestHelpers.createDeleteMessageInput(
              testChat.id,
              testMessage.id,
            ),
          },
          context.adminToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.DELETE_CHAT_MESSAGE,
          ERROR_MESSAGES.UNAUTHORIZED,
          {
            deleteMessageInput: ChatMessagesTestHelpers.createDeleteMessageInput(
              testChat.id,
              testMessage.id,
            ),
          },
        );
      });
    });

    describe('validation', () => {
      it('should reject deleting non-existent message', async () => {
        const adminOp = await context.factory.createUser(context.org1.name, 'ADMIN_OPERATOR');
        const adminOpToken = context.authHelper.generateToken(adminOp.id);

        await context.client.queryExpectError(
          CHAT_QUERIES.DELETE_CHAT_MESSAGE,
          ERROR_MESSAGES.NOT_FOUND,
          {
            deleteMessageInput: ChatMessagesTestHelpers.createDeleteMessageInput(
              testChat.id,
              '00000000-0000-0000-0000-000000000000',
            ),
          },
          adminOpToken,
        );
      });

      it('should handle deleting already deleted message', async () => {
        const adminOp = await context.factory.createUser(context.org1.name, 'ADMIN_OPERATOR');
        const adminOpToken = context.authHelper.generateToken(adminOp.id);

        const message = await context.factory.createChatMessage(
          testChat.id,
          context.operatorUser.id,
        );

        await context.client.queryExpectSuccess(
          CHAT_QUERIES.DELETE_CHAT_MESSAGE,
          {
            deleteMessageInput: ChatMessagesTestHelpers.createDeleteMessageInput(
              testChat.id,
              message.id,
            ),
          },
          adminOpToken,
        );

        await context.client.queryExpectError(
          CHAT_QUERIES.DELETE_CHAT_MESSAGE,
          ERROR_MESSAGES.CHAT_NOT_FOUND,
          {
            deleteMessageInput: ChatMessagesTestHelpers.createDeleteMessageInput(
              testChat.id,
              message.id,
            ),
          },
          adminOpToken,
        );
      });
    });
  });

  describe('retrySendMessage', () => {
    let endUser: any;
    let testChat: any;
    let failedMessage: any;

    beforeEach(async () => {
      endUser = await context.factory.createEndUser(context.org1.name);
      testChat = await context.factory.createChat(context.org1.name, endUser.userId, {
        chatStatus: 'ADDRESSING',
        assignedUserId: context.operatorUser.id,
      });
      failedMessage = await context.factory.createChatMessage(
        testChat.id,
        context.operatorUser.id,
        {
          isDelivered: false,
          type: 'TEXT',
          content: JSON.stringify({ text: 'Failed message' }),
        },
      );
    });

    describe('successful retry', () => {
      it('should retry sending failed message as ADMIN_OPERATOR', async () => {
        const adminOp = await context.factory.createUser(context.org1.name, 'ADMIN_OPERATOR');
        const adminOpToken = context.authHelper.generateToken(adminOp.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.RETRY_SEND_MESSAGE,
          {
            retryMessageInput: ChatMessagesTestHelpers.createRetryMessageInput(
              testChat.id,
              failedMessage.id,
            ),
          },
          adminOpToken,
        );

        expect(response.retrySendMessage).toBeDefined();
        expect(response.retrySendMessage.id).toBe(failedMessage.id);
        expect(response.retrySendMessage.chatId).toBe(testChat.id);
      });

      it('should retry sending failed message as MANAGER_OPERATOR', async () => {
        const managerOp = await context.factory.createUser(context.org1.name, 'MANAGER_OPERATOR');
        const managerOpToken = context.authHelper.generateToken(managerOp.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.RETRY_SEND_MESSAGE,
          {
            retryMessageInput: ChatMessagesTestHelpers.createRetryMessageInput(
              testChat.id,
              failedMessage.id,
            ),
          },
          managerOpToken,
        );

        expect(response.retrySendMessage).toBeDefined();
      });
    });

    describe('authorization', () => {
      it('should deny regular OPERATOR from retrying message on unassigned chat', async () => {
        const anotherOperator = await context.factory.createUser(context.org1.name, 'OPERATOR');
        const unassignedChat = await context.factory.createChat(context.org1.name, endUser.userId, {
          chatStatus: 'ADDRESSING',
          assignedUserId: anotherOperator.id,
        });
        const unassignedFailedMessage = await context.factory.createChatMessage(
          unassignedChat.id,
          anotherOperator.id,
          {
            isDelivered: false,
            type: 'TEXT',
            content: JSON.stringify({ text: 'Failed message' }),
          },
        );

        await context.client.queryExpectError(
          CHAT_QUERIES.RETRY_SEND_MESSAGE,
          ERROR_MESSAGES.NOT_AUTHORIZED_INTERACT,
          {
            retryMessageInput: ChatMessagesTestHelpers.createRetryMessageInput(
              unassignedChat.id,
              unassignedFailedMessage.id,
            ),
          },
          context.operatorToken,
        );
      });

      it('should deny ADMIN from retrying message (not operator role)', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.RETRY_SEND_MESSAGE,
          ERROR_MESSAGES.FORBIDDEN,
          {
            retryMessageInput: ChatMessagesTestHelpers.createRetryMessageInput(
              testChat.id,
              failedMessage.id,
            ),
          },
          context.adminToken,
        );
      });

      it('should deny MANAGER from retrying message (not operator role)', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.RETRY_SEND_MESSAGE,
          ERROR_MESSAGES.FORBIDDEN,
          {
            retryMessageInput: ChatMessagesTestHelpers.createRetryMessageInput(
              testChat.id,
              failedMessage.id,
            ),
          },
          context.managerToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.RETRY_SEND_MESSAGE,
          ERROR_MESSAGES.UNAUTHORIZED,
          {
            retryMessageInput: ChatMessagesTestHelpers.createRetryMessageInput(
              testChat.id,
              failedMessage.id,
            ),
          },
        );
      });
    });

    describe('validation', () => {
      it('should reject retrying non-existent message', async () => {
        const adminOp = await context.factory.createUser(context.org1.name, 'ADMIN_OPERATOR');
        const adminOpToken = context.authHelper.generateToken(adminOp.id);

        await context.client.queryExpectError(
          CHAT_QUERIES.RETRY_SEND_MESSAGE,
          ERROR_MESSAGES.NOT_FOUND,
          {
            retryMessageInput: ChatMessagesTestHelpers.createRetryMessageInput(
              testChat.id,
              '00000000-0000-0000-0000-000000000000',
            ),
          },
          adminOpToken,
        );
      });

      it('should handle retrying already delivered message', async () => {
        const deliveredMessage = await context.factory.createChatMessage(
          testChat.id,
          context.operatorUser.id,
          {
            isDelivered: true,
            type: 'TEXT',
            content: JSON.stringify({ text: 'Already delivered' }),
          },
        );

        const adminOp = await context.factory.createUser(context.org1.name, 'ADMIN_OPERATOR');
        const adminOpToken = context.authHelper.generateToken(adminOp.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.RETRY_SEND_MESSAGE,
          {
            retryMessageInput: ChatMessagesTestHelpers.createRetryMessageInput(
              testChat.id,
              deliveredMessage.id,
            ),
          },
          adminOpToken,
        );

        expect(response.retrySendMessage).toBeDefined();
      });
    });

    describe('multi-tenancy', () => {
      it('should prevent retrying message from different organization', async () => {
        const org2EndUser = await context.factory.createEndUser(context.org2.name);
        const org2Chat = await context.factory.createChat(context.org2.name, org2EndUser.userId);
        const org2Message = await context.factory.createChatMessage(
          org2Chat.id,
          context.operatorUser.id,
          {
            isDelivered: false,
          },
        );

        const adminOp = await context.factory.createUser(context.org1.name, 'ADMIN_OPERATOR');
        const adminOpToken = context.authHelper.generateToken(adminOp.id);

        await context.client.queryExpectError(
          CHAT_QUERIES.RETRY_SEND_MESSAGE,
          ERROR_MESSAGES.NOT_FOUND,
          {
            retryMessageInput: ChatMessagesTestHelpers.createRetryMessageInput(
              org2Chat.id,
              org2Message.id,
            ),
          },
          adminOpToken,
        );
      });
    });

    describe('concurrent operations', () => {
      it('should handle multiple retry attempts on same message', async () => {
        const adminOp = await context.factory.createUser(context.org1.name, 'ADMIN_OPERATOR');
        const adminOpToken = context.authHelper.generateToken(adminOp.id);

        const response1 = await context.client.queryExpectSuccess(
          CHAT_QUERIES.RETRY_SEND_MESSAGE,
          {
            retryMessageInput: ChatMessagesTestHelpers.createRetryMessageInput(
              testChat.id,
              failedMessage.id,
            ),
          },
          adminOpToken,
        );
        expect(response1.retrySendMessage).toBeDefined();

        const response2 = await context.client.queryExpectSuccess(
          CHAT_QUERIES.RETRY_SEND_MESSAGE,
          {
            retryMessageInput: ChatMessagesTestHelpers.createRetryMessageInput(
              testChat.id,
              failedMessage.id,
            ),
          },
          adminOpToken,
        );
        expect(response2.retrySendMessage).toBeDefined();
      });
    });
  });
});
