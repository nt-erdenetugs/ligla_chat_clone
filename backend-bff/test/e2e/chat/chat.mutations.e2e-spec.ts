import { CHAT_QUERIES } from '../../fixtures/graphql/chat.queries';
import { TestValidators } from '../../utils/test-setup';

import {
  ChatTestContext,
  getSharedChatTestApp,
  cleanupSharedChatTestApp,
  setupChatTests,
} from './chat-test.setup';

const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized',
  NOT_AUTHORIZED: 'You are not authorized to change the status of this chat',
  PENDING_AGAIN: 'You cannot change the status to pending again',
  NOT_FOUND: 'not found',
  ACCESS_DENIED: 'Access denied to chat',
} as const;

const CHAT_STATUS = {
  PENDING: 'PENDING',
  ADDRESSING: 'ADDRESSING',
  DONE: 'DONE',
} as const;

const ACTIVITY_TYPES = {
  STATUS_CHANGE: 'STATUS_CHANGE',
  USER: 'USER',
} as const;

// Test Helper Class
class ChatMutationsTestHelpers {
  static createChatStatusInput(chatId: string, status: string) {
    return {
      chatId,
      status,
    };
  }

  static createChatLatestReadInput(chatId: string, timestamp: string) {
    return {
      chatId,
      timestamp,
    };
  }

  static validateStatusChangeResponse(
    response: any,
    chatId: string,
    expectedNewStatus: string,
    expectedOldStatus: string,
  ) {
    TestValidators.validateChatActivity(response, {
      chatId,
      activityType: ACTIVITY_TYPES.STATUS_CHANGE,
    });
    expect(response.newStatus).toBe(expectedNewStatus);
    expect(response.oldStatus).toBe(expectedOldStatus);
  }

  static validateActorInformation(response: any) {
    expect(response.actorId).toBeDefined();
    expect(response.actorUserName).toBeDefined();
    expect(response.actorType).toBe(ACTIVITY_TYPES.USER);
  }
}

