import {
  ERROR_MESSAGES,
  setupUserTests,
  getSharedTestApp,
  cleanupSharedTestApp,
  TestValidators,
  USER_QUERIES,
  UserTestContext,
} from '../user-test.setup';

describe('User Module - List Users (E2E)', () => {
  let context: UserTestContext;

  beforeAll(async () => {
    const baseContext = await getSharedTestApp();
    context = await setupUserTests(baseContext, 'list');
  });

  beforeEach(async () => {
    const updated = await setupUserTests(context, 'list');
    Object.assign(context, updated);
  });

  afterEach(async () => {
    await context.cleaner.cleanUserTestData(context.tenantSchemaNames, context.baselineUsers);
  });

  afterAll(async () => {
    await cleanupSharedTestApp();
  });

  describe('users (list)', () => {
    beforeEach(async () => {
      await context.factory.createUser(context.org1.name, 'OPERATOR', {
        displayName: 'Operator 1',
      });
      await context.factory.createUser(context.org1.name, 'OPERATOR', {
        displayName: 'Operator 2',
      });
      await context.factory.createUser(context.org2.name, 'OPERATOR', {
        displayName: 'Org2 Operator',
      });
    });

    describe('basic listing', () => {
      it('should list users for organization as ADMIN', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_USERS,
          {},
          context.adminToken,
        );

        expect(response.users.items).toBeInstanceOf(Array);
        expect(response.users.items.length).toBeGreaterThanOrEqual(3);
        expect(response.users.count).toBeGreaterThanOrEqual(3);
      });

      it('should list users for organization as MANAGER (limited to own teams)', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_USERS,
          {},
          context.managerToken,
        );

        expect(response.users.items).toBeInstanceOf(Array);
      });

      it('should allow OPERATOR to list only accessible team members', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_USERS,
          {},
          context.operatorToken,
        );

        expect(response.users.items).toBeInstanceOf(Array);
        expect(response.users.items.length).toBeGreaterThan(0);
        expect(response.users.items.some((user: any) => user.id === context.operatorUser.id)).toBe(
          true,
        );
        expect(
          response.users.items.every((user: any) =>
            ['MANAGER', 'MANAGER_OPERATOR', 'OPERATOR'].includes(user.roleType),
          ),
        ).toBe(true);
      });

      it('should order by createdAt descending', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_USERS,
          {},
          context.adminToken,
        );

        expect(response.users.items).toBeInstanceOf(Array);
        expect(response.users.items.length).toBeGreaterThan(0);
        TestValidators.validateDescendingOrder(response.users.items);
      });
    });

    describe('pagination', () => {
      it('should respect skip and take', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_USERS,
          { skip: 1, take: 2 },
          context.adminToken,
        );

        expect(response.users.items.length).toBeLessThanOrEqual(2);
      });

      it('should handle skip only', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_USERS,
          { skip: 1 },
          context.adminToken,
        );

        expect(response.users.items.length).toBeGreaterThanOrEqual(0);
      });

      it('should handle take only', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_USERS,
          { take: 2 },
          context.adminToken,
        );

        expect(response.users.items.length).toBeLessThanOrEqual(2);
      });
    });

    describe('multi-tenancy', () => {
      it('should not list users from other organizations', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_USERS,
          {},
          context.adminToken,
        );

        const org2AdminEmail = `admin@${context.org2.name.replace(/_/g, '-')}.test`;
        const org2AdminUser = await context.factory.findUserByEmail(org2AdminEmail);
        const org2Users = response.users.items.filter((user: any) => user.id === org2AdminUser?.id);
        expect(org2Users.length).toBe(0);
      });

      it('should isolate counts per organization', async () => {
        const org1Response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_USERS,
          {},
          context.adminToken,
        );

        const org2Response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_USERS,
          {},
          context.org2AdminToken,
        );

        expect(org1Response.users.count).toBeGreaterThanOrEqual(3);
        expect(org2Response.users.count).toBeGreaterThanOrEqual(1);
      });
    });

    describe('filtering', () => {
      beforeEach(async () => {
        await context.cleaner.cleanUserTestData(context.tenantSchemaNames);
        const refreshed = await setupUserTests(context, 'list');
        Object.assign(context, refreshed);

        await context.factory.createUser(context.org1.name, 'OPERATOR', {
          displayName: 'John Smith',
          email: 'john.smith@test.com',
          senderName: 'Johnny',
        });
        await context.factory.createUser(context.org1.name, 'OPERATOR', {
          displayName: 'Jane Doe',
          email: 'jane.doe@test.com',
          senderName: 'JD Sender',
        });
        await context.factory.createUser(context.org1.name, 'OPERATOR', {
          displayName: 'Bob Johnson',
          email: 'bob.johnson@test.com',
        });
        await context.factory.createUser(context.org1.name, 'MANAGER', {
          displayName: 'Manager One',
          email: 'manager.one@test.com',
        });
        await context.factory.createUser(context.org1.name, 'OPERATOR', {
          displayName: 'Inactive Operator',
          email: 'inactive.operator@test.com',
          status: 'INACTIVE',
        });
      });

      describe('searchValue', () => {
        it('should filter by searchValue (case-insensitive)', async () => {
          const response = await context.client.queryExpectSuccess(
            USER_QUERIES.GET_USERS,
            { filter: { searchValue: 'john' } },
            context.adminToken,
          );

          expect(response.users.items).toBeInstanceOf(Array);
          expect(response.users.items.length).toBeGreaterThanOrEqual(2);
          expect(
            response.users.items.every(
              (user: any) =>
                user.displayName.toLowerCase().includes('john') ||
                user.email.toLowerCase().includes('john'),
            ),
          ).toBe(true);
        });

        it('should return empty for non-matching search', async () => {
          const response = await context.client.queryExpectSuccess(
            USER_QUERIES.GET_USERS,
            { filter: { searchValue: 'NonExistent' } },
            context.adminToken,
          );

          expect(response.users.items).toHaveLength(0);
        });

        it('should match by senderName (case-insensitive)', async () => {
          const response = await context.client.queryExpectSuccess(
            USER_QUERIES.GET_USERS,
            { filter: { searchValue: 'johnny' } },
            context.adminToken,
          );

          expect(response.users.items.length).toBeGreaterThanOrEqual(1);
          expect(response.users.items.some((user: any) => user.senderName === 'Johnny')).toBe(true);
        });

        it('should match by senderName independently of displayName', async () => {
          const response = await context.client.queryExpectSuccess(
            USER_QUERIES.GET_USERS,
            { filter: { searchValue: 'JD Sender' } },
            context.adminToken,
          );

          expect(response.users.items).toHaveLength(1);
          expect(response.users.items[0].senderName).toBe('JD Sender');
          expect(response.users.items[0].displayName).toBe('Jane Doe');
        });

        it('should not leak across organizations', async () => {
          await context.factory.createUser(context.org2.name, 'OPERATOR', {
            displayName: 'John Org2',
          });

          const response = await context.client.queryExpectSuccess(
            USER_QUERIES.GET_USERS,
            { filter: { searchValue: 'John' } },
            context.adminToken,
          );

          expect(
            response.users.items.every((user: any) => !user.displayName.includes('Org2')),
          ).toBe(true);
        });
      });

      describe('refineConditions', () => {
        const conditions = [
          { condition: 'equals', value: 'John Smith', expectedCount: 1 },
          { condition: 'contains', value: 'Doe', expectedCount: 1 },
          { condition: 'starts with', value: 'Jane', expectedCount: 1 },
          { condition: 'ends with', value: 'Smith', expectedCount: 1 },
          { condition: 'not equals', value: 'John Smith', minCount: 2 },
        ];

        conditions.forEach(({ condition, value, expectedCount, minCount }) => {
          it(`should filter by displayName ${condition}`, async () => {
            const response = await context.client.queryExpectSuccess(
              USER_QUERIES.GET_USERS,
              {
                filter: {
                  refineConditions: [{ searchItem: 'displayName', condition, value }],
                },
              },
              context.adminToken,
            );

            if (expectedCount !== undefined) {
              expect(response.users.items).toHaveLength(expectedCount);
            } else if (minCount !== undefined) {
              expect(response.users.items.length).toBeGreaterThanOrEqual(minCount);
            }
          });
        });

        it('should filter by senderName equals', async () => {
          const response = await context.client.queryExpectSuccess(
            USER_QUERIES.GET_USERS,
            {
              filter: {
                refineConditions: [
                  { searchItem: 'senderName', condition: 'equals', value: 'Johnny' },
                ],
              },
            },
            context.adminToken,
          );

          expect(response.users.items).toHaveLength(1);
          expect(response.users.items[0].senderName).toBe('Johnny');
        });

        it('should filter by email equals', async () => {
          const response = await context.client.queryExpectSuccess(
            USER_QUERIES.GET_USERS,
            {
              filter: {
                refineConditions: [
                  { searchItem: 'email', condition: 'equals', value: 'jane.doe@test.com' },
                ],
              },
            },
            context.adminToken,
          );

          expect(response.users.items).toHaveLength(1);
          expect(response.users.items[0].email).toBe('jane.doe@test.com');
        });

        it('should filter by roleType equals', async () => {
          const response = await context.client.queryExpectSuccess(
            USER_QUERIES.GET_USERS,
            {
              filter: {
                refineConditions: [
                  { searchItem: 'roleType', condition: 'equals', value: 'MANAGER' },
                ],
              },
            },
            context.adminToken,
          );

          expect(response.users.items.length).toBeGreaterThanOrEqual(1);
          expect(response.users.items.every((user: any) => user.roleType === 'MANAGER')).toBe(true);
        });

        it('should filter by status equals', async () => {
          const response = await context.client.queryExpectSuccess(
            USER_QUERIES.GET_USERS,
            {
              filter: {
                refineConditions: [
                  { searchItem: 'status', condition: 'equals', value: 'INACTIVE' },
                ],
              },
            },
            context.adminToken,
          );

          expect(response.users.items).toHaveLength(1);
          expect(response.users.items[0].email).toBe('inactive.operator@test.com');
          expect(response.users.items[0].status).toBe('INACTIVE');
        });

        it('should reject invalid filter field', async () => {
          await context.client.queryExpectError(
            USER_QUERIES.GET_USERS,
            ERROR_MESSAGES.INVALID_FILTER_FIELD,
            {
              filter: {
                refineConditions: [
                  { searchItem: 'invalidField', condition: 'equals', value: 'test' },
                ],
              },
            },
            context.adminToken,
          );
        });
      });

      describe('combined filtering', () => {
        it('should combine searchValue and refineConditions', async () => {
          const response = await context.client.queryExpectSuccess(
            USER_QUERIES.GET_USERS,
            {
              filter: {
                searchValue: 'John',
                refineConditions: [
                  { searchItem: 'displayName', condition: 'contains', value: 'Smith' },
                ],
              },
            },
            context.adminToken,
          );

          expect(response.users.items).toHaveLength(1);
          expect(response.users.items[0].displayName).toBe('John Smith');
        });

        it('should support multiple refineConditions', async () => {
          const response = await context.client.queryExpectSuccess(
            USER_QUERIES.GET_USERS,
            {
              filter: {
                refineConditions: [
                  { searchItem: 'displayName', condition: 'starts with', value: 'Jane' },
                  { searchItem: 'email', condition: 'contains', value: 'doe' },
                ],
              },
            },
            context.adminToken,
          );

          expect(response.users.items).toHaveLength(1);
          expect(response.users.items[0].displayName).toBe('Jane Doe');
        });

        it('should combine roleType and email refineConditions', async () => {
          const response = await context.client.queryExpectSuccess(
            USER_QUERIES.GET_USERS,
            {
              filter: {
                refineConditions: [
                  { searchItem: 'roleType', condition: 'equals', value: 'MANAGER' },
                  { searchItem: 'email', condition: 'contains', value: 'manager.one' },
                ],
              },
            },
            context.adminToken,
          );

          expect(response.users.items).toHaveLength(1);
          expect(response.users.items[0].email).toBe('manager.one@test.com');
        });

        it('should combine filtering with pagination', async () => {
          const response = await context.client.queryExpectSuccess(
            USER_QUERIES.GET_USERS,
            {
              skip: 0,
              take: 1,
              filter: { searchValue: 'john' },
            },
            context.adminToken,
          );

          expect(response.users.items).toHaveLength(1);
          expect(response.users.count).toBeGreaterThanOrEqual(2);
        });
      });
    });
  });
});
