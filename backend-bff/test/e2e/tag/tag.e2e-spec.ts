import { TAG_QUERIES } from '../../fixtures/graphql/tag.queries';
import { TestContext, TestSetup, TestValidators } from '../../utils/test-setup';

const TEST_TAGS = {
  BASIC: { name: 'Urgent' },
  WITH_SPACES: { name: '  Important   Tag  ', expectedName: 'Important Tag' },
  DUPLICATE: { name: 'VIP Customer' },
  EMPTY: { name: '   ' },
  TOO_LONG: { name: 'This is a very long tag name that exceeds the maximum character limit' },
  CROSS_ORG: { name: 'Shared Name' },
  FOR_UPDATE: { name: 'Original Name' },
} as const;

const ERROR_MESSAGES = {
  FORBIDDEN: 'Forbidden',
  UNAUTHORIZED: 'Unauthorized',
  DUPLICATE_NAME: 'Tag name is already taken',
  EMPTY_NAME: 'cannot be empty',
  NAME_TOO_LONG: 'must contain at most 20 character',
  TAG_NOT_FOUND: 'not found',
  ACCESS_DENIED: 'not found',
  DIFFERENT_ORGANIZATION: 'different organization',
  TAG_ALREADY_DISABLED: 'Tag is already disabled',
  ONGOING_CHAT_UPDATE_RESTRICTION: 'You cannot update a tag that has ongoing chat',
  INVALID_FILTER_FIELD: 'invalidFilterField',
} as const;

// Test Helper Functions
class TagTestHelpers {
  static createTagInput(overrides: any = {}) {
    return {
      name: 'Test Tag',
      ...overrides,
    };
  }

  static updateTagInput(id: string, overrides: any = {}) {
    return {
      id,
      name: 'Updated Tag',
      isActive: true,
      ...overrides,
    };
  }

  static validateTagFields(tag: any, expected: any) {
    TestValidators.validateTag(tag, expected);
  }
}

