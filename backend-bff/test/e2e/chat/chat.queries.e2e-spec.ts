import { CHAT_QUERIES } from '../../fixtures/graphql/chat.queries';
import {
  getMockStorageCalls,
  resetMockStorage,
  setMockStorageFile,
} from '../../mocks/google-cloud-storage.mock';
import { TestValidators } from '../../utils/test-setup';

import {
  ChatTestContext,
  getSharedChatTestApp,
  cleanupSharedChatTestApp,
  setupChatTests,
} from './chat-test.setup';

jest.mock('@google-cloud/storage', () =>
  jest.requireActual('../../mocks/google-cloud-storage.mock'),
);

const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized',
  CHAT_NOT_FOUND: 'Chat not found',
} as const;

const CHAT_STATUS = {
  PENDING: 'PENDING',
  ADDRESSING: 'ADDRESSING',
  DONE: 'DONE',
} as const;

const CURSOR_DIRECTION = {
  FORWARD: 'FORWARD',
  BACKWARD: 'BACKWARD',
} as const;

const ITEM_TYPE = {
  MESSAGE: 'MESSAGE',
  ACTIVITY: 'ACTIVITY',
} as const;

const ACTIVITY_TYPE = {
  STATUS_CHANGE: 'STATUS_CHANGE',
} as const;

// Test Helper Class
class ChatQueriesTestHelpers {
  static createChatFilterInput(
    options: {
      statuses?: string[];
      teamIds?: string[];
      userIds?: string[];
      tagIds?: string[];
      includeUnassigned?: boolean;
    } = {},
  ) {
    return options;
  }

  static createPaginationInput(
    options: {
      take?: number;
      cursorId?: string;
      cursorCreatedAt?: string;
      cursorDateParam?: string;
    } = {},
  ) {
    return options;
  }

  static createChatDataInput(
    chatId: string,
    cursorDirection: string,
    options: {
      take?: number;
      cursorId?: string;
      cursorCreatedAt?: string;
    } = {},
  ) {
    return {
      chatId,
      cursorDirection,
      ...options,
    };
  }

  static validateChatList(chats: any, minCount?: number) {
    TestValidators.validatePagination(chats);
    if (minCount !== undefined) {
      expect(chats.items.length).toBeGreaterThanOrEqual(minCount);
    }
  }

  static validateChatItem(chat: any, expectedFields: any = {}) {
    TestValidators.validateChat(chat, expectedFields);
  }
}

