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
  NOT_AUTHORIZED: 'not authorized',
  ALREADY_EXISTS: 'already',
  NOT_FOUND: 'not found',
  NOT_ADDED: 'not added',
  FORBIDDEN_SELECT_TAGS: 'forbiddenSelectTags',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  INVALID: 'Invalid tag IDs provided',
} as const;

// Test Helper Class
class ChatTagsTestHelpers {
  static createChatTagInput(chatId: string, tagId: string) {
    return {
      chatId,
      tagId,
    };
  }

  static createUpdateChatTagsInput(chatId: string, tagIds: string[]) {
    return {
      chatId,
      tagIds,
    };
  }

  static validateChatTagsResponse(response: any, expectedTagCount?: number) {
    TestValidators.validateChat(response, {});
    if (expectedTagCount !== undefined) {
      expect(response.chatTags.length).toBe(expectedTagCount);
    }
  }

  static findTagInChat(chatTags: any[], tagId: string) {
    return chatTags.find((t: any) => t.tagId === tagId);
  }
}

describe('Chat Tags (E2E)', () => {
  let context: ChatTestContext;

  beforeAll(async () => {
    const baseContext = await getSharedChatTestApp();
    context = await setupChatTests(baseContext, 'chat_tags');
  });

  beforeEach(async () => {
    const updated = await setupChatTests(context, 'chat_tags');
    Object.assign(context, updated);
  });

  afterEach(async () => {
    await context.cleaner.cleanChatTestData(context.tenantSchemaNames);
  });

  afterAll(async () => {
    await cleanupSharedChatTestApp();
  });

  describe('addChatTag', () => {
    let endUser: any;
    let testChat: any;
    let testTag: any;

    beforeEach(async () => {
      endUser = await context.factory.createEndUser(context.org1.name);
      testChat = await context.factory.createChat(context.org1.name, endUser.userId);
      testTag = await context.factory.createTag(context.org1.name, { name: 'Test Tag' });
    });

    describe('authorization', () => {
      it('should add chat tag as ADMIN', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.ADD_CHAT_TAG,
          {
            chatTagInput: ChatTagsTestHelpers.createChatTagInput(testChat.id, testTag.id),
          },
          context.adminToken,
        );

        TestValidators.validateChat(response.addChatTag, {});
        expect(response.addChatTag.id).toBe(testChat.id);

        const addedTag = ChatTagsTestHelpers.findTagInChat(
          response.addChatTag.chatTags,
          testTag.id,
        );
        expect(addedTag).toBeDefined();
        expect(addedTag.tagId).toBe(testTag.id);

        // Validate the tag structure if tag object is present
        if (addedTag.tag) {
          TestValidators.validateTag(addedTag.tag, { name: 'Test Tag' });
        }
      });

      it('should add chat tag as MANAGER', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.ADD_CHAT_TAG,
          {
            chatTagInput: ChatTagsTestHelpers.createChatTagInput(testChat.id, testTag.id),
          },
          context.managerToken,
        );

        TestValidators.validateChat(response.addChatTag, {});
        expect(response.addChatTag.chatTags.length).toBeGreaterThanOrEqual(1);
      });

      it('should deny OPERATOR from adding tag', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.ADD_CHAT_TAG,
          ERROR_MESSAGES.NOT_AUTHORIZED,
          {
            chatTagInput: ChatTagsTestHelpers.createChatTagInput(testChat.id, testTag.id),
          },
          context.operatorToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.ADD_CHAT_TAG,
          ERROR_MESSAGES.UNAUTHORIZED,
          {
            chatTagInput: ChatTagsTestHelpers.createChatTagInput(testChat.id, testTag.id),
          },
        );
      });
    });

    describe('validation', () => {
      it('should reject adding same tag twice', async () => {
        await context.client.queryExpectSuccess(
          CHAT_QUERIES.ADD_CHAT_TAG,
          {
            chatTagInput: ChatTagsTestHelpers.createChatTagInput(testChat.id, testTag.id),
          },
          context.adminToken,
        );

        await context.client.queryExpectError(
          CHAT_QUERIES.ADD_CHAT_TAG,
          ERROR_MESSAGES.ALREADY_EXISTS,
          {
            chatTagInput: ChatTagsTestHelpers.createChatTagInput(testChat.id, testTag.id),
          },
          context.adminToken,
        );
      });

      it('should reject adding non-existent tag', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.ADD_CHAT_TAG,
          ERROR_MESSAGES.NOT_FOUND,
          {
            chatTagInput: ChatTagsTestHelpers.createChatTagInput(
              testChat.id,
              '00000000-0000-0000-0000-000000000000',
            ),
          },
          context.adminToken,
        );
      });

      it('should handle adding tag to non-existent chat', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.ADD_CHAT_TAG,
          ERROR_MESSAGES.NOT_FOUND,
          {
            chatTagInput: ChatTagsTestHelpers.createChatTagInput(
              '00000000-0000-0000-0000-000000000000',
              testTag.id,
            ),
          },
          context.adminToken,
        );
      });

      it('should add multiple different tags to same chat', async () => {
        const tag2 = await context.factory.createTag(context.org1.name, { name: 'Tag 2' });

        await context.client.queryExpectSuccess(
          CHAT_QUERIES.ADD_CHAT_TAG,
          {
            chatTagInput: ChatTagsTestHelpers.createChatTagInput(testChat.id, testTag.id),
          },
          context.adminToken,
        );

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.ADD_CHAT_TAG,
          {
            chatTagInput: ChatTagsTestHelpers.createChatTagInput(testChat.id, tag2.id),
          },
          context.adminToken,
        );

        expect(response.addChatTag.chatTags.length).toBe(2);
      });
    });

    describe('multi-tenancy', () => {
      it('should prevent cross-organization tag addition', async () => {
        const org2Tag = await context.factory.createTag(context.org2.name);

        await context.client.queryExpectError(
          CHAT_QUERIES.ADD_CHAT_TAG,
          ERROR_MESSAGES.NOT_FOUND,
          {
            chatTagInput: ChatTagsTestHelpers.createChatTagInput(testChat.id, org2Tag.id),
          },
          context.adminToken,
        );
      });
    });
  });

  describe('removeChatTag', () => {
    let endUser: any;
    let testChat: any;
    let testTag: any;

    beforeEach(async () => {
      endUser = await context.factory.createEndUser(context.org1.name);
      testChat = await context.factory.createChat(context.org1.name, endUser.userId);
      testTag = await context.factory.createTag(context.org1.name, { name: 'Test Tag' });
      await context.factory.linkTagToChat(testChat.id, testTag.id);
    });

    describe('authorization', () => {
      it('should remove chat tag as ADMIN', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.REMOVE_CHAT_TAG,
          {
            chatTagInput: ChatTagsTestHelpers.createChatTagInput(testChat.id, testTag.id),
          },
          context.adminToken,
        );

        TestValidators.validateChat(response.removeChatTag, {});
        expect(response.removeChatTag.id).toBe(testChat.id);
        expect(
          ChatTagsTestHelpers.findTagInChat(response.removeChatTag.chatTags, testTag.id),
        ).toBeUndefined();
      });

      it('should remove chat tag as MANAGER', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.REMOVE_CHAT_TAG,
          {
            chatTagInput: ChatTagsTestHelpers.createChatTagInput(testChat.id, testTag.id),
          },
          context.managerToken,
        );

        TestValidators.validateChat(response.removeChatTag, {});
      });

      it('should deny OPERATOR from removing tag', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.REMOVE_CHAT_TAG,
          ERROR_MESSAGES.NOT_AUTHORIZED,
          {
            chatTagInput: ChatTagsTestHelpers.createChatTagInput(testChat.id, testTag.id),
          },
          context.operatorToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.REMOVE_CHAT_TAG,
          ERROR_MESSAGES.UNAUTHORIZED,
          {
            chatTagInput: ChatTagsTestHelpers.createChatTagInput(testChat.id, testTag.id),
          },
        );
      });
    });

    describe('validation', () => {
      it('should reject removing non-existent tag', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.REMOVE_CHAT_TAG,
          ERROR_MESSAGES.NOT_ADDED,
          {
            chatTagInput: ChatTagsTestHelpers.createChatTagInput(
              testChat.id,
              '00000000-0000-0000-0000-000000000000',
            ),
          },
          context.adminToken,
        );
      });

      it('should handle removing tag that is not assigned to chat', async () => {
        const tag = await context.factory.createTag(context.org1.name);

        await context.client.queryExpectError(
          CHAT_QUERIES.REMOVE_CHAT_TAG,
          ERROR_MESSAGES.NOT_ADDED,
          {
            chatTagInput: ChatTagsTestHelpers.createChatTagInput(testChat.id, tag.id),
          },
          context.adminToken,
        );
      });

      it('should handle removing same tag twice', async () => {
        const tag = await context.factory.createTag(context.org1.name);
        await context.factory.linkTagToChat(testChat.id, tag.id);

        await context.client.queryExpectSuccess(
          CHAT_QUERIES.REMOVE_CHAT_TAG,
          {
            chatTagInput: ChatTagsTestHelpers.createChatTagInput(testChat.id, tag.id),
          },
          context.adminToken,
        );

        await context.client.queryExpectError(
          CHAT_QUERIES.REMOVE_CHAT_TAG,
          ERROR_MESSAGES.NOT_ADDED,
          {
            chatTagInput: ChatTagsTestHelpers.createChatTagInput(testChat.id, tag.id),
          },
          context.adminToken,
        );
      });
    });

    describe('multi-tenancy', () => {
      it('should prevent cross-organization tag removal', async () => {
        const org2Tag = await context.factory.createTag(context.org2.name);

        await context.client.queryExpectError(
          CHAT_QUERIES.REMOVE_CHAT_TAG,
          ERROR_MESSAGES.NOT_ADDED,
          {
            chatTagInput: ChatTagsTestHelpers.createChatTagInput(testChat.id, org2Tag.id),
          },
          context.adminToken,
        );
      });
    });
  });

  describe('updateChatTags', () => {
    let endUser: any;
    let testChat: any;
    let tag1: any;
    let tag2: any;

    beforeEach(async () => {
      endUser = await context.factory.createEndUser(context.org1.name);
      testChat = await context.factory.createChat(context.org1.name, endUser.userId);
      tag1 = await context.factory.createTag(context.org1.name, { name: 'Tag 1' });
      tag2 = await context.factory.createTag(context.org1.name, { name: 'Tag 2' });
    });

    describe('authorization', () => {
      it('should update chat tags as ADMIN', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.UPDATE_CHAT_TAGS,
          {
            updateChatTagsInput: ChatTagsTestHelpers.createUpdateChatTagsInput(testChat.id, [
              tag1.id,
              tag2.id,
            ]),
          },
          context.adminToken,
        );

        ChatTagsTestHelpers.validateChatTagsResponse(response.updateChatTags, 2);
      });

      it('should update chat tags as MANAGER', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.UPDATE_CHAT_TAGS,
          {
            updateChatTagsInput: ChatTagsTestHelpers.createUpdateChatTagsInput(testChat.id, [
              tag1.id,
            ]),
          },
          context.managerToken,
        );

        ChatTagsTestHelpers.validateChatTagsResponse(response.updateChatTags, 1);
      });

      it('should deny OPERATOR from updating tags', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.UPDATE_CHAT_TAGS,
          ERROR_MESSAGES.FORBIDDEN_SELECT_TAGS,
          {
            updateChatTagsInput: ChatTagsTestHelpers.createUpdateChatTagsInput(testChat.id, [
              tag1.id,
            ]),
          },
          context.operatorToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.UPDATE_CHAT_TAGS,
          ERROR_MESSAGES.UNAUTHORIZED,
          {
            updateChatTagsInput: ChatTagsTestHelpers.createUpdateChatTagsInput(testChat.id, [
              tag1.id,
            ]),
          },
        );
      });
    });

    describe('tag replacement', () => {
      it('should replace existing tags', async () => {
        await context.factory.linkTagToChat(testChat.id, tag1.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.UPDATE_CHAT_TAGS,
          {
            updateChatTagsInput: ChatTagsTestHelpers.createUpdateChatTagsInput(testChat.id, [
              tag2.id,
            ]),
          },
          context.adminToken,
        );

        TestValidators.validateChat(response.updateChatTags, {});
        expect(response.updateChatTags.chatTags.length).toBe(1);
        expect(response.updateChatTags.chatTags[0].tagId).toBe(tag2.id);
      });

      it('should clear all tags when empty array provided', async () => {
        await context.factory.linkTagToChat(testChat.id, tag1.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.UPDATE_CHAT_TAGS,
          {
            updateChatTagsInput: ChatTagsTestHelpers.createUpdateChatTagsInput(testChat.id, []),
          },
          context.adminToken,
        );

        ChatTagsTestHelpers.validateChatTagsResponse(response.updateChatTags, 0);
      });
    });

    describe('validation', () => {
      it('should reject invalid tag IDs', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.UPDATE_CHAT_TAGS,
          ERROR_MESSAGES.INVALID,
          {
            updateChatTagsInput: ChatTagsTestHelpers.createUpdateChatTagsInput(testChat.id, [
              'invalid-tag-id',
            ]),
          },
          context.adminToken,
        );
      });

      it('should handle updating with duplicate tag IDs', async () => {
        const tag = await context.factory.createTag(context.org1.name);

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.UPDATE_CHAT_TAGS,
          {
            updateChatTagsInput: ChatTagsTestHelpers.createUpdateChatTagsInput(testChat.id, [
              tag.id,
              tag.id,
              tag.id,
            ]),
          },
          context.adminToken,
        );

        TestValidators.validateChat(response.updateChatTags, {});
        expect(response.updateChatTags.chatTags.length).toBeLessThanOrEqual(1);
      });

      it('should handle maximum number of tags', async () => {
        const tags = [];
        for (let i = 0; i < 10; i++) {
          tags.push(await context.factory.createTag(context.org1.name, { name: `Tag ${i}` }));
        }

        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.UPDATE_CHAT_TAGS,
          {
            updateChatTagsInput: ChatTagsTestHelpers.createUpdateChatTagsInput(
              testChat.id,
              tags.map((t) => t.id),
            ),
          },
          context.adminToken,
        );

        ChatTagsTestHelpers.validateChatTagsResponse(response.updateChatTags, 10);
      });

      it('should reject mix of valid and invalid tag IDs', async () => {
        const validTag = await context.factory.createTag(context.org1.name);

        await context.client.queryExpectError(
          CHAT_QUERIES.UPDATE_CHAT_TAGS,
          ERROR_MESSAGES.INVALID,
          {
            updateChatTagsInput: ChatTagsTestHelpers.createUpdateChatTagsInput(testChat.id, [
              validTag.id,
              'invalid-tag-id',
            ]),
          },
          context.adminToken,
        );
      });

      it('should handle updating tags on non-existent chat', async () => {
        const tag = await context.factory.createTag(context.org1.name);

        await context.client.queryExpectError(
          CHAT_QUERIES.UPDATE_CHAT_TAGS,
          ERROR_MESSAGES.NOT_FOUND,
          {
            updateChatTagsInput: ChatTagsTestHelpers.createUpdateChatTagsInput(
              '00000000-0000-0000-0000-000000000000',
              [tag.id],
            ),
          },
          context.adminToken,
        );
      });
    });

    describe('multi-tenancy', () => {
      it('should reject tags from different organization', async () => {
        const chat = await context.factory.createChat(context.org1.name, endUser.userId);
        const org2Tag = await context.factory.createTag(context.org2.name);

        await context.client.queryExpectError(
          CHAT_QUERIES.UPDATE_CHAT_TAGS,
          ERROR_MESSAGES.INVALID,
          {
            updateChatTagsInput: ChatTagsTestHelpers.createUpdateChatTagsInput(chat.id, [
              org2Tag.id,
            ]),
          },
          context.adminToken,
        );
      });

      it('should handle mix of valid and non-existent tags', async () => {
        const chat = await context.factory.createChat(context.org1.name, endUser.userId);
        const validTag = await context.factory.createTag(context.org1.name);

        await context.client.queryExpectError(
          CHAT_QUERIES.UPDATE_CHAT_TAGS,
          ERROR_MESSAGES.INVALID,
          {
            updateChatTagsInput: ChatTagsTestHelpers.createUpdateChatTagsInput(chat.id, [
              validTag.id,
              '00000000-0000-0000-0000-000000000000',
            ]),
          },
          context.adminToken,
        );
      });
    });
  });
});
