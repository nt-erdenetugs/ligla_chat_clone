import {
  ERROR_MESSAGES,
  setupUserTests,
  getSharedTestApp,
  cleanupSharedTestApp,
  USER_QUERIES,
  UserTestContext,
} from '../user-test.setup';

describe('User Module - Remove User (E2E)', () => {
  let context: UserTestContext;

  beforeAll(async () => {
    const baseContext = await getSharedTestApp();
    context = await setupUserTests(baseContext, 'remove');
  });

  beforeEach(async () => {
    const updated = await setupUserTests(context, 'remove');
    Object.assign(context, updated);
  });

  afterEach(async () => {
    await context.cleaner.cleanUserTestData(context.tenantSchemaNames, context.baselineUsers);
  });

  afterAll(async () => {
    await cleanupSharedTestApp();
  });

  describe('removeUser', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await context.factory.createUser(context.org1.name, 'OPERATOR', {
        email: 'remove-test@example.com',
      });
    });

    describe('authorization', () => {
      it('should allow ADMIN to remove user', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.REMOVE_USER,
          { id: testUser.id },
          context.adminToken,
        );

        expect(response.removeUser).toBe(true);

        const updatedUser = await context.factory.getUserById(testUser.id);
        expect(updatedUser?.status).toBe('INACTIVE');
      });

      it('should deny MANAGER from removing user', async () => {
        await context.client.queryExpectError(
          USER_QUERIES.REMOVE_USER,
          ERROR_MESSAGES.FORBIDDEN,
          { id: testUser.id },
          context.managerToken,
        );
      });

      it('should deny OPERATOR from removing user', async () => {
        await context.client.queryExpectError(
          USER_QUERIES.REMOVE_USER,
          ERROR_MESSAGES.FORBIDDEN,
          { id: testUser.id },
          context.operatorToken,
        );
      });
    });

    describe('error cases', () => {
      it('should return error for non-existent user', async () => {
        await context.client.queryExpectError(
          USER_QUERIES.REMOVE_USER,
          ERROR_MESSAGES.USER_NOT_FOUND,
          { id: '00000000-0000-0000-0000-000000000000' },
          context.adminToken,
        );
      });

      it('should prevent removing user with assigned chats', async () => {
        const userWithChats = await context.factory.createUser(context.org1.name, 'OPERATOR', {
          status: 'ACTIVE',
        });

        // Assign chat to the user
        const assignedChat = await context.factory.createChat(context.org1.name);
        await context.factory.assignUserToChat(assignedChat.id, userWithChats.id);

        await context.client.queryExpectError(
          USER_QUERIES.REMOVE_USER,
          ERROR_MESSAGES.CANNOT_DELETE_ASSIGNEE_USER,
          { id: userWithChats.id },
          context.adminToken,
        );
      });

      it('should prevent removing user with any assigned chat (not just active)', async () => {
        const userWithDoneChat = await context.factory.createUser(context.org1.name, 'OPERATOR', {
          status: 'ACTIVE',
        });

        // Create a DONE chat (not active but still assigned)
        const doneChat = await context.factory.createChat(context.org1.name, {
          chatStatus: 'DONE',
        });
        await context.factory.assignUserToChat(doneChat.id, userWithDoneChat.id);

        await context.client.queryExpectError(
          USER_QUERIES.REMOVE_USER,
          ERROR_MESSAGES.CANNOT_DELETE_ASSIGNEE_USER,
          { id: userWithDoneChat.id },
          context.adminToken,
        );
      });
    });

    describe('successful removal', () => {
      it('should successfully remove user without any chats', async () => {
        const userWithoutChats = await context.factory.createUser(context.org1.name, 'OPERATOR', {
          email: 'no-chats@example.com',
          status: 'ACTIVE',
        });

        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.REMOVE_USER,
          { id: userWithoutChats.id },
          context.adminToken,
        );

        expect(response.removeUser).toBe(true);

        // Verify user status changed to INACTIVE
        const updatedUser = await context.factory.getUserById(userWithoutChats.id);
        expect(updatedUser?.status).toBe('INACTIVE');
      });
    });
  });
});