describe('Tag Module (E2E)', () => {
  let context: TestContext;
  let org1: any;
  let org2: any;
  let adminToken: string;
  let managerToken: string;
  let operatorToken: string;
  let org2AdminToken: string;
  let tenantSchemaNames: string[];

  beforeAll(async () => {
    context = await TestSetup.createTestApp();
    const { organizations, tokens } = await TestSetup.createStandardTestData(
      context.factory,
      context.authHelper,
      'tag_test_org1',
      'tag_test_org2',
    );

    org1 = organizations.org1;
    org2 = organizations.org2;
    adminToken = tokens.adminToken;
    managerToken = tokens.managerToken;
    operatorToken = tokens.operatorToken;
    org2AdminToken = tokens.org2AdminToken;
    tenantSchemaNames = await Promise.all([
      context.factory.getTenantSchemaNameForOrganization(org1.name),
      context.factory.getTenantSchemaNameForOrganization(org2.name),
    ]);
  });

  afterEach(async () => {
    await context.cleaner.cleanTagTestData(tenantSchemaNames);
  });

  afterAll(async () => {
    await TestSetup.cleanupTestApp(context);
  });

  describe('createTag', () => {
    describe('authorization', () => {
      const input = TagTestHelpers.createTagInput(TEST_TAGS.BASIC);

      it('should allow ADMIN to create tag', async () => {
        const response = await context.client.queryExpectSuccess(
          TAG_QUERIES.CREATE_TAG,
          { createTagInput: input },
          adminToken,
        );

        TagTestHelpers.validateTagFields(response.createTag, {
          name: input.name,
          isActive: true,
        });
      });

      it('should deny MANAGER from creating tag', async () => {
        await context.client.queryExpectError(
          TAG_QUERIES.CREATE_TAG,
          ERROR_MESSAGES.FORBIDDEN,
          { createTagInput: input },
          managerToken,
        );
      });

      it('should deny OPERATOR from creating tag', async () => {
        await context.client.queryExpectError(
          TAG_QUERIES.CREATE_TAG,
          ERROR_MESSAGES.FORBIDDEN,
          { createTagInput: input },
          operatorToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(TAG_QUERIES.CREATE_TAG, ERROR_MESSAGES.UNAUTHORIZED, {
          createTagInput: input,
        });
      });
    });

    describe('validation', () => {
      it('should trim and clean spaces in name', async () => {
        const response = await context.client.queryExpectSuccess(
          TAG_QUERIES.CREATE_TAG,
          {
            createTagInput: TagTestHelpers.createTagInput({
              name: TEST_TAGS.WITH_SPACES.name,
            }),
          },
          adminToken,
        );

        expect(response.createTag.name).toBe(TEST_TAGS.WITH_SPACES.expectedName);
      });

      it('should reject empty name', async () => {
        await context.client.queryExpectError(
          TAG_QUERIES.CREATE_TAG,
          ERROR_MESSAGES.EMPTY_NAME,
          {
            createTagInput: TagTestHelpers.createTagInput({ name: TEST_TAGS.EMPTY.name }),
          },
          adminToken,
        );
      });

      it('should reject name exceeding 20 characters', async () => {
        await context.client.queryExpectError(
          TAG_QUERIES.CREATE_TAG,
          ERROR_MESSAGES.NAME_TOO_LONG,
          {
            createTagInput: TagTestHelpers.createTagInput({ name: TEST_TAGS.TOO_LONG.name }),
          },
          adminToken,
        );
      });

      it('should reject duplicate tag name (case-insensitive)', async () => {
        await context.client.queryExpectSuccess(
          TAG_QUERIES.CREATE_TAG,
          {
            createTagInput: TagTestHelpers.createTagInput({
              name: TEST_TAGS.DUPLICATE.name,
            }),
          },
          adminToken,
        );

        await context.client.queryExpectError(
          TAG_QUERIES.CREATE_TAG,
          ERROR_MESSAGES.DUPLICATE_NAME,
          {
            createTagInput: TagTestHelpers.createTagInput({
              name: TEST_TAGS.DUPLICATE.name.toLowerCase(),
            }),
          },
          adminToken,
        );
      });
    });

    describe('multi-tenancy', () => {
      it('should allow duplicate names across organizations', async () => {
        await context.client.queryExpectSuccess(
          TAG_QUERIES.CREATE_TAG,
          {
            createTagInput: TagTestHelpers.createTagInput({
              name: TEST_TAGS.CROSS_ORG.name,
            }),
          },
          adminToken,
        );

        const response = await context.client.queryExpectSuccess(
          TAG_QUERIES.CREATE_TAG,
          {
            createTagInput: TagTestHelpers.createTagInput({
              name: TEST_TAGS.CROSS_ORG.name,
            }),
          },
          org2AdminToken,
        );

        TagTestHelpers.validateTagFields(response.createTag, { name: TEST_TAGS.CROSS_ORG.name });
      });
    });
  });

  describe('tags (list)', () => {
    beforeEach(async () => {
      await context.factory.createTag(org1.name, { name: 'Tag 1' });
      await context.factory.createTag(org1.name, { name: 'Tag 2' });
      await context.factory.createTag(org1.name, { name: 'Tag 3' });
      await context.factory.createTag(org2.name, { name: 'Org2 Tag' });
    });

    describe('basic listing', () => {
      it('should list tags for organization', async () => {
        const response = await context.client.queryExpectSuccess(
          TAG_QUERIES.GET_TAGS,
          {},
          adminToken,
        );

        expect(response.tags.items).toBeInstanceOf(Array);
        expect(response.tags.items.length).toBe(3);
        expect(response.tags.count).toBe(3);
        response.tags.items.forEach((tag: any) => {
          TagTestHelpers.validateTagFields(tag, {});
          expect(tag.name).toMatch(/^Tag/);
        });
      });

      it('should allow OPERATOR to list tags', async () => {
        const response = await context.client.queryExpectSuccess(
          TAG_QUERIES.GET_TAGS,
          {},
          operatorToken,
        );

        expect(response.tags.items).toBeInstanceOf(Array);
        expect(response.tags.items.length).toBe(3);
        expect(response.tags.count).toBe(3);
      });

      it('should allow MANAGER to list tags', async () => {
        const response = await context.client.queryExpectSuccess(
          TAG_QUERIES.GET_TAGS,
          {},
          managerToken,
        );

        expect(response.tags.items).toBeInstanceOf(Array);
        expect(response.tags.items.length).toBe(3);
        expect(response.tags.count).toBe(3);
      });

      it('should order by createdAt descending', async () => {
        const response = await context.client.queryExpectSuccess(
          TAG_QUERIES.GET_TAGS,
          {},
          adminToken,
        );

        TestValidators.validateDescendingOrder(response.tags.items);
      });
    });

    describe('pagination', () => {
      it('should respect skip and take', async () => {
        const response = await context.client.queryExpectSuccess(
          TAG_QUERIES.GET_TAGS,
          { skip: 1, take: 2 },
          adminToken,
        );

        expect(response.tags.items.length).toBe(2);
        expect(response.tags.count).toBe(3);
      });

      it('should handle skip only', async () => {
        const response = await context.client.queryExpectSuccess(
          TAG_QUERIES.GET_TAGS,
          { skip: 1 },
          adminToken,
        );

        expect(response.tags.items.length).toBe(2);
        expect(response.tags.count).toBe(3);
      });

      it('should handle take only', async () => {
        const response = await context.client.queryExpectSuccess(
          TAG_QUERIES.GET_TAGS,
          { take: 2 },
          adminToken,
        );

        expect(response.tags.items.length).toBe(2);
        expect(response.tags.count).toBe(3);
      });
    });

    describe('multi-tenancy', () => {
      it('should not list tags from other organizations', async () => {
        const response = await context.client.queryExpectSuccess(
          TAG_QUERIES.GET_TAGS,
          {},
          adminToken,
        );

        expect(response.tags.items.every((tag: any) => !tag.name.includes('Org2'))).toBe(true);
      });

      it('should isolate counts per organization', async () => {
        const org1Response = await context.client.queryExpectSuccess(
          TAG_QUERIES.GET_TAGS,
          {},
          adminToken,
        );

        const org2Response = await context.client.queryExpectSuccess(
          TAG_QUERIES.GET_TAGS,
          {},
          org2AdminToken,
        );

        expect(org1Response.tags.count).toBe(3);
        expect(org2Response.tags.count).toBe(1);
      });
    });

    describe('filtering', () => {
      beforeEach(async () => {
        await context.factory.createTag(org1.name, { name: 'Urgent' });
        await context.factory.createTag(org1.name, { name: 'Important' });
        await context.factory.createTag(org1.name, { name: 'Follow-up' });
        await context.factory.createTag(org1.name, { name: 'VIP Customer' });
      });

      describe('searchValue', () => {
        it('should filter by searchValue (case-insensitive)', async () => {
          const response = await context.client.queryExpectSuccess(
            TAG_QUERIES.GET_TAGS,
            { filter: { searchValue: 'urgent' } },
            adminToken,
          );

          expect(response.tags.items).toHaveLength(1);
          expect(response.tags.items[0].name).toBe('Urgent');
        });

        it('should return empty for non-matching search', async () => {
          const response = await context.client.queryExpectSuccess(
            TAG_QUERIES.GET_TAGS,
            { filter: { searchValue: 'NonExistent' } },
            adminToken,
          );

          expect(response.tags.items).toHaveLength(0);
        });

        it('should not leak across organizations', async () => {
          await context.factory.createTag(org2.name, { name: 'Urgent Org2' });

          const response = await context.client.queryExpectSuccess(
            TAG_QUERIES.GET_TAGS,
            { filter: { searchValue: 'Urgent' } },
            adminToken,
          );

          expect(response.tags.items).toHaveLength(1);
          expect(response.tags.items.every((tag: any) => !tag.name.includes('Org2'))).toBe(true);
        });
      });

      describe('refineConditions', () => {
        const conditions = [
          { condition: 'equals', value: 'Urgent', expectedCount: 1 },
          { condition: 'contains', value: 'Important', expectedCount: 1 },
          { condition: 'starts with', value: 'VIP', expectedCount: 1 },
          { condition: 'ends with', value: 'Customer', expectedCount: 1 },
          { condition: 'not equals', value: 'Urgent', minCount: 3 },
        ];

        conditions.forEach(({ condition, value, expectedCount, minCount }) => {
          it(`should filter by name ${condition}`, async () => {
            const response = await context.client.queryExpectSuccess(
              TAG_QUERIES.GET_TAGS,
              {
                filter: {
                  refineConditions: [{ searchItem: 'name', condition, value }],
                },
              },
              adminToken,
            );

            if (expectedCount !== undefined) {
              expect(response.tags.items).toHaveLength(expectedCount);
            } else if (minCount !== undefined) {
              expect(response.tags.items.length).toBeGreaterThanOrEqual(minCount);
            }
          });
        });

        it('should reject invalid filter field', async () => {
          await context.client.queryExpectError(
            TAG_QUERIES.GET_TAGS,
            ERROR_MESSAGES.INVALID_FILTER_FIELD,
            {
              filter: {
                refineConditions: [
                  { searchItem: 'invalidField', condition: 'equals', value: 'test' },
                ],
              },
            },
            adminToken,
          );
        });
      });

      describe('combined filtering', () => {
        it('should combine searchValue and refineConditions', async () => {
          const response = await context.client.queryExpectSuccess(
            TAG_QUERIES.GET_TAGS,
            {
              filter: {
                searchValue: 'VIP',
                refineConditions: [
                  { searchItem: 'name', condition: 'contains', value: 'Customer' },
                ],
              },
            },
            adminToken,
          );

          expect(response.tags.items).toHaveLength(1);
          expect(response.tags.items[0].name).toBe('VIP Customer');
        });

        it('should support multiple refineConditions', async () => {
          const response = await context.client.queryExpectSuccess(
            TAG_QUERIES.GET_TAGS,
            {
              filter: {
                refineConditions: [
                  { searchItem: 'name', condition: 'starts with', value: 'Follow' },
                  { searchItem: 'name', condition: 'ends with', value: 'up' },
                ],
              },
            },
            adminToken,
          );

          expect(response.tags.items).toHaveLength(1);
          expect(response.tags.items[0].name).toBe('Follow-up');
        });

        it('should combine filtering with pagination', async () => {
          await context.factory.createTag(org1.name, { name: 'Customer Support' });
          await context.factory.createTag(org1.name, { name: 'Customer Service' });

          const response = await context.client.queryExpectSuccess(
            TAG_QUERIES.GET_TAGS,
            {
              skip: 0,
              take: 2,
              filter: { searchValue: 'Customer' },
            },
            adminToken,
          );

          expect(response.tags.items.length).toBeLessThanOrEqual(2);
          expect(response.tags.count).toBeGreaterThanOrEqual(3);
        });
      });
    });
  });

  describe('cursorPaginatedTags', () => {
    beforeEach(async () => {
      await context.factory.createTag(org1.name, { name: 'Tag 1' });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await context.factory.createTag(org1.name, { name: 'Tag 2' });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await context.factory.createTag(org1.name, { name: 'Tag 3' });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await context.factory.createTag(org1.name, { name: 'Tag 4' });
    });

    describe('basic cursor pagination', () => {
      it('should return cursor paginated tags', async () => {
        const response = await context.client.queryExpectSuccess(
          TAG_QUERIES.GET_CURSOR_PAGINATED_TAGS,
          { take: 2 },
          adminToken,
        );

        TestValidators.validatePagination(response.cursorPaginatedTags, 2, true);
      });

      it('should navigate to next page using cursor', async () => {
        const firstPage = await context.client.queryExpectSuccess(
          TAG_QUERIES.GET_CURSOR_PAGINATED_TAGS,
          { take: 2 },
          adminToken,
        );

        const secondPage = await context.client.queryExpectSuccess(
          TAG_QUERIES.GET_CURSOR_PAGINATED_TAGS,
          {
            take: 2,
            cursorId: firstPage.cursorPaginatedTags.nextCursorId,
            cursorCreatedAt: firstPage.cursorPaginatedTags.nextCursorCreatedAt,
          },
          adminToken,
        );

        TestValidators.validatePagination(secondPage.cursorPaginatedTags, 2);
        expect(secondPage.cursorPaginatedTags.items[0].id).not.toBe(
          firstPage.cursorPaginatedTags.items[0].id,
        );
      });

      it('should allow OPERATOR to use cursor pagination', async () => {
        const response = await context.client.queryExpectSuccess(
          TAG_QUERIES.GET_CURSOR_PAGINATED_TAGS,
          { take: 2 },
          operatorToken,
        );

        TestValidators.validatePagination(response.cursorPaginatedTags, 2);
      });
    });

    describe('authorization', () => {
      it('should allow MANAGER to use cursor pagination', async () => {
        const response = await context.client.queryExpectSuccess(
          TAG_QUERIES.GET_CURSOR_PAGINATED_TAGS,
          { take: 2 },
          managerToken,
        );

        TestValidators.validatePagination(response.cursorPaginatedTags, 2);
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          TAG_QUERIES.GET_CURSOR_PAGINATED_TAGS,
          ERROR_MESSAGES.UNAUTHORIZED,
          { take: 2 },
        );
      });
    });
  });

  describe('tag (single)', () => {
    let testTag: any;

    beforeEach(async () => {
      testTag = await context.factory.createTag(org1.name, { name: 'Test Single' });
    });

    describe('authorization', () => {
      it('should allow ADMIN to get single tag', async () => {
        const response = await context.client.queryExpectSuccess(
          TAG_QUERIES.GET_TAG,
          { id: testTag.id },
          adminToken,
        );

        TagTestHelpers.validateTagFields(response.tag, { name: 'Test Single' });
        expect(response.tag.id).toBe(testTag.id);
      });

      it('should deny MANAGER from getting single tag', async () => {
        await context.client.queryExpectError(
          TAG_QUERIES.GET_TAG,
          ERROR_MESSAGES.FORBIDDEN,
          { id: testTag.id },
          managerToken,
        );
      });

      it('should deny OPERATOR from getting single tag', async () => {
        await context.client.queryExpectError(
          TAG_QUERIES.GET_TAG,
          ERROR_MESSAGES.FORBIDDEN,
          { id: testTag.id },
          operatorToken,
        );
      });
    });

    describe('error cases', () => {
      it('should prevent cross-organization access', async () => {
        const org2Tag = await context.factory.createTag(org2.name, { name: 'Org2 Tag' });

        await context.client.queryExpectError(
          TAG_QUERIES.GET_TAG,
          ERROR_MESSAGES.ACCESS_DENIED,
          { id: org2Tag.id },
          adminToken,
        );
      });

      it('should return error for non-existent tag', async () => {
        await context.client.queryExpectError(
          TAG_QUERIES.GET_TAG,
          ERROR_MESSAGES.TAG_NOT_FOUND,
          { id: '00000000-0000-0000-0000-000000000000' },
          adminToken,
        );
      });
    });
  });

  describe('updateTag', () => {
    let testTag: any;

    beforeEach(async () => {
      testTag = await context.factory.createTag(org1.name, TEST_TAGS.FOR_UPDATE);
    });

    describe('authorization', () => {
      it('should allow ADMIN to update tag', async () => {
        const response = await context.client.queryExpectSuccess(
          TAG_QUERIES.UPDATE_TAG,
          {
            updateTagInput: TagTestHelpers.updateTagInput(testTag.id, {
              name: 'Updated Name',
            }),
          },
          adminToken,
        );

        TagTestHelpers.validateTagFields(response.updateTag, {
          name: 'Updated Name',
          isActive: true,
        });
      });

      it('should deny MANAGER from updating tag', async () => {
        await context.client.queryExpectError(
          TAG_QUERIES.UPDATE_TAG,
          ERROR_MESSAGES.FORBIDDEN,
          {
            updateTagInput: TagTestHelpers.updateTagInput(testTag.id, {
              name: 'Manager Updated',
            }),
          },
          managerToken,
        );
      });

      it('should deny OPERATOR from updating tag', async () => {
        await context.client.queryExpectError(
          TAG_QUERIES.UPDATE_TAG,
          ERROR_MESSAGES.FORBIDDEN,
          {
            updateTagInput: TagTestHelpers.updateTagInput(testTag.id, {
              name: 'Hacked',
            }),
          },
          operatorToken,
        );
      });
    });

    describe('validation', () => {
      it('should reject duplicate name on update', async () => {
        await context.factory.createTag(org1.name, { name: 'Another Tag' });

        await context.client.queryExpectError(
          TAG_QUERIES.UPDATE_TAG,
          ERROR_MESSAGES.DUPLICATE_NAME,
          {
            updateTagInput: TagTestHelpers.updateTagInput(testTag.id, {
              name: 'Another Tag',
            }),
          },
          adminToken,
        );
      });

      it('should reject duplicate name with different case on update', async () => {
        await context.factory.createTag(org1.name, { name: 'Case Test Tag' });

        await context.client.queryExpectError(
          TAG_QUERIES.UPDATE_TAG,
          ERROR_MESSAGES.DUPLICATE_NAME,
          {
            updateTagInput: TagTestHelpers.updateTagInput(testTag.id, {
              name: 'CASE TEST TAG',
            }),
          },
          adminToken,
        );
      });

      it('should reject duplicate name with mixed case on update', async () => {
        await context.factory.createTag(org1.name, { name: 'MixedCase' });

        await context.client.queryExpectError(
          TAG_QUERIES.UPDATE_TAG,
          ERROR_MESSAGES.DUPLICATE_NAME,
          {
            updateTagInput: TagTestHelpers.updateTagInput(testTag.id, {
              name: 'mixedcase',
            }),
          },
          adminToken,
        );
      });

      it('should allow updating to same name', async () => {
        const response = await context.client.queryExpectSuccess(
          TAG_QUERIES.UPDATE_TAG,
          {
            updateTagInput: TagTestHelpers.updateTagInput(testTag.id, {
              name: TEST_TAGS.FOR_UPDATE.name,
              isActive: false,
            }),
          },
          adminToken,
        );

        TagTestHelpers.validateTagFields(response.updateTag, {
          name: TEST_TAGS.FOR_UPDATE.name,
          isActive: false,
        });
      });
    });

    describe('error cases', () => {
      it('should reject updating non-existent tag', async () => {
        await context.client.queryExpectError(
          TAG_QUERIES.UPDATE_TAG,
          ERROR_MESSAGES.TAG_NOT_FOUND,
          {
            updateTagInput: TagTestHelpers.updateTagInput('00000000-0000-0000-0000-000000000000', {
              name: 'New Name',
            }),
          },
          adminToken,
        );
      });

      it('should prevent cross-organization update', async () => {
        const org2Tag = await context.factory.createTag(org2.name);

        await context.client.queryExpectError(
          TAG_QUERIES.UPDATE_TAG,
          ERROR_MESSAGES.TAG_NOT_FOUND,
          {
            updateTagInput: TagTestHelpers.updateTagInput(org2Tag.id, {
              name: 'Hacked',
            }),
          },
          adminToken,
        );
      });
    });

    describe('update with active chats', () => {
      let activeChat: any;
      let endUser: any;

      beforeEach(async () => {
        endUser = await context.factory.createEndUser();
        activeChat = await context.factory.createChat(org1.name, endUser.userId, {
          chatStatus: 'PENDING',
        });
        await context.factory.linkTagToChat(activeChat.id, testTag.id);
      });

      it('should reject name change when tag has active chat', async () => {
        await context.client.queryExpectError(
          TAG_QUERIES.UPDATE_TAG,
          ERROR_MESSAGES.ONGOING_CHAT_UPDATE_RESTRICTION,
          {
            updateTagInput: TagTestHelpers.updateTagInput(testTag.id, {
              name: 'New Name',
            }),
          },
          adminToken,
        );
      });

      it('should allow isActive change when tag has active chat', async () => {
        const response = await context.client.queryExpectSuccess(
          TAG_QUERIES.UPDATE_TAG,
          {
            updateTagInput: TagTestHelpers.updateTagInput(testTag.id, {
              name: TEST_TAGS.FOR_UPDATE.name,
              isActive: false,
            }),
          },
          adminToken,
        );

        expect(response.updateTag.isActive).toBe(false);
      });
    });
  });

  describe('toggleTagStatus', () => {
    let testTag: any;

    beforeEach(async () => {
      testTag = await context.factory.createTag(org1.name, { isActive: true });
    });

    describe('basic toggle operations', () => {
      it('should toggle from active to inactive', async () => {
        const response = await context.client.queryExpectSuccess(
          TAG_QUERIES.TOGGLE_TAG_STATUS,
          { id: testTag.id },
          adminToken,
        );

        TagTestHelpers.validateTagFields(response.toggleTagStatus, { isActive: false });
      });

      it('should toggle from inactive to active', async () => {
        await context.client.queryExpectSuccess(
          TAG_QUERIES.TOGGLE_TAG_STATUS,
          { id: testTag.id },
          adminToken,
        );

        const response = await context.client.queryExpectSuccess(
          TAG_QUERIES.TOGGLE_TAG_STATUS,
          { id: testTag.id },
          adminToken,
        );

        TagTestHelpers.validateTagFields(response.toggleTagStatus, { isActive: true });
      });
    });

    describe('authorization', () => {
      it('should deny OPERATOR from toggling status', async () => {
        await context.client.queryExpectError(
          TAG_QUERIES.TOGGLE_TAG_STATUS,
          ERROR_MESSAGES.FORBIDDEN,
          { id: testTag.id },
          operatorToken,
        );
      });

      it('should deny MANAGER from toggling status', async () => {
        await context.client.queryExpectError(
          TAG_QUERIES.TOGGLE_TAG_STATUS,
          ERROR_MESSAGES.FORBIDDEN,
          { id: testTag.id },
          managerToken,
        );
      });
    });

    describe('error cases', () => {
      it('should prevent cross-organization toggle', async () => {
        const org2Tag = await context.factory.createTag(org2.name);

        await context.client.queryExpectError(
          TAG_QUERIES.TOGGLE_TAG_STATUS,
          ERROR_MESSAGES.ACCESS_DENIED,
          { id: org2Tag.id },
          adminToken,
        );
      });

      it('should reject toggling non-existent tag', async () => {
        await context.client.queryExpectError(
          TAG_QUERIES.TOGGLE_TAG_STATUS,
          ERROR_MESSAGES.TAG_NOT_FOUND,
          { id: '00000000-0000-0000-0000-000000000000' },
          adminToken,
        );
      });
    });
  });

  describe('disableTag', () => {
    let testTag: any;

    beforeEach(async () => {
      testTag = await context.factory.createTag(org1.name, { isActive: true });
    });

    describe('authorization', () => {
      it('should allow ADMIN to disable tag', async () => {
        const response = await context.client.queryExpectSuccess(
          TAG_QUERIES.DISABLE_TAG,
          { id: testTag.id },
          adminToken,
        );

        TagTestHelpers.validateTagFields(response.disableTag, { isActive: false });
      });

      it('should deny OPERATOR from disabling tag', async () => {
        await context.client.queryExpectError(
          TAG_QUERIES.DISABLE_TAG,
          ERROR_MESSAGES.FORBIDDEN,
          { id: testTag.id },
          operatorToken,
        );
      });

      it('should deny MANAGER from disabling tag', async () => {
        await context.client.queryExpectError(
          TAG_QUERIES.DISABLE_TAG,
          ERROR_MESSAGES.FORBIDDEN,
          { id: testTag.id },
          managerToken,
        );
      });
    });

    describe('error cases', () => {
      it('should reject disabling non-existent tag', async () => {
        await context.client.queryExpectError(
          TAG_QUERIES.DISABLE_TAG,
          ERROR_MESSAGES.TAG_NOT_FOUND,
          { id: '00000000-0000-0000-0000-000000000000' },
          adminToken,
        );
      });

      it('should reject disabling already disabled tag', async () => {
        await context.client.queryExpectSuccess(
          TAG_QUERIES.DISABLE_TAG,
          { id: testTag.id },
          adminToken,
        );

        await context.client.queryExpectError(
          TAG_QUERIES.DISABLE_TAG,
          ERROR_MESSAGES.TAG_ALREADY_DISABLED,
          { id: testTag.id },
          adminToken,
        );
      });

      it('should prevent cross-organization disable', async () => {
        const org2Tag = await context.factory.createTag(org2.name);

        await context.client.queryExpectError(
          TAG_QUERIES.DISABLE_TAG,
          ERROR_MESSAGES.ACCESS_DENIED,
          { id: org2Tag.id },
          adminToken,
        );
      });
    });
  });
});
