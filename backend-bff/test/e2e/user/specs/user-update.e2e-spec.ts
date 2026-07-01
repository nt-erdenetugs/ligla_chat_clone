import {
  ERROR_MESSAGES,
  setupUserTests,
  getSharedTestApp,
  cleanupSharedTestApp,
  TEST_USERS,
  TEST_VALUES,
  USER_QUERIES,
  UserTestContext,
  UserTestHelpers,
} from '../user-test.setup';

describe('User Module - Update Users (E2E)', () => {
  let context: UserTestContext;

  beforeAll(async () => {
    const baseContext = await getSharedTestApp();
    context = await setupUserTests(baseContext, 'update');
  });

  beforeEach(async () => {
    const updated = await setupUserTests(context, 'update');
    Object.assign(context, updated);
  });

  afterEach(async () => {
    await context.cleaner.cleanUserTestData(context.tenantSchemaNames, context.baselineUsers);
  });

  afterAll(async () => {
    await cleanupSharedTestApp();
  });

  describe('updateUser', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await context.factory.createUser(
        context.org1.name,
        'OPERATOR',
        TEST_USERS.FOR_UPDATE,
      );
    });

    describe('authorization', () => {
      it('should allow ADMIN to update user', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.UPDATE_USER,
          {
            updateUserInput: UserTestHelpers.updateUserInput(testUser.id, {
              displayName: TEST_VALUES.UPDATED,
            }),
          },
          context.adminToken,
        );

        expect(response.updateUser.displayName).toBe(TEST_VALUES.UPDATED);
      });

      it('should allow MANAGER to update user', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.UPDATE_USER,
          {
            updateUserInput: UserTestHelpers.updateUserInput(testUser.id, {
              displayName: 'Manager Updated',
            }),
          },
          context.managerToken,
        );

        expect(response.updateUser.displayName).toBe('Manager Updated');
      });

      it('should deny OPERATOR from updating another user', async () => {
        await context.client.queryExpectError(
          USER_QUERIES.UPDATE_USER,
          ERROR_MESSAGES.FORBIDDEN,
          {
            updateUserInput: UserTestHelpers.updateUserInput(testUser.id, {
              displayName: 'Hacked',
            }),
          },
          context.operatorToken,
        );
      });

      it('should prevent MANAGER from updating ADMIN', async () => {
        await context.client.queryExpectError(
          USER_QUERIES.UPDATE_USER,
          ERROR_MESSAGES.NO_PERMISSION_TO_MODIFY,
          {
            updateUserInput: UserTestHelpers.updateUserInput(context.adminUser.id, {
              displayName: 'Unauthorized Update',
              roleType: 'ADMIN',
            }),
          },
          context.managerToken,
        );
      });
    });

    describe('validation', () => {
      it('should update display name', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.UPDATE_USER,
          {
            updateUserInput: UserTestHelpers.updateUserInput(testUser.id, {
              displayName: 'New Display Name',
            }),
          },
          context.adminToken,
        );

        expect(response.updateUser.displayName).toBe('New Display Name');
      });

      it('should update role type', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.UPDATE_USER,
          {
            updateUserInput: UserTestHelpers.updateUserInput(testUser.id, {
              roleType: 'MANAGER',
            }),
          },
          context.adminToken,
        );

        expect(response.updateUser.roleType).toBe('MANAGER');
      });

      it('should update status', async () => {
        const activeUser = await context.factory.createUser(context.org1.name, 'OPERATOR', {
          status: 'ACTIVE',
        });

        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.UPDATE_USER,
          {
            updateUserInput: UserTestHelpers.updateUserInput(activeUser.id, {
              status: 'INACTIVE',
            }),
          },
          context.adminToken,
        );

        expect(response.updateUser.status).toBe('INACTIVE');
      });
    });

    describe('role change validations', () => {
      it('should prevent admin to non-admin role change', async () => {
        // Create a second admin so we're not trying to demote the last admin
        await context.factory.createUser(context.org1.name, 'ADMIN', {
          status: 'ACTIVE',
        });

        await context.client.queryExpectError(
          USER_QUERIES.UPDATE_USER,
          ERROR_MESSAGES.ADMIN_TO_NON_ADMIN_ERROR,
          {
            updateUserInput: UserTestHelpers.updateUserInput(context.adminUser.id, {
              displayName: context.adminUser.displayName,
              roleType: 'MANAGER',
            }),
          },
          context.adminToken,
        );
      });

      it('should validate no active chats when changing from operator to non-operator role', async () => {
        const operatorUser = await context.factory.createUser(context.org1.name, 'OPERATOR', {
          status: 'ACTIVE',
        });

        // Create an addressing chat assigned to the operator
        const chat = await context.factory.createChat(context.org1.name, {
          chatStatus: 'ADDRESSING',
        });
        await context.factory.assignUserToChat(chat.id, operatorUser.id);

        await context.client.queryExpectError(
          USER_QUERIES.UPDATE_USER,
          ERROR_MESSAGES.HAS_ONGOING_CHAT,
          {
            updateUserInput: UserTestHelpers.updateUserInput(operatorUser.id, {
              roleType: 'MANAGER',
            }),
          },
          context.adminToken,
        );
      });

      it('should allow role change from operator to non-operator when no active chats', async () => {
        const operatorUser = await context.factory.createUser(context.org1.name, 'OPERATOR', {
          status: 'ACTIVE',
        });

        // Create a done chat (not blocking)
        const doneChat = await context.factory.createChat(context.org1.name, {
          chatStatus: 'DONE',
        });
        await context.factory.assignUserToChat(doneChat.id, operatorUser.id);

        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.UPDATE_USER,
          {
            updateUserInput: UserTestHelpers.updateUserInput(operatorUser.id, {
              roleType: 'MANAGER',
            }),
          },
          context.adminToken,
        );

        expect(response.updateUser.roleType).toBe('MANAGER');
      });
    });

    describe('error cases', () => {
      it('should prevent cross-organization update', async () => {
        const org2User = await context.factory.createUser(context.org2.name, 'OPERATOR');

        await context.client.queryExpectError(
          USER_QUERIES.UPDATE_USER,
          ERROR_MESSAGES.USER_NOT_FOUND,
          {
            updateUserInput: UserTestHelpers.updateUserInput(org2User.id, {
              displayName: 'Hacked',
            }),
          },
          context.adminToken,
        );
      });

      it('should prevent demoting last ADMIN', async () => {
        await context.client.queryExpectError(
          USER_QUERIES.UPDATE_USER,
          ERROR_MESSAGES.LAST_ADMIN,
          {
            updateUserInput: UserTestHelpers.updateUserInput(context.adminUser.id, {
              displayName: context.adminUser.displayName,
              roleType: 'OPERATOR',
            }),
          },
          context.adminToken,
        );
      });

      it('should prevent user from deactivating themselves', async () => {
        // Create a second admin so we're not trying to deactivate the last admin
        await context.factory.createUser(context.org1.name, 'ADMIN', {
          status: 'ACTIVE',
        });

        await context.client.queryExpectError(
          USER_QUERIES.UPDATE_USER,
          ERROR_MESSAGES.CANNOT_DEACTIVATE,
          {
            updateUserInput: UserTestHelpers.updateUserInput(context.adminUser.id, {
              displayName: context.adminUser.displayName,
              roleType: 'ADMIN',
              status: 'INACTIVE',
            }),
          },
          context.adminToken,
        );
      });

      it('should prevent deactivating admin when they are the last active admin', async () => {
        // Create another admin but make them inactive
        await context.factory.createUser(context.org1.name, 'ADMIN', {
          status: 'INACTIVE',
        });

        await context.client.queryExpectError(
          USER_QUERIES.UPDATE_USER,
          ERROR_MESSAGES.LAST_ADMIN,
          {
            updateUserInput: UserTestHelpers.updateUserInput(context.adminUser.id, {
              displayName: context.adminUser.displayName,
              roleType: 'ADMIN',
              status: 'INACTIVE',
            }),
          },
          context.adminToken,
        );
      });

      it('should prevent deactivating operator with active chats', async () => {
        const operatorUser = await context.factory.createUser(context.org1.name, 'OPERATOR', {
          status: 'ACTIVE',
        });

        const addressingChat = await context.factory.createChat(context.org1.name, {
          chatStatus: 'ADDRESSING',
        });
        await context.factory.assignUserToChat(addressingChat.id, operatorUser.id);

        await context.client.queryExpectError(
          USER_QUERIES.UPDATE_USER,
          ERROR_MESSAGES.HAS_ONGOING_CHAT,
          {
            updateUserInput: UserTestHelpers.updateUserInput(operatorUser.id, {
              status: 'INACTIVE',
            }),
          },
          context.adminToken,
        );
      });
    });

    describe('edge cases', () => {
      it('should allow updating user without changing status', async () => {
        const testUser = await context.factory.createUser(context.org1.name, 'OPERATOR', {
          status: 'ACTIVE',
          displayName: 'Original Name',
        });

        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.UPDATE_USER,
          {
            updateUserInput: UserTestHelpers.updateUserInput(testUser.id, {
              displayName: 'Updated Name',
              roleType: 'OPERATOR',
              status: 'ACTIVE', // Same status
            }),
          },
          context.adminToken,
        );

        expect(response.updateUser.displayName).toBe('Updated Name');
        expect(response.updateUser.status).toBe('ACTIVE');
      });

      it('should reset login attempts when changing status', async () => {
        const lockedUser = await context.factory.createUser(context.org1.name, 'OPERATOR', {
          status: 'LOCKED',
        });

        // Update status to INACTIVE (which triggers login attempts reset)
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.UPDATE_USER,
          {
            updateUserInput: UserTestHelpers.updateUserInput(lockedUser.id, {
              status: 'INACTIVE',
            }),
          },
          context.adminToken,
        );

        expect(response.updateUser.status).toBe('INACTIVE');

        // Verify in database that loginAttempts was reset
        const updatedUser = await context.factory.getUserById(lockedUser.id);
        expect(updatedUser?.loginAttempts).toBe(0);
      });
    });
  });

  describe('toggleUserStatus', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await context.factory.createUser(context.org1.name, 'OPERATOR', {
        status: 'ACTIVE',
      });
    });

    describe('basic toggle operations', () => {
      it('should toggle from ACTIVE to INACTIVE', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.TOGGLE_USER_STATUS,
          { id: testUser.id },
          context.adminToken,
        );

        expect(response.toggleUserStatus.status).toBe('INACTIVE');
      });

      it('should only toggle the target user status', async () => {
        const anotherUser = await context.factory.createUser(context.org1.name, 'OPERATOR', {
          status: 'ACTIVE',
        });

        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.TOGGLE_USER_STATUS,
          { id: testUser.id },
          context.adminToken,
        );

        expect(response.toggleUserStatus.id).toBe(testUser.id);
        expect(response.toggleUserStatus.status).toBe('INACTIVE');

        const unaffectedUser = await context.factory.getUserById(anotherUser.id);
        expect(unaffectedUser?.status).toBe('ACTIVE');
      });

      it('should toggle from INACTIVE to ACTIVE', async () => {
        const inactiveUser = await context.factory.createUser(context.org1.name, 'OPERATOR', {
          status: 'INACTIVE',
        });

        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.TOGGLE_USER_STATUS,
          { id: inactiveUser.id },
          context.adminToken,
        );

        expect(response.toggleUserStatus.status).toBe('ACTIVE');
      });
    });

    describe('authorization', () => {
      it('should allow MANAGER to toggle status', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.TOGGLE_USER_STATUS,
          { id: testUser.id },
          context.managerToken,
        );

        expect(response.toggleUserStatus.status).toBe('INACTIVE');
      });

      it('should deny OPERATOR from toggling status', async () => {
        await context.client.queryExpectError(
          USER_QUERIES.TOGGLE_USER_STATUS,
          ERROR_MESSAGES.FORBIDDEN,
          { id: testUser.id },
          context.operatorToken,
        );
      });
    });

    describe('error cases', () => {
      it('should reject toggling PENDING user', async () => {
        const pendingUser = await context.factory.createUser(context.org1.name, 'OPERATOR', {
          status: 'PENDING',
        });

        await context.client.queryExpectError(
          USER_QUERIES.TOGGLE_USER_STATUS,
          ERROR_MESSAGES.NOT_ACCEPTED_INVITATION,
          { id: pendingUser.id },
          context.adminToken,
        );
      });

      it('should prevent cross-organization toggle', async () => {
        const org2User = await context.factory.createUser(context.org2.name, 'OPERATOR');

        await context.client.queryExpectError(
          USER_QUERIES.TOGGLE_USER_STATUS,
          ERROR_MESSAGES.USER_NOT_FOUND,
          { id: org2User.id },
          context.adminToken,
        );
      });

      it('should prevent admin from deactivating themselves via toggle', async () => {
        // Create a second admin so we're not the last admin
        await context.factory.createUser(context.org1.name, 'ADMIN', {
          status: 'ACTIVE',
        });

        await context.client.queryExpectError(
          USER_QUERIES.TOGGLE_USER_STATUS,
          ERROR_MESSAGES.CANNOT_DEACTIVATE,
          { id: context.adminUser.id },
          context.adminToken,
        );
      });
    });
  });

  describe('updateDisplayName', () => {
    describe('basic functionality', () => {
      it('should allow user to update own display name', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.UPDATE_DISPLAY_NAME,
          {
            updateDisplayNameInput: UserTestHelpers.updateDisplayNameInput(
              TEST_VALUES.DISPLAY_NAME_NEW,
            ),
          },
          context.adminToken,
        );

        expect(response.updateDisplayName.displayName).toBe(TEST_VALUES.DISPLAY_NAME_NEW);
      });

      it('should allow OPERATOR to update their own display name', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.UPDATE_DISPLAY_NAME,
          {
            updateDisplayNameInput: UserTestHelpers.updateDisplayNameInput('Operator New Name'),
          },
          context.operatorToken,
        );

        expect(response.updateDisplayName.displayName).toBe('Operator New Name');
      });
    });

    describe('validation', () => {
      it('should reject empty display name', async () => {
        await context.client.queryExpectError(
          USER_QUERIES.UPDATE_DISPLAY_NAME,
          ERROR_MESSAGES.EMPTY_DISPLAY_NAME,
          {
            updateDisplayNameInput: UserTestHelpers.updateDisplayNameInput(''),
          },
          context.adminToken,
        );
      });

      it('should reject whitespace-only display name', async () => {
        await context.client.queryExpectError(
          USER_QUERIES.UPDATE_DISPLAY_NAME,
          'Display name cannot be empty',
          {
            updateDisplayNameInput: UserTestHelpers.updateDisplayNameInput('   '),
          },
          context.adminToken,
        );
      });

      it('should trim whitespace from display name', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.UPDATE_DISPLAY_NAME,
          {
            updateDisplayNameInput: UserTestHelpers.updateDisplayNameInput('  Trimmed Name  '),
          },
          context.adminToken,
        );

        expect(response.updateDisplayName.displayName).toBe('Trimmed Name');
      });
    });

    describe('authorization', () => {
      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          USER_QUERIES.UPDATE_DISPLAY_NAME,
          ERROR_MESSAGES.UNAUTHORIZED,
          {
            updateDisplayNameInput: UserTestHelpers.updateDisplayNameInput('Unauthorized Name'),
          },
        );
      });
    });
  });

  describe('updateSenderName', () => {
    describe('basic functionality', () => {
      it('should allow user to update own sender name', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.UPDATE_SENDER_NAME,
          {
            updateSenderNameInput: UserTestHelpers.updateSenderNameInput(
              TEST_VALUES.SENDER_NAME_NEW,
            ),
          },
          context.adminToken,
        );

        expect(response.updateSenderName.senderName).toBe(TEST_VALUES.SENDER_NAME_NEW);
      });

      it('should allow OPERATOR to update their own sender name', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.UPDATE_SENDER_NAME,
          {
            updateSenderNameInput: UserTestHelpers.updateSenderNameInput('Operator Alias'),
          },
          context.operatorToken,
        );

        expect(response.updateSenderName.senderName).toBe('Operator Alias');
      });

      it('should allow empty sender name', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.UPDATE_SENDER_NAME,
          {
            updateSenderNameInput: UserTestHelpers.updateSenderNameInput(''),
          },
          context.adminToken,
        );

        expect(response.updateSenderName.senderName).toBeNull();
      });

      it('should trim whitespace from sender name', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.UPDATE_SENDER_NAME,
          {
            updateSenderNameInput: UserTestHelpers.updateSenderNameInput('  Trimmed Name  '),
          },
          context.adminToken,
        );

        expect(response.updateSenderName.senderName).toBe('Trimmed Name');
      });

      it('should treat whitespace-only sender name as null', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.UPDATE_SENDER_NAME,
          {
            updateSenderNameInput: UserTestHelpers.updateSenderNameInput('   '),
          },
          context.adminToken,
        );

        expect(response.updateSenderName.senderName).toBeNull();
      });
    });

    describe('authorization', () => {
      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          USER_QUERIES.UPDATE_SENDER_NAME,
          ERROR_MESSAGES.UNAUTHORIZED,
          {
            updateSenderNameInput: UserTestHelpers.updateSenderNameInput('Unauthorized Name'),
          },
        );
      });
    });
  });
});