describe('Chat Queries (E2E)', () => {
  let context: ChatTestContext;

  beforeAll(async () => {
    const baseContext = await getSharedChatTestApp();
    context = await setupChatTests(baseContext, 'chat_queries');
  });

  beforeEach(async () => {
    const updated = await setupChatTests(context, 'chat_queries');
    Object.assign(context, updated);
    resetMockStorage();
  });

  afterEach(async () => {
    await context.cleaner.cleanChatTestData(context.tenantSchemaNames);
  });

  afterAll(async () => {
    await cleanupSharedChatTestApp();
  });

  describe('chats (list)', () => {
    let endUser: any;
    let chat1: any;
    let chat2: any;

    beforeEach(async () => {
      endUser = await context.factory.createEndUser(context.org1.name);
      chat1 = await context.factory.createChat(context.org1.name, endUser.userId, {
        chatStatus: CHAT_STATUS.PENDING,
      });
      chat2 = await context.factory.createChat(context.org1.name, endUser.userId, {
        chatStatus: CHAT_STATUS.ADDRESSING,
      });
      await context.factory.createChat(context.org2.name, endUser.userId, {
        chatStatus: CHAT_STATUS.PENDING,
      });
    });

    describe('authorization', () => {
      it('should list chats for organization as ADMIN', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHATS,
          {},
          context.adminToken,
        );

        ChatQueriesTestHelpers.validateChatList(response.chats, 2);
        response.chats.items.forEach((chat: any) => {
          ChatQueriesTestHelpers.validateChatItem(chat, {});
        });
      });

      it('should list chats as MANAGER', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHATS,
          {},
          context.managerToken,
        );

        TestValidators.validatePagination(response.chats);
      });

      it('should list chats as OPERATOR', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHATS,
          {},
          context.operatorToken,
        );

        TestValidators.validatePagination(response.chats);
      });

      it('should return empty list for OPERATOR without teams', async () => {
        const teamlessOperator = await context.factory.createUser(context.org1.name, 'OPERATOR');
        const teamlessOperatorToken = await context.authHelper.getToken(teamlessOperator.email);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHATS,
          {},
          teamlessOperatorToken,
        );

        expect(response.chats.items).toEqual([]);
        expect(response.chats.hasMore).toBe(false);
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.GET_CHATS,
          ERROR_MESSAGES.UNAUTHORIZED,
          {},
        );
      });
    });

    describe('pagination', () => {
      it('should support cursor pagination', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHATS,
          ChatQueriesTestHelpers.createPaginationInput({ take: 1 }),
          context.adminToken,
        );

        expect(response.chats.items.length).toBeLessThanOrEqual(1);
        expect(typeof response.chats.hasMore).toBe('boolean');
      });

      it('should handle cursor pagination through all pages', async () => {
        for (let i = 0; i < 5; i++) {
          await context.factory.createChat(context.org1.name, endUser.userId);
        }

        const firstPage = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHATS,
          ChatQueriesTestHelpers.createPaginationInput({ take: 2 }),
          context.adminToken,
        );

        expect(firstPage.chats.items.length).toBe(2);
        expect(firstPage.chats.hasMore).toBe(true);

        const secondPage = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHATS,
          ChatQueriesTestHelpers.createPaginationInput({
            take: 2,
            cursorId: firstPage.chats.nextCursorId,
            cursorCreatedAt: firstPage.chats.nextCursorCreatedAt,
            cursorDateParam: firstPage.chats.nextCursorDateParam,
          }),
          context.adminToken,
        );

        expect(secondPage.chats.items.length).toBeGreaterThan(0);
        const firstPageIds = firstPage.chats.items.map((c: any) => c.id);
        const secondPageIds = secondPage.chats.items.map((c: any) => c.id);
        const intersection = firstPageIds.filter((id: string) => secondPageIds.includes(id));
        expect(intersection.length).toBe(0);
      });

      it('should reject pagination with take=0', async () => {
        await context.factory.createChat(context.org1.name, endUser.userId);

        await context.client.queryExpectError(
          CHAT_QUERIES.GET_CHATS,
          'take must not be less than 1',
          ChatQueriesTestHelpers.createPaginationInput({ take: 0 }),
          context.adminToken,
        );
      });

      it('should reject pagination with very large take value', async () => {
        await context.factory.createChat(context.org1.name, endUser.userId);

        await context.client.queryExpectError(
          CHAT_QUERIES.GET_CHATS,
          'take must not be greater than 100',
          ChatQueriesTestHelpers.createPaginationInput({ take: 10000 }),
          context.adminToken,
        );
      });
    });

    describe('multi-tenancy', () => {
      it('should not list chats from other organizations', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHATS,
          {},
          context.adminToken,
        );

        expect(
          response.chats.items.every((chat: any) => chat.id === chat1.id || chat.id === chat2.id),
        ).toBe(true);
      });
    });

    describe('filtering', () => {
      it('should handle empty result set gracefully', async () => {
        const emptyOrg = await context.factory.createOrganization({ name: 'empty_org' });
        const emptyAdmin = await context.factory.createUser(emptyOrg.name, 'ADMIN');
        const emptyAdminToken = context.authHelper.generateToken(emptyAdmin.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHATS,
          {},
          emptyAdminToken,
        );

        TestValidators.validatePagination(response.chats, 0, false);
      });

      it('should filter by chat status', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHATS,
          {
            filter: ChatQueriesTestHelpers.createChatFilterInput({
              statuses: [CHAT_STATUS.PENDING],
            }),
          },
          context.adminToken,
        );

        TestValidators.validatePagination(response.chats);
        response.chats.items.forEach((chat: any) => {
          ChatQueriesTestHelpers.validateChatItem(chat, { chatStatus: CHAT_STATUS.PENDING });
        });
      });

      it('should filter by multiple statuses', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHATS,
          {
            filter: ChatQueriesTestHelpers.createChatFilterInput({
              statuses: [CHAT_STATUS.PENDING, CHAT_STATUS.ADDRESSING],
            }),
          },
          context.adminToken,
        );

        TestValidators.validatePagination(response.chats);
        response.chats.items.forEach((chat: any) => {
          expect([CHAT_STATUS.PENDING, CHAT_STATUS.ADDRESSING]).toContain(chat.chatStatus);
        });
      });
    });
  });

  describe('chatHistory (single)', () => {
    let endUser: any;
    let testChat: any;

    beforeEach(async () => {
      endUser = await context.factory.createEndUser(context.org1.name);
      testChat = await context.factory.createChat(context.org1.name, endUser.userId);
      const accessTeam = await context.factory.createTeam(context.org1.name);
      await context.factory.addUserToTeam(accessTeam.id, context.managerUser.id);
      await context.factory.addUserToTeam(accessTeam.id, context.operatorUser.id);
      await context.factory.assignTeamToChat(testChat.id, accessTeam.id);
    });

    describe('authorization', () => {
      it('should get single chat as ADMIN', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_HISTORY,
          { id: testChat.id },
          context.adminToken,
        );

        ChatQueriesTestHelpers.validateChatItem(response.chatHistory, {
          endUserId: endUser.userId,
        });
        expect(response.chatHistory.id).toBe(testChat.id);
      });

      it('should get single chat as MANAGER', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_HISTORY,
          { id: testChat.id },
          context.managerToken,
        );

        ChatQueriesTestHelpers.validateChatItem(response.chatHistory, {});
        expect(response.chatHistory.id).toBe(testChat.id);
      });

      it('should get single chat as OPERATOR', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_HISTORY,
          { id: testChat.id },
          context.operatorToken,
        );

        ChatQueriesTestHelpers.validateChatItem(response.chatHistory, {});
        expect(response.chatHistory.id).toBe(testChat.id);
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.GET_CHAT_HISTORY,
          ERROR_MESSAGES.UNAUTHORIZED,
          {
            id: testChat.id,
          },
        );
      });
    });

    describe('validation', () => {
      it('should return error for non-existent chat', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.GET_CHAT_HISTORY,
          ERROR_MESSAGES.CHAT_NOT_FOUND,
          { id: '00000000-0000-0000-0000-000000000000' },
          context.adminToken,
        );
      });
    });

    describe('chat details', () => {
      it('should include chat messages in response', async () => {
        await context.factory.createChatMessage(testChat.id, context.operatorUser.id, {
          content: JSON.stringify({ text: 'Test message 1' }),
          senderType: 'OPERATOR',
        });
        await context.factory.createChatMessage(testChat.id, context.operatorUser.id, {
          content: JSON.stringify({ text: 'Test message 2' }),
          senderType: 'OPERATOR',
        });

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_HISTORY,
          { id: testChat.id },
          context.adminToken,
        );

        expect(response.chatHistory.chatMessages).toBeInstanceOf(Array);
        expect(response.chatHistory.chatMessages.length).toBeGreaterThanOrEqual(1);

        // Validate the structure of the first message
        const firstMessage = response.chatHistory.chatMessages[0];
        TestValidators.validateChatMessage(firstMessage, {
          chatId: testChat.id,
          senderType: 'OPERATOR',
        });
      });

      it('should include chat tags in response', async () => {
        const tag = await context.factory.createTag(context.org1.name, { name: 'Important Tag' });
        await context.factory.linkTagToChat(testChat.id, tag.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_HISTORY,
          { id: testChat.id },
          context.adminToken,
        );

        expect(response.chatHistory.chatTags).toBeInstanceOf(Array);
        expect(response.chatHistory.chatTags.length).toBe(1);

        const chatTag = response.chatHistory.chatTags[0];
        expect(chatTag.tagId).toBe(tag.id);
        expect(chatTag.tag).toBeDefined();
        TestValidators.validateTag(chatTag.tag, { name: 'Important Tag' });
      });

      it('should include assigned user information', async () => {
        const assignedChat = await context.factory.createChat(context.org1.name, endUser.userId);
        await context.factory.assignUserToChat(assignedChat.id, context.operatorUser.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_HISTORY,
          { id: assignedChat.id },
          context.adminToken,
        );

        expect(response.chatHistory.assignedUser).toBeDefined();
        expect(response.chatHistory.assignedUser.id).toBe(context.operatorUser.id);

        // Validate basic user fields (chat context may not return all user fields)
        const assignedUser = response.chatHistory.assignedUser;
        expect(assignedUser.id).toBeDefined();
        expect(typeof assignedUser.id).toBe('string');
        expect(assignedUser.email).toBeDefined();
        expect(assignedUser.displayName).toBeDefined();
      });

      it('should handle chat with null latestReadTimestamp', async () => {
        const chat = await context.factory.createChat(context.org1.name, endUser.userId, {
          latestReadTimestamp: null,
        });

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_HISTORY,
          { id: chat.id },
          context.adminToken,
        );

        ChatQueriesTestHelpers.validateChatItem(response.chatHistory, {});
      });

      it('should maintain chat unread count accuracy', async () => {
        await context.factory.createChatMessage(testChat.id, context.operatorUser.id, {
          senderType: 'OPERATOR',
          isDelivered: true,
        });

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_HISTORY,
          { id: testChat.id },
          context.adminToken,
        );

        expect(response.chatHistory.chatUnreadCount).toBeGreaterThanOrEqual(0);
        expect(typeof response.chatHistory.chatUnreadCount).toBe('number');
      });

      it('should convert same-tenant gs image and preview URLs to data URIs', async () => {
        const imageContent = 'same-tenant-image';
        const previewContent = 'same-tenant-preview';
        const imagePath = `${context.org1.name}/images/U1234567890abcdef1234567890abcdef/test-message-1710000000.jpg`;
        const previewPath = `${context.org1.name}/previews/U1234567890abcdef1234567890abcdef/test-message-1710000000.jpg`;
        const bucketName = process.env.GCP_STORAGE_CHAT_DATA_BUCKET || 'ligla-chat-data-test';

        setMockStorageFile(bucketName, imagePath, { content: imageContent });
        setMockStorageFile(bucketName, previewPath, { content: previewContent });

        const createdMessage = await context.factory.createChatMessage(
          testChat.id,
          context.operatorUser.id,
          {
            type: 'IMAGE',
            content: JSON.stringify({
              image: `gs://${bucketName}/${imagePath}`,
              previewImageUrl: `gs://${bucketName}/${previewPath}`,
            }),
          },
        );

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_DATA,
          ChatQueriesTestHelpers.createChatDataInput(testChat.id, CURSOR_DIRECTION.BACKWARD),
          context.adminToken,
        );

        const messageItem = response.chatData.items.find(
          (item: any) => item.message?.id === createdMessage.id,
        );
        expect(messageItem?.message.content).toBe(
          `data:image/jpg;base64, ${Buffer.from(imageContent).toString('base64')}`,
        );
        expect(messageItem?.message.previewImageUrl).toBe(
          `data:image/jpg;base64,${Buffer.from(previewContent).toString('base64')}`,
        );

        expect(getMockStorageCalls().download).toEqual([
          { bucketName, filePath: imagePath },
          { bucketName, filePath: previewPath },
        ]);
      });

      it('should block cross-tenant gs image and preview downloads', async () => {
        const imagePath = `${context.org2.name}/images/U1234567890abcdef1234567890abcdef/test-message-1710000001.jpg`;
        const previewPath = `${context.org2.name}/previews/U1234567890abcdef1234567890abcdef/test-message-1710000001.jpg`;
        const bucketName = process.env.GCP_STORAGE_CHAT_DATA_BUCKET || 'ligla-chat-data-test';

        setMockStorageFile(bucketName, imagePath, { content: 'cross-tenant-image' });
        setMockStorageFile(bucketName, previewPath, { content: 'cross-tenant-preview' });

        const createdMessage = await context.factory.createChatMessage(
          testChat.id,
          context.operatorUser.id,
          {
            type: 'IMAGE',
            content: JSON.stringify({
              image: `gs://${bucketName}/${imagePath}`,
              previewImageUrl: `gs://${bucketName}/${previewPath}`,
            }),
          },
        );

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_DATA,
          ChatQueriesTestHelpers.createChatDataInput(testChat.id, CURSOR_DIRECTION.BACKWARD),
          context.adminToken,
        );

        const messageItem = response.chatData.items.find(
          (item: any) => item.message?.id === createdMessage.id,
        );
        expect(messageItem?.message.content).toBe('');
        expect(messageItem?.message.previewImageUrl).toBe(`gs://${bucketName}/${previewPath}`);
        expect(getMockStorageCalls().download).toEqual([]);
      });
    });
  });

  describe('chatCount', () => {
    let endUser: any;

    beforeEach(async () => {
      endUser = await context.factory.createEndUser(context.org1.name);
      await context.factory.createChat(context.org1.name, endUser.userId);
      await context.factory.createChat(context.org1.name, endUser.userId);
      await context.factory.createChat(context.org2.name, endUser.userId);
    });

    describe('authorization', () => {
      it('should count chats for organization as ADMIN', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_COUNT,
          {},
          context.adminToken,
        );

        expect(response.chatCount).toBeGreaterThanOrEqual(2);
      });

      it('should count chats as MANAGER', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_COUNT,
          {},
          context.managerToken,
        );

        expect(typeof response.chatCount).toBe('number');
      });

      it('should count chats as OPERATOR', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_COUNT,
          {},
          context.operatorToken,
        );

        expect(typeof response.chatCount).toBe('number');
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.GET_CHAT_COUNT,
          ERROR_MESSAGES.UNAUTHORIZED,
          {},
        );
      });
    });

    describe('multi-tenancy', () => {
      it('should not leak count from other organizations', async () => {
        const org1Count = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_COUNT,
          {},
          context.adminToken,
        );

        const org2Count = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_COUNT,
          {},
          context.org2AdminToken,
        );

        expect(org1Count.chatCount).not.toBe(org2Count.chatCount);
      });
    });
  });

  describe('unassignedChatCount', () => {
    let endUser: any;

    beforeEach(async () => {
      endUser = await context.factory.createEndUser(context.org1.name);
      await context.factory.createChat(context.org1.name, endUser.userId);
      const createdChat = await context.factory.createChat(context.org1.name, endUser.userId);
      await context.factory.assignUserToChat(createdChat.id, context.operatorUser.id);
    });

    describe('authorization', () => {
      it('should count unassigned chats as ADMIN', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_UNASSIGNED_CHAT_COUNT,
          {},
          context.adminToken,
        );

        expect(response.unassignedChatCount).toBeGreaterThanOrEqual(1);
      });

      it('should count unassigned chats as MANAGER', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_UNASSIGNED_CHAT_COUNT,
          {},
          context.managerToken,
        );

        expect(typeof response.unassignedChatCount).toBe('number');
      });

      it('should count unassigned chats as OPERATOR', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_UNASSIGNED_CHAT_COUNT,
          {},
          context.operatorToken,
        );

        expect(typeof response.unassignedChatCount).toBe('number');
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.GET_UNASSIGNED_CHAT_COUNT,
          ERROR_MESSAGES.UNAUTHORIZED,
          {},
        );
      });
    });
  });

  describe('chatData', () => {
    let endUser: any;
    let testChat: any;

    beforeEach(async () => {
      endUser = await context.factory.createEndUser(context.org1.name);
      testChat = await context.factory.createChat(context.org1.name, endUser.userId);
    });

    describe('basic functionality', () => {
      it('should get chat data with messages and activities', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_DATA,
          ChatQueriesTestHelpers.createChatDataInput(testChat.id, CURSOR_DIRECTION.BACKWARD),
          context.adminToken,
        );

        TestValidators.validatePagination(response.chatData);
      });

      it('should support cursor pagination', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_DATA,
          ChatQueriesTestHelpers.createChatDataInput(testChat.id, CURSOR_DIRECTION.BACKWARD, {
            take: 10,
          }),
          context.adminToken,
        );

        expect(response.chatData.items.length).toBeLessThanOrEqual(10);
      });

      it('should allow OPERATOR to get chat data', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_DATA,
          ChatQueriesTestHelpers.createChatDataInput(testChat.id, CURSOR_DIRECTION.BACKWARD),
          context.operatorToken,
        );

        TestValidators.validatePagination(response.chatData);
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.GET_CHAT_DATA,
          ERROR_MESSAGES.UNAUTHORIZED,
          ChatQueriesTestHelpers.createChatDataInput(testChat.id, CURSOR_DIRECTION.BACKWARD),
        );
      });
    });

    describe('cursor directions', () => {
      it('should support FORWARD cursor direction', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_DATA,
          ChatQueriesTestHelpers.createChatDataInput(testChat.id, CURSOR_DIRECTION.FORWARD),
          context.adminToken,
        );

        TestValidators.validatePagination(response.chatData);
      });

      it('should handle FORWARD pagination from specific cursor', async () => {
        for (let i = 0; i < 5; i++) {
          await context.factory.createChatMessage(testChat.id, context.operatorUser.id, {
            content: JSON.stringify({ text: `Message ${i}` }),
          });
        }

        const firstPage = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_DATA,
          ChatQueriesTestHelpers.createChatDataInput(testChat.id, CURSOR_DIRECTION.FORWARD, {
            take: 2,
          }),
          context.adminToken,
        );

        expect(firstPage.chatData.items.length).toBeLessThanOrEqual(2);

        if (firstPage.chatData.nextCursorId) {
          const secondPage = await context.client.queryExpectSuccess(
            CHAT_QUERIES.GET_CHAT_DATA,
            ChatQueriesTestHelpers.createChatDataInput(testChat.id, CURSOR_DIRECTION.FORWARD, {
              take: 2,
              cursorId: firstPage.chatData.nextCursorId,
              cursorCreatedAt: firstPage.chatData.nextCursorCreatedAt,
            }),
            context.adminToken,
          );

          expect(secondPage.chatData.items.length).toBeGreaterThan(0);
        }
      });
    });

    describe('messages and activities', () => {
      it('should combine messages and activities in correct order', async () => {
        await context.factory.createChatMessage(testChat.id, context.operatorUser.id, {
          senderType: 'OPERATOR',
          content: JSON.stringify({ text: 'Test message' }),
        });

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_DATA,
          ChatQueriesTestHelpers.createChatDataInput(testChat.id, CURSOR_DIRECTION.BACKWARD, {
            take: 50,
          }),
          context.adminToken,
        );

        TestValidators.validatePagination(response.chatData);
        response.chatData.items.forEach((item: any) => {
          expect([ITEM_TYPE.MESSAGE, ITEM_TYPE.ACTIVITY]).toContain(item.itemType);

          // Validate message structure if it's a message
          if (item.itemType === ITEM_TYPE.MESSAGE) {
            TestValidators.validateChatMessage(item.message, {
              chatId: testChat.id,
            });
          }

          // Validate activity structure if it's an activity
          if (item.itemType === ITEM_TYPE.ACTIVITY) {
            TestValidators.validateChatActivity(item.activity, {
              chatId: testChat.id,
            });
          }
        });
      });

      it('should handle empty chat data', async () => {
        const emptyChat = await context.factory.createChat(context.org1.name, endUser.userId);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_DATA,
          ChatQueriesTestHelpers.createChatDataInput(emptyChat.id, CURSOR_DIRECTION.BACKWARD),
          context.adminToken,
        );

        TestValidators.validatePagination(response.chatData, undefined, false);
      });

      it('should paginate with cursorCreatedAt to filter activities', async () => {
        await context.factory.createChatMessage(testChat.id, context.operatorUser.id);

        const recentDate = new Date();

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_DATA,
          ChatQueriesTestHelpers.createChatDataInput(testChat.id, CURSOR_DIRECTION.BACKWARD, {
            cursorCreatedAt: recentDate.toISOString(),
          }),
          context.adminToken,
        );

        TestValidators.validatePagination(response.chatData);
      });

      it('should handle cursor pagination with many messages and activities', async () => {
        // Create a large number of messages and activities to test pagination thoroughly
        const messageCount = 50;
        const pageSize = 10;

        // Create messages in batches with activities interspersed
        for (let i = 0; i < messageCount; i++) {
          await context.factory.createChatMessage(testChat.id, context.operatorUser.id, {
            content: JSON.stringify({ text: `Test message ${i + 1}`, type: 'text' }),
            senderType: 'OPERATOR',
          });

          // Add a status change activity every 10 messages (toggle between ADDRESSING and DONE)
          if ((i + 1) % 10 === 0) {
            await context.client.queryExpectSuccess(
              CHAT_QUERIES.CHANGE_CHAT_STATUS,
              {
                chatStatusInput: {
                  chatId: testChat.id,
                  status: i % 20 === 9 ? CHAT_STATUS.ADDRESSING : CHAT_STATUS.DONE,
                },
              },
              context.adminToken,
            );
          }
        }

        // Track all retrieved items to ensure no duplicates and all items are retrieved
        const allItems: any[] = [];
        const allItemIds = new Set<string>();
        let hasMore = true;
        let cursorId: string | undefined;
        let cursorCreatedAt: string | undefined;
        let pageCount = 0;

        // Paginate through all items using BACKWARD direction
        while (hasMore) {
          const response = await context.client.queryExpectSuccess(
            CHAT_QUERIES.GET_CHAT_DATA,
            ChatQueriesTestHelpers.createChatDataInput(testChat.id, CURSOR_DIRECTION.BACKWARD, {
              take: pageSize,
              cursorId,
              cursorCreatedAt,
            }),
            context.adminToken,
          );

          pageCount++;
          TestValidators.validatePagination(response.chatData);

          // Verify no items in this page are duplicates
          response.chatData.items.forEach((item: any) => {
            expect(item).toBeDefined();
            expect(item.id).toBeDefined();
            expect(item.itemType).toBeDefined();
            expect([ITEM_TYPE.MESSAGE, ITEM_TYPE.ACTIVITY]).toContain(item.itemType);

            // Check for duplicates
            expect(allItemIds.has(item.id)).toBe(false);
            allItemIds.add(item.id);
            allItems.push(item);

            // Validate structure based on item type
            if (item.itemType === ITEM_TYPE.MESSAGE) {
              TestValidators.validateChatMessage(item.message, {
                chatId: testChat.id,
              });
            } else if (item.itemType === ITEM_TYPE.ACTIVITY) {
              TestValidators.validateChatActivity(item.activity, {
                chatId: testChat.id,
              });
            }
          });

          // Update cursor for next page
          hasMore = response.chatData.hasMore;
          cursorId = response.chatData.nextCursorId;
          cursorCreatedAt = response.chatData.nextCursorCreatedAt;

          // Safety check to prevent infinite loops
          expect(pageCount).toBeLessThan(100);
        }

        // Verify we retrieved all messages and activities
        const messages = allItems.filter((item) => item.itemType === ITEM_TYPE.MESSAGE);
        const activities = allItems.filter((item) => item.itemType === ITEM_TYPE.ACTIVITY);

        expect(messages.length).toBe(messageCount);
        expect(activities.length).toBeGreaterThanOrEqual(5); // At least 5 status changes
        expect(allItems.length).toBe(messages.length + activities.length);
        expect(pageCount).toBeGreaterThan(1); // Should have multiple pages

        // Verify chronological ordering (BACKWARD means newest first)
        for (let i = 0; i < allItems.length - 1; i++) {
          const currentDate = new Date(allItems[i].createdAt);
          const nextDate = new Date(allItems[i + 1].createdAt);
          expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
        }
      });

      it('should handle cursor pagination in FORWARD direction with many items', async () => {
        // Create messages and activities
        const messageCount = 30;
        const pageSize = 8;

        // Create all messages first
        for (let i = 0; i < messageCount; i++) {
          await context.factory.createChatMessage(testChat.id, context.operatorUser.id, {
            content: JSON.stringify({ text: `Forward test message ${i + 1}`, type: 'text' }),
            senderType: 'OPERATOR',
          });
        }

        // Add a couple of status changes after messages are created
        await context.client.queryExpectSuccess(
          CHAT_QUERIES.CHANGE_CHAT_STATUS,
          {
            chatStatusInput: {
              chatId: testChat.id,
              status: CHAT_STATUS.ADDRESSING,
            },
          },
          context.adminToken,
        );

        await context.client.queryExpectSuccess(
          CHAT_QUERIES.CHANGE_CHAT_STATUS,
          {
            chatStatusInput: {
              chatId: testChat.id,
              status: CHAT_STATUS.DONE,
            },
          },
          context.adminToken,
        );

        // Paginate forward through all items
        const allItems: any[] = [];
        const allItemIds = new Set<string>();
        let hasMore = true;
        let cursorId: string | undefined;
        let cursorCreatedAt: string | undefined;
        let pageCount = 0;

        while (hasMore) {
          const response = await context.client.queryExpectSuccess(
            CHAT_QUERIES.GET_CHAT_DATA,
            ChatQueriesTestHelpers.createChatDataInput(testChat.id, CURSOR_DIRECTION.FORWARD, {
              take: pageSize,
              cursorId,
              cursorCreatedAt,
            }),
            context.adminToken,
          );

          pageCount++;
          TestValidators.validatePagination(response.chatData);

          response.chatData.items.forEach((item: any) => {
            // Check for duplicates - if found, log details for debugging
            if (allItemIds.has(item.id)) {
              console.error(`Duplicate item found: ${item.id}, type: ${item.itemType}`);
            }
            expect(allItemIds.has(item.id)).toBe(false);
            allItemIds.add(item.id);
            allItems.push(item);
          });

          hasMore = response.chatData.hasMore;
          cursorId = response.chatData.nextCursorId;
          cursorCreatedAt = response.chatData.nextCursorCreatedAt;

          expect(pageCount).toBeLessThan(100);
        }

        // Verify all messages retrieved
        const messages = allItems.filter((item) => item.itemType === ITEM_TYPE.MESSAGE);
        const activities = allItems.filter((item) => item.itemType === ITEM_TYPE.ACTIVITY);

        expect(messages.length).toBe(messageCount);
        expect(activities.length).toBeGreaterThanOrEqual(2);
        expect(pageCount).toBeGreaterThan(1);

        // Verify chronological ordering (FORWARD means oldest first)
        for (let i = 0; i < allItems.length - 1; i++) {
          const currentDate = new Date(allItems[i].createdAt);
          const nextDate = new Date(allItems[i + 1].createdAt);
          expect(currentDate.getTime()).toBeLessThanOrEqual(nextDate.getTime());
        }
      });
    });
  });

  describe('chats with team filtering', () => {
    let endUser: any;
    let team1: any;
    let team2: any;
    let operator1: any;
    let operator2: any;

    beforeEach(async () => {
      endUser = await context.factory.createEndUser(context.org1.name);
      team1 = await context.factory.createTeam(context.org1.name, { name: 'Team 1' });
      team2 = await context.factory.createTeam(context.org1.name, { name: 'Team 2' });
      operator1 = await context.factory.createUser(context.org1.name, 'OPERATOR');
      operator2 = await context.factory.createUser(context.org1.name, 'OPERATOR');

      await context.factory.addUserToTeam(team1.id, operator1.id);
      await context.factory.addUserToTeam(team2.id, operator2.id);
    });

    describe('team filters', () => {
      it('should filter chats by single team', async () => {
        const chat1 = await context.factory.createChat(context.org1.name, endUser.userId);
        await context.factory.assignTeamToChat(chat1.id, team1.id);

        const chat2 = await context.factory.createChat(context.org1.name, endUser.userId);
        await context.factory.assignTeamToChat(chat2.id, team2.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHATS,
          {
            filter: ChatQueriesTestHelpers.createChatFilterInput({ teamIds: [team1.id] }),
          },
          context.adminToken,
        );

        expect(response.chats.items.length).toBeGreaterThanOrEqual(1);
        expect(response.chats.items.some((c: any) => c.id === chat1.id)).toBe(true);
      });

      it('should filter chats by multiple teams', async () => {
        const chat1 = await context.factory.createChat(context.org1.name, endUser.userId);
        await context.factory.assignTeamToChat(chat1.id, team1.id);

        const chat2 = await context.factory.createChat(context.org1.name, endUser.userId);
        await context.factory.assignTeamToChat(chat2.id, team2.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHATS,
          {
            filter: ChatQueriesTestHelpers.createChatFilterInput({
              teamIds: [team1.id, team2.id],
            }),
          },
          context.adminToken,
        );

        expect(response.chats.items.length).toBeGreaterThanOrEqual(2);
      });

      it('should combine team and status filters', async () => {
        const chat1 = await context.factory.createChat(context.org1.name, endUser.userId, {
          chatStatus: CHAT_STATUS.PENDING,
        });
        await context.factory.assignTeamToChat(chat1.id, team1.id);

        const chat2 = await context.factory.createChat(context.org1.name, endUser.userId, {
          chatStatus: CHAT_STATUS.ADDRESSING,
        });
        await context.factory.assignTeamToChat(chat2.id, team1.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHATS,
          {
            filter: ChatQueriesTestHelpers.createChatFilterInput({
              teamIds: [team1.id],
              statuses: [CHAT_STATUS.PENDING],
            }),
          },
          context.adminToken,
        );

        TestValidators.validatePagination(response.chats);
        response.chats.items.forEach((chat: any) => {
          expect(chat.chatStatus).toBe(CHAT_STATUS.PENDING);
        });
      });

      it('should handle empty filter results gracefully', async () => {
        const nonExistentTeam = '00000000-0000-0000-0000-000000000000';

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHATS,
          {
            filter: ChatQueriesTestHelpers.createChatFilterInput({
              teamIds: [nonExistentTeam],
            }),
          },
          context.adminToken,
        );

        expect(response.chats.items).toEqual([]);
        expect(response.chats.hasMore).toBe(false);
      });
    });

    describe('user filters', () => {
      it('should filter by user and include unassigned chats', async () => {
        const assignedChat = await context.factory.createChat(context.org1.name, endUser.userId);

        await context.factory.assignUserToChat(assignedChat.id, operator1.id);

        await context.factory.createChat(context.org1.name, endUser.userId);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHATS,
          {
            filter: ChatQueriesTestHelpers.createChatFilterInput({
              userIds: [operator1.id],
              includeUnassigned: true,
            }),
          },
          context.adminToken,
        );

        expect(response.chats.items.length).toBeGreaterThanOrEqual(1);
      });

      it('should handle user filter with includeUnassigned false', async () => {
        const testEndUser = await context.factory.createEndUser(context.org1.name);

        const assignedChat = await context.factory.createChat(
          context.org1.name,
          testEndUser.userId,
          {
            assignedUserId: operator1.id,
          },
        );
        await context.factory.assignTeamToChat(assignedChat.id, team1.id);

        const unassignedChat = await context.factory.createChat(
          context.org1.name,
          testEndUser.userId,
        );

        const operator1Token = context.authHelper.generateToken(operator1.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHATS,
          {
            filter: ChatQueriesTestHelpers.createChatFilterInput({
              userIds: [operator1.id],
              includeUnassigned: false,
            }),
          },
          operator1Token,
        );

        const chatIds = response.chats.items.map((c: any) => c.id);
        expect(chatIds).toContain(assignedChat.id);
        expect(chatIds).not.toContain(unassignedChat.id);
      });
    });

    describe('tag filters', () => {
      it('should filter by tags', async () => {
        const tag = await context.factory.createTag(context.org1.name, { name: 'Important' });
        const chat = await context.factory.createChat(context.org1.name, endUser.userId);
        await context.factory.linkTagToChat(chat.id, tag.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHATS,
          {
            filter: ChatQueriesTestHelpers.createChatFilterInput({ tagIds: [tag.id] }),
          },
          context.adminToken,
        );

        expect(response.chats.items.length).toBeGreaterThanOrEqual(1);

        const filteredChat = response.chats.items.find((c: any) => c.id === chat.id);
        expect(filteredChat).toBeDefined();

        // Validate the chat and its tags
        ChatQueriesTestHelpers.validateChatItem(filteredChat, {});
        if (filteredChat.chatTags && filteredChat.chatTags.length > 0) {
          const chatTag = filteredChat.chatTags.find((ct: any) => ct.tagId === tag.id);
          if (chatTag && chatTag.tag) {
            TestValidators.validateTag(chatTag.tag, { name: 'Important' });
          }
        }
      });
    });

    describe('view permissions', () => {
      it('should respect viewAllChatsEnabled=false for OPERATOR role', async () => {
        await context.factory.createTeamChatSetting(team1.id, false);

        await context.factory.addUserToTeam(team1.id, operator2.id);

        const operator1Token = context.authHelper.generateToken(operator1.id);

        const assignedChat = await context.factory.createChat(context.org1.name, endUser.userId, {
          assignedUserId: operator1.id,
        });
        await context.factory.assignTeamToChat(assignedChat.id, team1.id);

        const otherOperatorChat = await context.factory.createChat(
          context.org1.name,
          endUser.userId,
          {
            assignedUserId: operator2.id,
          },
        );
        await context.factory.assignTeamToChat(otherOperatorChat.id, team1.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHATS,
          {
            filter: ChatQueriesTestHelpers.createChatFilterInput({ teamIds: [team1.id] }),
          },
          operator1Token,
        );

        const chatIds = response.chats.items.map((c: any) => c.id);
        expect(chatIds).toContain(assignedChat.id);
        expect(chatIds).not.toContain(otherOperatorChat.id);
      });

      it('should show all chats when viewAllChatsEnabled=true (default)', async () => {
        await context.factory.createTeamChatSetting(team1.id, true);

        const operator1Token = context.authHelper.generateToken(operator1.id);

        const assignedChat = await context.factory.createChat(context.org1.name, endUser.userId, {
          assignedUserId: operator1.id,
        });
        await context.factory.assignTeamToChat(assignedChat.id, team1.id);

        const otherOperatorChat = await context.factory.createChat(
          context.org1.name,
          endUser.userId,
          {
            assignedUserId: operator2.id,
          },
        );
        await context.factory.assignTeamToChat(otherOperatorChat.id, team1.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHATS,
          {
            filter: ChatQueriesTestHelpers.createChatFilterInput({ teamIds: [team1.id] }),
          },
          operator1Token,
        );

        const chatIds = response.chats.items.map((c: any) => c.id);
        expect(chatIds).toContain(assignedChat.id);
        expect(chatIds).toContain(otherOperatorChat.id);
      });

      it('should include unassigned chats when viewAllChatsEnabled=false', async () => {
        await context.factory.createTeamChatSetting(team1.id, false);

        const operator1Token = context.authHelper.generateToken(operator1.id);

        const unassignedChat = await context.factory.createChat(context.org1.name, endUser.userId);
        await context.factory.assignTeamToChat(unassignedChat.id, team1.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHATS,
          {
            filter: ChatQueriesTestHelpers.createChatFilterInput({ teamIds: [team1.id] }),
          },
          operator1Token,
        );

        const chatIds = response.chats.items.map((c: any) => c.id);
        expect(chatIds).toContain(unassignedChat.id);
      });
    });
  });

  describe('chatHistory edge cases', () => {
    let endUser: any;

    beforeEach(async () => {
      endUser = await context.factory.createEndUser(context.org1.name);
    });

    it('should handle chat with no messages', async () => {
      const emptyChat = await context.factory.createChat(context.org1.name, endUser.userId);

      const response = await context.client.queryExpectSuccess(
        CHAT_QUERIES.GET_CHAT_HISTORY,
        { id: emptyChat.id },
        context.adminToken,
      );

      expect(response.chatHistory.chatMessages).toBeInstanceOf(Array);
      expect(response.chatHistory.chatMessages.length).toBeLessThanOrEqual(1);
    });

    it('should handle chat with no tags', async () => {
      const chat = await context.factory.createChat(context.org1.name, endUser.userId);

      const response = await context.client.queryExpectSuccess(
        CHAT_QUERIES.GET_CHAT_HISTORY,
        { id: chat.id },
        context.adminToken,
      );

      expect(response.chatHistory.chatTags).toEqual([]);
    });

    it('should handle chat with no assigned user', async () => {
      const unassignedChat = await context.factory.createChat(context.org1.name, endUser.userId);

      const response = await context.client.queryExpectSuccess(
        CHAT_QUERIES.GET_CHAT_HISTORY,
        { id: unassignedChat.id },
        context.adminToken,
      );

      expect(response.chatHistory.assignedUser).toBeNull();
    });

    it('should not count OPERATOR messages in unread count', async () => {
      const chat = await context.factory.createChat(context.org1.name, endUser.userId);

      const oldTimestamp = new Date(Date.now() - 10000);
      await context.factory.createChatMessage(chat.id, context.operatorUser.id, {
        createdAt: new Date(Date.now() - 5000),
        senderType: 'OPERATOR',
      });

      await context.factory.updateChat(chat.id, { latestReadTimestamp: oldTimestamp });

      const response = await context.client.queryExpectSuccess(
        CHAT_QUERIES.GET_CHAT_HISTORY,
        { id: chat.id },
        context.adminToken,
      );

      expect(response.chatHistory.chatUnreadCount).toBe(0);
    });
  });

  describe('chat data with activities', () => {
    let endUser: any;
    let testChat: any;

    beforeEach(async () => {
      endUser = await context.factory.createEndUser(context.org1.name);
      testChat = await context.factory.createChat(context.org1.name, endUser.userId, {
        assignedUserId: context.operatorUser.id,
      });
    });

    it('should include status change activities in chat data', async () => {
      await context.client.queryExpectSuccess(
        CHAT_QUERIES.CHANGE_CHAT_STATUS,
        {
          chatStatusInput: {
            chatId: testChat.id,
            status: CHAT_STATUS.ADDRESSING,
          },
        },
        context.adminToken,
      );

      const response = await context.client.queryExpectSuccess(
        CHAT_QUERIES.GET_CHAT_DATA,
        ChatQueriesTestHelpers.createChatDataInput(testChat.id, CURSOR_DIRECTION.BACKWARD),
        context.adminToken,
      );

      const activities = response.chatData.items.filter(
        (item: any) => item.itemType === ITEM_TYPE.ACTIVITY,
      );
      expect(activities.length).toBeGreaterThanOrEqual(1);

      const statusActivity = activities.find(
        (item: any) => item.activity.activityType === ACTIVITY_TYPE.STATUS_CHANGE,
      );
      expect(statusActivity).toBeDefined();

      // Validate the activity structure
      TestValidators.validateChatActivity(statusActivity.activity, {
        chatId: testChat.id,
        activityType: ACTIVITY_TYPE.STATUS_CHANGE,
      });
    });

    it('should interleave messages and activities chronologically', async () => {
      await context.factory.createChatMessage(testChat.id, context.operatorUser.id, {
        content: JSON.stringify({ text: 'Message 1' }),
      });

      await context.client.queryExpectSuccess(
        CHAT_QUERIES.CHANGE_CHAT_STATUS,
        {
          chatStatusInput: {
            chatId: testChat.id,
            status: CHAT_STATUS.ADDRESSING,
          },
        },
        context.adminToken,
      );

      await context.factory.createChatMessage(testChat.id, context.operatorUser.id, {
        content: JSON.stringify({ text: 'Message 2' }),
      });

      const response = await context.client.queryExpectSuccess(
        CHAT_QUERIES.GET_CHAT_DATA,
        ChatQueriesTestHelpers.createChatDataInput(testChat.id, CURSOR_DIRECTION.BACKWARD),
        context.adminToken,
      );

      expect(response.chatData.items.length).toBeGreaterThanOrEqual(3);
      const itemTypes = response.chatData.items.map((item: any) => item.itemType);
      expect(itemTypes).toContain(ITEM_TYPE.MESSAGE);
      expect(itemTypes).toContain(ITEM_TYPE.ACTIVITY);
    });

    it('should paginate through mixed messages and activities', async () => {
      for (let i = 0; i < 3; i++) {
        await context.factory.createChatMessage(testChat.id, context.operatorUser.id);
      }

      await context.client.queryExpectSuccess(
        CHAT_QUERIES.CHANGE_CHAT_STATUS,
        {
          chatStatusInput: { chatId: testChat.id, status: CHAT_STATUS.ADDRESSING },
        },
        context.adminToken,
      );

      const firstPage = await context.client.queryExpectSuccess(
        CHAT_QUERIES.GET_CHAT_DATA,
        ChatQueriesTestHelpers.createChatDataInput(testChat.id, CURSOR_DIRECTION.BACKWARD, {
          take: 2,
        }),
        context.adminToken,
      );

      expect(firstPage.chatData.items.length).toBeLessThanOrEqual(2);

      if (firstPage.chatData.hasMore) {
        const secondPage = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_DATA,
          ChatQueriesTestHelpers.createChatDataInput(testChat.id, CURSOR_DIRECTION.BACKWARD, {
            take: 2,
            cursorId: firstPage.chatData.nextCursorId,
            cursorCreatedAt: firstPage.chatData.nextCursorCreatedAt,
          }),
          context.adminToken,
        );

        expect(secondPage.chatData.items.length).toBeGreaterThan(0);
      }
    });
  });
});
