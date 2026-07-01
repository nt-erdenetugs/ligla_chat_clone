import {
  ERROR_MESSAGES,
  setupUserTests,
  getSharedTestApp,
  cleanupSharedTestApp,
  USER_QUERIES,
  UserTestContext,
  UserTestHelpers,
} from '../user-test.setup';

describe('User Module - Edge Cases (E2E)', () => {
  let context: UserTestContext;

  beforeAll(async () => {
    const baseContext = await getSharedTestApp();
    context = await setupUserTests(baseContext, 'edge');
  });

  beforeEach(async () => {
    const updated = await setupUserTests(context, 'edge');
    Object.assign(context, updated);
  });

  afterEach(async () => {
    await context.cleaner.cleanUserTestData(context.tenantSchemaNames, context.baselineUsers);
  });

  afterAll(async () => {
    await cleanupSharedTestApp();
  });

  describe('operator limit validation on status change', () => {
    it('should prevent activating inactive operator when limit exceeded', async () => {
      const limitedOrg = await context.factory.createOrganization({
        name: 'limited_org_status',
        maxOperator: 1,
      });
      const limitedAdmin = await context.factory.createUser(limitedOrg.name, 'ADMIN');
      const limitedAdminToken = await context.authHelper.getToken(limitedAdmin.email);

      // Create one active operator (reaching the limit)
      await context.factory.createUser(limitedOrg.name, 'OPERATOR', { status: 'ACTIVE' });

      // Create an inactive operator
      const inactiveOperator = await context.factory.createUser(limitedOrg.name, 'OPERATOR', {
        status: 'INACTIVE',
      });

      // Attempt to activate should fail
      await context.client.queryExpectError(
        USER_QUERIES.UPDATE_USER,
        ERROR_MESSAGES.MAX_OPERATOR_EXCEEDED,
        {
          updateUserInput: UserTestHelpers.updateUserInput(inactiveOperator.id, {
            status: 'ACTIVE',
            roleType: 'OPERATOR',
          }),
        },
        limitedAdminToken,
      );
    });

    it('should prevent changing non-operator to operator when limit exceeded', async () => {
      const limitedOrg = await context.factory.createOrganization({
        name: 'limited_org_role_change',
        maxOperator: 1,
      });
      const limitedAdmin = await context.factory.createUser(limitedOrg.name, 'ADMIN');
      const limitedAdminToken = await context.authHelper.getToken(limitedAdmin.email);

      // Create one active operator (reaching the limit)
      await context.factory.createUser(limitedOrg.name, 'OPERATOR', { status: 'ACTIVE' });

      // Create an active manager
      const manager = await context.factory.createUser(limitedOrg.name, 'MANAGER', {
        status: 'ACTIVE',
      });

      // Attempt to change to operator role should fail
      await context.client.queryExpectError(
        USER_QUERIES.UPDATE_USER,
        ERROR_MESSAGES.MAX_OPERATOR_EXCEEDED,
        {
          updateUserInput: UserTestHelpers.updateUserInput(manager.id, {
            roleType: 'OPERATOR',
          }),
        },
        limitedAdminToken,
      );
    });
  });

  describe('organization validation', () => {
    it('should handle organization without maxOperator limit', async () => {
      const unlimitedOrg = await context.factory.createOrganization({
        name: 'unlimited_org',
        maxOperator: null, // No limit
      });
      const unlimitedAdmin = await context.factory.createUser(unlimitedOrg.name, 'ADMIN');
      const unlimitedAdminToken = await context.authHelper.getToken(unlimitedAdmin.email);

      // Should be able to create many operators
      for (let i = 0; i < 3; i++) {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.CREATE_USER,
          {
            createUserInput: UserTestHelpers.createUserInput({
              email: `unlimited-op-${i}@example.com`,
              displayName: `Unlimited Operator ${i}`,
              roleType: 'OPERATOR',
            }),
          },
          unlimitedAdminToken,
        );

        expect(response.createUser.roleType).toBe('OPERATOR');
      }
    });
  });

  describe('last admin validation', () => {
    it('should prevent deactivating the only active admin', async () => {
      // Create org with only one admin
      const singleAdminOrg = await context.factory.createOrganization({
        name: 'single_admin_org',
      });
      const singleAdmin = await context.factory.createUser(singleAdminOrg.name, 'ADMIN', {
        status: 'ACTIVE',
      });
      const singleAdminToken = await context.authHelper.getToken(singleAdmin.email);

      // Create another admin but INACTIVE
      await context.factory.createUser(singleAdminOrg.name, 'ADMIN', {
        status: 'INACTIVE',
      });

      // Attempt to deactivate the only active admin should fail
      await context.client.queryExpectError(
        USER_QUERIES.UPDATE_USER,
        ERROR_MESSAGES.LAST_ADMIN,
        {
          updateUserInput: UserTestHelpers.updateUserInput(singleAdmin.id, {
            status: 'INACTIVE',
            roleType: 'ADMIN',
          }),
        },
        singleAdminToken,
      );
    });

    it('should allow deactivating admin when multiple active admins exist', async () => {
      const multiAdminOrg = await context.factory.createOrganization({
        name: 'multi_admin_org',
      });
      const admin1 = await context.factory.createUser(multiAdminOrg.name, 'ADMIN', {
        status: 'ACTIVE',
      });
      const admin2 = await context.factory.createUser(multiAdminOrg.name, 'ADMIN', {
        status: 'ACTIVE',
      });
      const admin1Token = await context.authHelper.getToken(admin1.email);

      // Should be able to deactivate one admin when another exists
      const response = await context.client.queryExpectSuccess(
        USER_QUERIES.UPDATE_USER,
        {
          updateUserInput: UserTestHelpers.updateUserInput(admin2.id, {
            status: 'INACTIVE',
            roleType: 'ADMIN',
          }),
        },
        admin1Token,
      );

      expect(response.updateUser.status).toBe('INACTIVE');
    });
  });

  describe('multi-role operator validation', () => {
    it('should count ADMIN_OPERATOR towards operator limit', async () => {
      const limitedOrg = await context.factory.createOrganization({
        name: 'limited_admin_op_org',
        maxOperator: 2,
      });
      const limitedAdmin = await context.factory.createUser(limitedOrg.name, 'ADMIN');
      const limitedAdminToken = await context.authHelper.getToken(limitedAdmin.email);

      // Create 2 ADMIN_OPERATOR users (reaching the limit)
      await context.factory.createUser(limitedOrg.name, 'ADMIN_OPERATOR', { status: 'ACTIVE' });
      await context.factory.createUser(limitedOrg.name, 'ADMIN_OPERATOR', { status: 'ACTIVE' });

      // Attempt to create another operator should fail
      await context.client.queryExpectError(
        USER_QUERIES.CREATE_USER,
        ERROR_MESSAGES.MAX_OPERATOR_EXCEEDED,
        {
          createUserInput: UserTestHelpers.createUserInput({
            email: 'third-admin-op@example.com',
            displayName: 'Third Admin Operator',
            roleType: 'OPERATOR',
          }),
        },
        limitedAdminToken,
      );
    });

    it('should count MANAGER_OPERATOR towards operator limit', async () => {
      const limitedOrg = await context.factory.createOrganization({
        name: 'limited_manager_op_org',
        maxOperator: 1,
      });
      const limitedAdmin = await context.factory.createUser(limitedOrg.name, 'ADMIN');
      const limitedAdminToken = await context.authHelper.getToken(limitedAdmin.email);

      // Create 1 MANAGER_OPERATOR user (reaching the limit)
      await context.factory.createUser(limitedOrg.name, 'MANAGER_OPERATOR', { status: 'ACTIVE' });

      // Attempt to create another operator should fail
      await context.client.queryExpectError(
        USER_QUERIES.CREATE_USER,
        ERROR_MESSAGES.MAX_OPERATOR_EXCEEDED,
        {
          createUserInput: UserTestHelpers.createUserInput({
            email: 'second-operator@example.com',
            displayName: 'Second Operator',
            roleType: 'OPERATOR',
          }),
        },
        limitedAdminToken,
      );
    });
  });
});
