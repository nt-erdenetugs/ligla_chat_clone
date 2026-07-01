import {
  ERROR_MESSAGES,
  setupUserTests,
  getSharedTestApp,
  cleanupSharedTestApp,
  TEST_USERS,
  USER_QUERIES,
  UserTestContext,
  UserTestHelpers,
} from '../user-test.setup';

describe('User Module - Create User (E2E)', () => {
  let context: UserTestContext;

  beforeAll(async () => {
    const baseContext = await getSharedTestApp();
    context = await setupUserTests(baseContext, 'create');
  });

  beforeEach(async () => {
    const updated = await setupUserTests(context, 'create');
    Object.assign(context, updated);
  });

  afterEach(async () => {
    await context.cleaner.cleanUserTestData(context.tenantSchemaNames, context.baselineUsers);
  });

  afterAll(async () => {
    await cleanupSharedTestApp();
  });

  describe('createUser', () => {
    describe('authorization', () => {
      const input = UserTestHelpers.createUserInput(TEST_USERS.BASIC);

      it('should allow ADMIN to create user', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.CREATE_USER,
          { createUserInput: input },
          context.adminToken,
        );

        UserTestHelpers.validateUserFields(response.createUser, {
          email: input.email,
          displayName: input.displayName,
          roleType: input.roleType,
          status: 'PENDING',
        });
      });

      it('should allow MANAGER to create user', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.CREATE_USER,
          {
            createUserInput: UserTestHelpers.createUserInput({
              email: 'manager-created@example.com',
              displayName: 'Manager Created User',
            }),
          },
          context.managerToken,
        );

        expect(response.createUser.email).toBe('manager-created@example.com');
        expect(response.createUser.status).toBe('PENDING');
      });

      it('should deny OPERATOR from creating user', async () => {
        await context.client.queryExpectError(
          USER_QUERIES.CREATE_USER,
          ERROR_MESSAGES.FORBIDDEN,
          { createUserInput: input },
          context.operatorToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          USER_QUERIES.CREATE_USER,
          ERROR_MESSAGES.UNAUTHORIZED,
          { createUserInput: input },
        );
      });
    });

    describe('validation', () => {
      it('should reject duplicate email', async () => {
        await context.client.queryExpectError(
          USER_QUERIES.CREATE_USER,
          ERROR_MESSAGES.USER_ALREADY_EXISTS,
          {
            createUserInput: UserTestHelpers.createUserInput({
              email: context.adminUser.email,
              displayName: 'Duplicate User',
            }),
          },
          context.adminToken,
        );
      });

      it('should reject invalid email format', async () => {
        await context.client.queryExpectError(
          USER_QUERIES.CREATE_USER,
          ERROR_MESSAGES.INVALID_EMAIL,
          {
            createUserInput: UserTestHelpers.createUserInput(TEST_USERS.INVALID_EMAIL),
          },
          context.adminToken,
        );
      });

      it('should reject empty displayName', async () => {
        await context.client.queryExpectError(
          USER_QUERIES.CREATE_USER,
          ERROR_MESSAGES.EMPTY_DISPLAY_NAME,
          {
            createUserInput: UserTestHelpers.createUserInput(TEST_USERS.EMPTY_DISPLAY_NAME),
          },
          context.adminToken,
        );
      });

      it('should reject when operator limit is exceeded', async () => {
        // Create organization with max 2 operators
        const limitedOrg = await context.factory.createOrganization({
          name: 'limited_org',
          maxOperator: 2,
        });
        const limitedAdmin = await context.factory.createUser(limitedOrg.name, 'ADMIN');
        const limitedAdminToken = await context.authHelper.getToken(limitedAdmin.email);

        // Create 2 active operators (reaching the limit)
        await context.factory.createUser(limitedOrg.name, 'OPERATOR', { status: 'ACTIVE' });
        await context.factory.createUser(limitedOrg.name, 'OPERATOR', { status: 'ACTIVE' });

        // Attempt to create a third operator should fail
        await context.client.queryExpectError(
          USER_QUERIES.CREATE_USER,
          ERROR_MESSAGES.MAX_OPERATOR_EXCEEDED,
          {
            createUserInput: UserTestHelpers.createUserInput({
              email: 'third-operator@example.com',
              displayName: 'Third Operator',
              roleType: 'OPERATOR',
            }),
          },
          limitedAdminToken,
        );
      });
    });

    describe('role types', () => {
      const roles = ['OPERATOR', 'MANAGER', 'ADMIN_OPERATOR', 'MANAGER_OPERATOR'];

      roles.forEach((role) => {
        it(`should create user with ${role} role`, async () => {
          const displayName = role === 'MANAGER_OPERATOR' ? 'Manager Op User' : `${role} User`;
          const response = await context.client.queryExpectSuccess(
            USER_QUERIES.CREATE_USER,
            {
              createUserInput: UserTestHelpers.createUserInput({
                email: `${role.toLowerCase()}@example.com`,
                displayName,
                roleType: role,
              }),
            },
            context.adminToken,
          );

          expect(response.createUser.roleType).toBe(role);
        });
      });
    });

    describe('team assignment', () => {
      it('should create user with custom teamIds', async () => {
        const team1 = await context.factory.createTeam(context.org1.name, { name: 'Team 1' });
        const team2 = await context.factory.createTeam(context.org1.name, { name: 'Team 2' });

        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.CREATE_USER,
          {
            createUserInput: UserTestHelpers.createUserInput({
              email: 'teamuser@example.com',
              displayName: 'Team User',
              roleType: 'OPERATOR',
              teamIds: [team1.id, team2.id],
            }),
          },
          context.adminToken,
        );

        expect(response.createUser.email).toBe('teamuser@example.com');
        expect(response.createUser.status).toBe('PENDING');

        // Verify user is assigned to the specified teams
        const user = await context.factory.getUserById(response.createUser.id);
        expect(user?.userTeam).toHaveLength(2);
      });

      it('should create user with default team when no teamIds provided', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.CREATE_USER,
          {
            createUserInput: UserTestHelpers.createUserInput({
              email: 'default-team@example.com',
              displayName: 'Default Team User',
              roleType: 'OPERATOR',
              // teamIds not provided
            }),
          },
          context.adminToken,
        );

        expect(response.createUser.email).toBe('default-team@example.com');

        // Verify user was assigned to default team
        const user = await context.factory.getUserById(response.createUser.id);
        expect(user?.userTeam).toHaveLength(1);
      });
    });

    describe('multi-tenancy', () => {
      it('should prevent same email across organizations', async () => {
        await context.client.queryExpectSuccess(
          USER_QUERIES.CREATE_USER,
          {
            createUserInput: UserTestHelpers.createUserInput(TEST_USERS.CROSS_ORG),
          },
          context.adminToken,
        );

        await context.client.queryExpectError(
          USER_QUERIES.CREATE_USER,
          ERROR_MESSAGES.USER_ALREADY_EXISTS,
          {
            createUserInput: UserTestHelpers.createUserInput(TEST_USERS.CROSS_ORG),
          },
          context.org2AdminToken,
        );
      });
    });

    describe('edge cases', () => {
      it('should handle email case normalization', async () => {
        const upperCaseEmail = 'UPPERCASE@EXAMPLE.COM';

        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.CREATE_USER,
          {
            createUserInput: UserTestHelpers.createUserInput({
              email: upperCaseEmail,
              displayName: 'Case Test User',
              roleType: 'OPERATOR',
            }),
          },
          context.adminToken,
        );

        // Email should be normalized to lowercase
        expect(response.createUser.email).toBe(upperCaseEmail.toLowerCase());
      });
    });
  });
});