describe('Chat Mutations (E2E)', () => {
  let context: ChatTestContext;

  beforeAll(async () => {
    const baseContext = await getSharedChatTestApp();
    context = await setupChatTests(baseContext, 'chat_mutations');
  });

  beforeEach(async () => {
    const updated = await setupChatTests(context, 'chat_mutations');
    Object.assign(context, updated);
  });

  afterEach(async () => {
    await context.cleaner.cleanChatTestData(context.tenantSchemaNames);
  });

  afterAll(async () => {
    await cleanupSharedChatTestApp();
  });

  describe('changeChatStatus', () => {
    let endUser: any;
    let testChat: any;

    beforeEach(async () => {
      endUser = await context.factory.createEndUser(context.org1.name);
      testChat = await context.factory.createChat(context.org1.name, endUser.userId, {
        chatStatus: CHAT_STATUS.PENDING,
        assignedUserId: context.operatorUser.id,
      });
    });

    describe('authorization', () => {
      it('should change chat status as ADMIN', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.CHANGE_CHAT_STATUS,
          {
            chatStatusInput: ChatMutationsTestHelpers.createChatStatusInput(
              testChat.id,
              CHAT_STATUS.ADDRESSING,
            ),
          },
          context.adminToken,
        );

        ChatMutationsTestHelpers.validateStatusChangeResponse(
          response.changeChatStatus,
          testChat.id,
          CHAT_STATUS.ADDRESSING,
          CHAT_STATUS.PENDING,
        );
      });

      it('should change chat status as MANAGER', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.CHANGE_CHAT_STATUS,
          {
            chatStatusInput: ChatMutationsTestHelpers.createChatStatusInput(
              testChat.id,
              CHAT_STATUS.ADDRESSING,
            ),
          },
          context.managerToken,
        );

        expect(response.changeChatStatus).toBeDefined();
        expect(response.changeChatStatus.newStatus).toBe(CHAT_STATUS.ADDRESSING);
      });

      it('should deny OPERATOR from changing status on unassigned chat', async () => {
        const anotherOperator = await context.factory.createUser(context.org1.name, 'OPERATOR');
        const unassignedChat = await context.factory.createChat(context.org1.name, endUser.userId, {
          chatStatus: CHAT_STATUS.PENDING,
          assignedUserId: anotherOperator.id,
        });

        await context.client.queryExpectError(
          CHAT_QUERIES.CHANGE_CHAT_STATUS,
          ERROR_MESSAGES.NOT_AUTHORIZED,
          {
            chatStatusInput: ChatMutationsTestHelpers.createChatStatusInput(
              unassignedChat.id,
              CHAT_STATUS.DONE,
            ),
          },
          context.operatorToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.CHANGE_CHAT_STATUS,
          ERROR_MESSAGES.UNAUTHORIZED,
          {
            chatStatusInput: ChatMutationsTestHelpers.createChatStatusInput(
              testChat.id,
              CHAT_STATUS.ADDRESSING,
            ),
          },
        );
      });
    });

    describe('status transitions', () => {
      it('should change chat status to DONE', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.CHANGE_CHAT_STATUS,
          {
            chatStatusInput: ChatMutationsTestHelpers.createChatStatusInput(
              testChat.id,
              CHAT_STATUS.DONE,
            ),
          },
          context.adminToken,
        );

        expect(response.changeChatStatus.newStatus).toBe(CHAT_STATUS.DONE);
      });

      it('should handle changing from ADDRESSING to DONE', async () => {
        const addressingChat = await context.factory.createChat(context.org1.name, endUser.userId, {
          chatStatus: CHAT_STATUS.ADDRESSING,
        });

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.CHANGE_CHAT_STATUS,
          {
            chatStatusInput: ChatMutationsTestHelpers.createChatStatusInput(
              addressingChat.id,
              CHAT_STATUS.DONE,
            ),
          },
          context.adminToken,
        );

        expect(response.changeChatStatus.oldStatus).toBe(CHAT_STATUS.ADDRESSING);
        expect(response.changeChatStatus.newStatus).toBe(CHAT_STATUS.DONE);
      });

      it('should pin read timestamps and clear unread when completing and reopening a chat', async () => {
        const endUser = await context.factory.createEndUser(context.org1.name);
        const chat = await context.factory.createChat(context.org1.name, endUser.userId, {
          chatStatus: CHAT_STATUS.ADDRESSING,
          assignedUserId: context.operatorUser.id,
        });
        const accessTeam = await context.factory.createTeam(context.org1.name);
        await context.factory.addUserToTeam(accessTeam.id, context.operatorUser.id);
        await context.factory.assignTeamToChat(chat.id, accessTeam.id);

        await context.factory.createChatMessage(chat.id, endUser.userId, {
          senderType: 'END_USER',
          isDelivered: true,
        });

        const before = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_HISTORY,
          { id: chat.id },
          context.operatorToken,
        );
        expect(before.chatHistory.chatUnreadCount).toBeGreaterThan(0);

        await context.client.queryExpectSuccess(
          CHAT_QUERIES.CHANGE_CHAT_STATUS,
          {
            chatStatusInput: ChatMutationsTestHelpers.createChatStatusInput(
              chat.id,
              CHAT_STATUS.DONE,
            ),
          },
          context.adminToken,
        );

        const afterDone = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_HISTORY,
          { id: chat.id },
          context.operatorToken,
        );
        expect(afterDone.chatHistory.chatUnreadCount).toBe(0);
        expect(new Date(afterDone.chatHistory.latestReadTimestamp).getTime()).toBeGreaterThan(
          new Date(afterDone.chatHistory.latestMessageTimestamp).getTime(),
        );

        await context.client.queryExpectSuccess(
          CHAT_QUERIES.CHANGE_CHAT_STATUS,
          {
            chatStatusInput: ChatMutationsTestHelpers.createChatStatusInput(
              chat.id,
              CHAT_STATUS.ADDRESSING,
            ),
          },
          context.adminToken,
        );

        const afterReopen = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_HISTORY,
          { id: chat.id },
          context.operatorToken,
        );
        expect(afterReopen.chatHistory.chatUnreadCount).toBe(0);
        expect(new Date(afterReopen.chatHistory.latestReadTimestamp).getTime()).toBeGreaterThan(
          new Date(afterReopen.chatHistory.latestMessageTimestamp).getTime(),
        );
      });
    });

    describe('validation', () => {
      it('should reject changing status to PENDING', async () => {
        const addressingChat = await context.factory.createChat(context.org1.name, endUser.userId, {
          chatStatus: CHAT_STATUS.ADDRESSING,
        });

        await context.client.queryExpectError(
          CHAT_QUERIES.CHANGE_CHAT_STATUS,
          ERROR_MESSAGES.PENDING_AGAIN,
          {
            chatStatusInput: ChatMutationsTestHelpers.createChatStatusInput(
              addressingChat.id,
              CHAT_STATUS.PENDING,
            ),
          },
          context.adminToken,
        );
      });

      it('should reject changing status to same status', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.CHANGE_CHAT_STATUS,
          ERROR_MESSAGES.PENDING_AGAIN,
          {
            chatStatusInput: ChatMutationsTestHelpers.createChatStatusInput(
              testChat.id,
              CHAT_STATUS.PENDING,
            ),
          },
          context.adminToken,
        );
      });

      it('should reject non-existent chat', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.CHANGE_CHAT_STATUS,
          ERROR_MESSAGES.NOT_FOUND,
          {
            chatStatusInput: ChatMutationsTestHelpers.createChatStatusInput(
              '00000000-0000-0000-0000-000000000000',
              CHAT_STATUS.ADDRESSING,
            ),
          },
          context.adminToken,
        );
      });
    });

    describe('multi-tenancy', () => {
      it('should prevent cross-organization status change', async () => {
        const org2Chat = await context.factory.createChat(context.org2.name, endUser.userId);

        await context.client.queryExpectError(
          CHAT_QUERIES.CHANGE_CHAT_STATUS,
          ERROR_MESSAGES.NOT_FOUND,
          {
            chatStatusInput: ChatMutationsTestHelpers.createChatStatusInput(
              org2Chat.id,
              CHAT_STATUS.ADDRESSING,
            ),
          },
          context.adminToken,
        );
      });
    });

    describe('activity tracking', () => {
      it('should create activity with actor information', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.CHANGE_CHAT_STATUS,
          {
            chatStatusInput: ChatMutationsTestHelpers.createChatStatusInput(
              testChat.id,
              CHAT_STATUS.ADDRESSING,
            ),
          },
          context.adminToken,
        );

        ChatMutationsTestHelpers.validateActorInformation(response.changeChatStatus);
      });
    });
  });

  describe('updateChatLatestRead', () => {
    let endUser: any;
    let testChat: any;

    beforeEach(async () => {
      endUser = await context.factory.createEndUser(context.org1.name);
      testChat = await context.factory.createChat(context.org1.name, endUser.userId);
      await context.factory.assignUserToChat(testChat.id, context.operatorUser.id);
    });

    describe('successful updates', () => {
      it('should allow assigned OPERATOR to update chat latest read', async () => {
        const timestamp = new Date();
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.UPDATE_CHAT_LATEST_READ,
          {
            chatLatestReadInput: ChatMutationsTestHelpers.createChatLatestReadInput(
              testChat.id,
              timestamp.toISOString(),
            ),
          },
          context.operatorToken,
        );

        expect(response.updateChatLatestRead).toBeDefined();
      });

      it('should update multiple times with different timestamps', async () => {
        const chat = await context.factory.createChat(context.org1.name, endUser.userId);
        await context.factory.assignUserToChat(chat.id, context.operatorUser.id);

        const timestamp1 = new Date(Date.now() - 1000);
        await context.client.queryExpectSuccess(
          CHAT_QUERIES.UPDATE_CHAT_LATEST_READ,
          {
            chatLatestReadInput: ChatMutationsTestHelpers.createChatLatestReadInput(
              chat.id,
              timestamp1.toISOString(),
            ),
          },
          context.operatorToken,
        );

        const timestamp2 = new Date();
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.UPDATE_CHAT_LATEST_READ,
          {
            chatLatestReadInput: ChatMutationsTestHelpers.createChatLatestReadInput(
              chat.id,
              timestamp2.toISOString(),
            ),
          },
          context.operatorToken,
        );

        expect(response.updateChatLatestRead).toBeDefined();
      });
    });

    describe('authorization', () => {
      it('should forbid ADMIN from updating chat latest read when not assigned', async () => {
        const timestamp = new Date();
        await context.client.queryExpectError(
          CHAT_QUERIES.UPDATE_CHAT_LATEST_READ,
          ERROR_MESSAGES.ACCESS_DENIED,
          {
            chatLatestReadInput: ChatMutationsTestHelpers.createChatLatestReadInput(
              testChat.id,
              timestamp.toISOString(),
            ),
          },
          context.adminToken,
        );
      });

      it('should not allow unassigned OPERATOR to update chat latest read', async () => {
        const timestamp = new Date();
        const unassignedOperator = await context.factory.createUser(context.org1.name, 'OPERATOR');
        const unassignedOperatorToken = context.authHelper.generateToken(unassignedOperator.id);

        await context.client.queryExpectError(
          CHAT_QUERIES.UPDATE_CHAT_LATEST_READ,
          ERROR_MESSAGES.ACCESS_DENIED,
          {
            chatLatestReadInput: ChatMutationsTestHelpers.createChatLatestReadInput(
              testChat.id,
              timestamp.toISOString(),
            ),
          },
          unassignedOperatorToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        const timestamp = new Date();

        await context.client.queryExpectError(
          CHAT_QUERIES.UPDATE_CHAT_LATEST_READ,
          ERROR_MESSAGES.UNAUTHORIZED,
          {
            chatLatestReadInput: ChatMutationsTestHelpers.createChatLatestReadInput(
              testChat.id,
              timestamp.toISOString(),
            ),
          },
        );
      });
    });

    describe('validation', () => {
      it('should handle chat with future timestamp', async () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        const chat = await context.factory.createChat(context.org1.name, endUser.userId);
        await context.factory.assignUserToChat(chat.id, context.operatorUser.id);
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.UPDATE_CHAT_LATEST_READ,
          {
            chatLatestReadInput: ChatMutationsTestHelpers.createChatLatestReadInput(
              chat.id,
              futureDate.toISOString(),
            ),
          },
          context.operatorToken,
        );

        expect(response.updateChatLatestRead).toBeDefined();
      });

      it('should handle chat with past timestamp from 1970', async () => {
        const oldDate = new Date('1970-01-01T00:00:00Z');

        const chat = await context.factory.createChat(context.org1.name, endUser.userId);
        await context.factory.assignUserToChat(chat.id, context.operatorUser.id);
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.UPDATE_CHAT_LATEST_READ,
          {
            chatLatestReadInput: ChatMutationsTestHelpers.createChatLatestReadInput(
              chat.id,
              oldDate.toISOString(),
            ),
          },
          context.operatorToken,
        );

        expect(response.updateChatLatestRead).toBeDefined();
      });

      it('should handle non-existent chat', async () => {
        const timestamp = new Date();

        await context.client.queryExpectError(
          CHAT_QUERIES.UPDATE_CHAT_LATEST_READ,
          ERROR_MESSAGES.NOT_FOUND,
          {
            chatLatestReadInput: ChatMutationsTestHelpers.createChatLatestReadInput(
              '00000000-0000-0000-0000-000000000000',
              timestamp.toISOString(),
            ),
          },
          context.operatorToken,
        );
      });
    });

    describe('multi-tenancy', () => {
      it('should prevent cross-organization access', async () => {
        const org2Chat = await context.factory.createChat(context.org2.name, endUser.userId);
        const timestamp = new Date();

        await context.client.queryExpectError(
          CHAT_QUERIES.UPDATE_CHAT_LATEST_READ,
          ERROR_MESSAGES.NOT_FOUND,
          {
            chatLatestReadInput: ChatMutationsTestHelpers.createChatLatestReadInput(
              org2Chat.id,
              timestamp.toISOString(),
            ),
          },
          context.adminToken,
        );
      });
    });
  });
});
