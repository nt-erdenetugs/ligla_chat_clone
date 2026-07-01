import {
  ERROR_MESSAGES,
  setupUserTests,
  getSharedTestApp,
  cleanupSharedTestApp,
  USER_QUERIES,
  UserTestContext,
} from '../user-test.setup';

describe('User Module - Query Users (E2E)', () => {
  let context: UserTestContext;

  beforeAll(async () => {
    const baseContext = await getSharedTestApp();
    context = await setupUserTests(baseContext, 'query');
  });

  beforeEach(async () => {
    const updated = await setupUserTests(context, 'query');
    Object.assign(context, updated);
  });

  afterEach(async () => {
    await context.cleaner.cleanUserTestData(context.tenantSchemaNames, context.baselineUsers);
  });

  afterAll(async () => {
    await cleanupSharedTestApp();
  });

  describe('checkUserExists', () => {
    describe('basic functionality', () => {
      it('should return true for existing user email', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.CHECK_USER_EXISTS,
          { email: context.adminUser.email },
          context.adminToken,
        );

        expect(response.checkUserExists).toBe(true);
      });

      it('should return false for non-existent email', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.CHECK_USER_EXISTS,
          { email: 'nonexistent@example.com' },
          context.adminToken,
        );

        expect(response.checkUserExists).toBe(false);
      });

      it('should be case-sensitive', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.CHECK_USER_EXISTS,
          { email: context.adminUser.email.toUpperCase() },
          context.adminToken,
        );

        expect(response.checkUserExists).toBe(false);
      });
    });

    describe('authorization', () => {
      it('should allow MANAGER to check user exists', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.CHECK_USER_EXISTS,
          { email: context.adminUser.email },
          context.managerToken,
        );

        expect(typeof response.checkUserExists).toBe('boolean');
      });

      it('should deny OPERATOR from checking user exists', async () => {
        await context.client.queryExpectError(
          USER_QUERIES.CHECK_USER_EXISTS,
          ERROR_MESSAGES.FORBIDDEN,
          { email: context.adminUser.email },
          context.operatorToken,
        );
      });
    });
  });

  describe('user (single)', () => {
    describe('authorization', () => {
      it('should allow ADMIN to get single user', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_USER,
          { id: context.operatorUser.id },
          context.adminToken,
        );

        expect(response.user.id).toBe(context.operatorUser.id);
        expect(response.user.email).toBe(context.operatorUser.email);
      });

      it('should allow MANAGER to get single user', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_USER,
          { id: context.operatorUser.id },
          context.managerToken,
        );

        expect(response.user.id).toBe(context.operatorUser.id);
      });

      it('should allow OPERATOR to get single user', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_USER,
          { id: context.adminUser.id },
          context.operatorToken,
        );

        expect(response.user.id).toBe(context.adminUser.id);
      });
    });

    describe('error cases', () => {
      it('should prevent cross-organization access', async () => {
        const org2User = await context.factory.createUser(context.org2.name, 'OPERATOR');

        await context.client.queryExpectError(
          USER_QUERIES.GET_USER,
          ERROR_MESSAGES.USER_NOT_FOUND,
          { id: org2User.id },
          context.adminToken,
        );
      });

      it('should return error for non-existent user', async () => {
        await context.client.queryExpectError(
          USER_QUERIES.GET_USER,
          ERROR_MESSAGES.USER_NOT_FOUND,
          { id: '00000000-0000-0000-0000-000000000000' },
          context.adminToken,
        );
      });

      it('should not allow accessing user from different organization', async () => {
        const org2User = await context.factory.createUser(context.org2.name, 'OPERATOR');

        await context.client.queryExpectError(
          USER_QUERIES.GET_USER,
          ERROR_MESSAGES.USER_NOT_FOUND,
          { id: org2User.id },
          context.adminToken, // org1 admin token
        );
      });
    });
  });

  describe('me', () => {
    describe('basic functionality', () => {
      it('should get current user as ADMIN', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_ME,
          {},
          context.adminToken,
        );

        expect(response.me.id).toBe(context.adminUser.id);
        expect(response.me.email).toBe(context.adminUser.email);
        expect(response.me.roleType).toBe('ADMIN');
      });

      it('should get current user as MANAGER', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_ME,
          {},
          context.managerToken,
        );

        expect(response.me.id).toBe(context.managerUser.id);
        expect(response.me.roleType).toBe('MANAGER');
      });

      it('should get current user as OPERATOR', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_ME,
          {},
          context.operatorToken,
        );

        expect(response.me.id).toBe(context.operatorUser.id);
        expect(response.me.roleType).toBe('OPERATOR');
      });

      it('should return empty qrUrl when organization has no loginLiffId', async () => {
        // Create organization without loginLiffId
        const orgWithoutLiff = await context.factory.createOrganization({
          name: 'org_no_liff',
          loginLiffId: null,
        });
        const userWithoutLiff = await context.factory.createUser(orgWithoutLiff.name, 'OPERATOR', {
          status: 'ACTIVE',
        });
        const tokenWithoutLiff = await context.authHelper.getToken(userWithoutLiff.email);

        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_ME,
          {},
          tokenWithoutLiff,
        );

        expect(response.me.id).toBe(userWithoutLiff.id);
        expect(response.me.qrUrl).toBe('');
      });
    });

    describe('authorization', () => {
      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(USER_QUERIES.GET_ME, ERROR_MESSAGES.UNAUTHORIZED, {});
      });
    });
  });

  describe('operatorCount', () => {
    beforeEach(async () => {
      await context.factory.createUser(context.org1.name, 'OPERATOR');
      await context.factory.createUser(context.org1.name, 'OPERATOR');
      await context.factory.createUser(context.org1.name, 'ADMIN_OPERATOR');
    });

    it('should count operators as ADMIN', async () => {
      const response = await context.client.queryExpectSuccess(
        USER_QUERIES.GET_OPERATOR_COUNT,
        {},
        context.adminToken,
      );

      expect(response.operatorCount).toBeGreaterThan(0);
    });

    it('should return 0 for MANAGER', async () => {
      const response = await context.client.queryExpectSuccess(
        USER_QUERIES.GET_OPERATOR_COUNT,
        {},
        context.managerToken,
      );

      expect(response.operatorCount).toBe(0);
    });

    it('should return 0 for OPERATOR', async () => {
      const response = await context.client.queryExpectSuccess(
        USER_QUERIES.GET_OPERATOR_COUNT,
        {},
        context.operatorToken,
      );

      expect(response.operatorCount).toBe(0);
    });
  });
});
