import {
  ERROR_MESSAGES,
  setupUserTests,
  getSharedTestApp,
  cleanupSharedTestApp,
  USER_QUERIES,
  UserTestContext,
} from '../user-test.setup';

describe('User Module - Role-based Queries (E2E)', () => {
  let context: UserTestContext;

  beforeAll(async () => {
    const baseContext = await getSharedTestApp();
    context = await setupUserTests(baseContext, 'role');
  });

  beforeEach(async () => {
    const updated = await setupUserTests(context, 'role');
    Object.assign(context, updated);
  });

  afterEach(async () => {
    await context.cleaner.cleanUserTestData(context.tenantSchemaNames, context.baselineUsers);
  });

  afterAll(async () => {
    await cleanupSharedTestApp();
  });

  describe('managers', () => {
    beforeEach(async () => {
      await context.factory.createUser(context.org1.name, 'MANAGER', { displayName: 'Manager 1' });
      await context.factory.createUser(context.org1.name, 'MANAGER', { displayName: 'Manager 2' });
      await context.factory.createUser(context.org1.name, 'MANAGER_OPERATOR', {
        displayName: 'Manager Operator',
      });
      await context.factory.createUser(context.org2.name, 'MANAGER', {
        displayName: 'Org2 Manager',
      });
    });

    describe('basic listing', () => {
      it('should list managers for organization as ADMIN', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_MANAGERS,
          {},
          context.adminToken,
        );

        expect(response.managers.items).toBeInstanceOf(Array);
        expect(response.managers.items.length).toBeGreaterThan(0);
        expect(
          response.managers.items.every(
            (user: any) => user.roleType === 'MANAGER' || user.roleType === 'MANAGER_OPERATOR',
          ),
        ).toBe(true);
      });

      it('should support cursor pagination', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_MANAGERS,
          { take: 2 },
          context.adminToken,
        );

        expect(response.managers.items).toHaveLength(2);
        expect(typeof response.managers.hasMore).toBe('boolean');
      });
    });

    describe('multi-tenancy', () => {
      it('should not list managers from other organizations', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_MANAGERS,
          {},
          context.adminToken,
        );

        expect(
          response.managers.items.every((user: any) => !user.displayName?.includes('Org2')),
        ).toBe(true);
      });
    });

    describe('authorization', () => {
      it('should deny OPERATOR from listing managers', async () => {
        await context.client.queryExpectError(
          USER_QUERIES.GET_MANAGERS,
          ERROR_MESSAGES.FORBIDDEN,
          {},
          context.operatorToken,
        );
      });
    });
  });

  describe('adminOperators', () => {
    beforeEach(async () => {
      await context.factory.createUser(context.org1.name, 'ADMIN_OPERATOR', {
        displayName: 'Admin Operator 1',
      });
      await context.factory.createUser(context.org1.name, 'ADMIN_OPERATOR', {
        displayName: 'Admin Operator 2',
      });
    });

    describe('basic listing', () => {
      it('should list admin operators as ADMIN', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_ADMIN_OPERATORS,
          {},
          context.adminToken,
        );

        expect(response.adminOperators.items).toBeInstanceOf(Array);
        expect(response.adminOperators.items.length).toBeGreaterThan(0);
        expect(
          response.adminOperators.items.every((user: any) => user.roleType === 'ADMIN_OPERATOR'),
        ).toBe(true);
      });

      it('should support cursor pagination', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_ADMIN_OPERATORS,
          { take: 1 },
          context.adminToken,
        );

        expect(response.adminOperators.items).toHaveLength(1);
      });

      it('should allow MANAGER to list admin operators', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_ADMIN_OPERATORS,
          {},
          context.managerToken,
        );

        expect(response.adminOperators.items).toBeInstanceOf(Array);
      });
    });

    describe('authorization', () => {
      it('should deny OPERATOR from listing admin operators', async () => {
        await context.client.queryExpectError(
          USER_QUERIES.GET_ADMIN_OPERATORS,
          ERROR_MESSAGES.FORBIDDEN,
          {},
          context.operatorToken,
        );
      });
    });
  });

  describe('allSelectableOperators', () => {
    beforeEach(async () => {
      await context.factory.createUser(context.org1.name, 'OPERATOR', {
        displayName: 'Operator 1',
      });
      await context.factory.createUser(context.org1.name, 'OPERATOR', {
        displayName: 'Operator 2',
      });
      await context.factory.createUser(context.org1.name, 'ADMIN_OPERATOR', {
        displayName: 'Admin Operator',
      });
      await context.factory.createUser(context.org1.name, 'MANAGER_OPERATOR', {
        displayName: 'Manager Operator',
      });
    });

    it('should list all selectable operators as ADMIN', async () => {
      const response = await context.client.queryExpectSuccess(
        USER_QUERIES.GET_ALL_SELECTABLE_OPERATORS,
        {},
        context.adminToken,
      );

      expect(response.allSelectableOperators.items).toBeInstanceOf(Array);
      expect(response.allSelectableOperators.items.length).toBeGreaterThan(0);
    });

    it('should list all selectable operators as OPERATOR', async () => {
      const response = await context.client.queryExpectSuccess(
        USER_QUERIES.GET_ALL_SELECTABLE_OPERATORS,
        {},
        context.operatorToken,
      );

      expect(response.allSelectableOperators.items).toBeInstanceOf(Array);
    });

    it('should support cursor pagination', async () => {
      const response = await context.client.queryExpectSuccess(
        USER_QUERIES.GET_ALL_SELECTABLE_OPERATORS,
        { take: 2 },
        context.adminToken,
      );

      expect(response.allSelectableOperators.items.length).toBeLessThanOrEqual(2);
    });

    it('should deny unauthenticated access', async () => {
      await context.client.queryExpectError(
        USER_QUERIES.GET_ALL_SELECTABLE_OPERATORS,
        ERROR_MESSAGES.UNAUTHORIZED,
        {},
      );
    });
  });
});
