import { STORE_QUERIES } from '../../fixtures/graphql/store.queries';
import { TestSetup, TestValidators, TestContext } from '../../utils/test-setup';

const ERROR_MESSAGES = {
  FORBIDDEN: 'Forbidden',
  UNAUTHORIZED: 'Unauthorized',
  NOT_FOUND: 'not found',
  ACCESS_DENIED: 'Access denied to store',
} as const;

const TEST_ORGANIZATIONS = {
  ORG1: 'store_test_org1',
  ORG2: 'store_test_org2',
} as const;

const TEST_STORES = {
  BASIC: {
    name: 'Basic Test Store',
  },
  COMPLETE: {
    name: 'Complete Store',
    liglaStoreId: 12345,
    areaName: 'Downtown Area',
    typeName: 'Retail Type',
    note: 'Complete store for testing all fields',
  },
  WITH_DATES: {
    name: 'Store With Dates',
    startsAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    endsAt: new Date('2024-12-31T00:00:00Z').toISOString(),
  },
  MINIMAL: {
    name: 'Minimal Store',
    areaName: null,
    typeName: null,
    note: null,
  },
  SPECIAL_CHARS: {
    name: 'Store & Co.',
    areaName: 'North/South Area',
    typeName: 'Retail & Wholesale',
    note: 'Special characters: !@#$%^&*()',
  },
  UNICODE: {
    name: 'ストア 🏪',
    areaName: '東京',
    note: 'Test with emoji 😊',
  },
  INACTIVE: {
    name: 'Inactive Store',
    isActive: false,
  },
  LONG_NAME: {
    name: 'A'.repeat(100),
  },
  // Filter test stores
  FILTER_ALPHA: {
    name: 'Alpha Store',
    areaName: 'North Area',
    typeName: 'Alpha Type',
  },
  FILTER_BETA: {
    name: 'Beta Store',
    areaName: 'Beta Area',
    typeName: 'Retail',
  },
  FILTER_GAMMA: {
    name: 'Gamma Store',
    areaName: 'South Area',
    typeName: 'Gamma Type',
    note: 'Special gamma note',
  },
} as const;

const TEST_DATA_COUNTS = {
  STORES_IN_LIST: 3,
  STORES_IN_CURSOR: 4,
  LARGE_DATASET: 50,
  MEDIUM_DATASET: 30,
  PAGINATION_PAGE_SIZE: 2,
  PAGINATION_SKIP: 1,
  CURSOR_PAGE_SIZE: 10,
  MAX_QUERY_TIME_MS: 5000,
} as const;

// Test Helper Functions
class StoreTestHelpers {
  static validateStoreList(response: any, expectedMinCount: number = 0) {
    expect(response.stores.items).toBeInstanceOf(Array);
    expect(typeof response.stores.count).toBe('number');
    expect(response.stores.count).toBeGreaterThanOrEqual(expectedMinCount);
    expect(response.stores.items.length).toBeLessThanOrEqual(response.stores.count);
  }

  static validateCursorPagination(
    response: any,
    expectedPageSize: number,
    hasMore: boolean = true,
  ) {
    TestValidators.validatePagination(response.storesCursor, expectedPageSize, hasMore);
  }

  static validateStoreFields(store: any, expected: any = {}) {
    TestValidators.validateStore(store, expected);
  }

  static async createStoresWithDelay(factory: any, orgName: string, stores: any[]) {
    for (const storeData of stores) {
      await factory.createStore(orgName, storeData);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}

describe('Store Module (E2E)', () => {
  let context: TestContext;
  let org1: any;
  let org2: any;
  let adminToken: string;
  let managerToken: string;
  let operatorToken: string;
  let tenantSchemaNames: string[];

  beforeAll(async () => {
    context = await TestSetup.createTestApp();
    const { organizations, tokens } = await TestSetup.createStandardTestData(
      context.factory,
      context.authHelper,
      TEST_ORGANIZATIONS.ORG1,
      TEST_ORGANIZATIONS.ORG2,
    );

    org1 = organizations.org1;
    org2 = organizations.org2;
    adminToken = tokens.adminToken;
    managerToken = tokens.managerToken;
    operatorToken = tokens.operatorToken;
    tenantSchemaNames = await Promise.all([
      context.factory.getTenantSchemaNameForOrganization(org1.name),
      context.factory.getTenantSchemaNameForOrganization(org2.name),
    ]);
  });

  afterEach(async () => {
    await context.cleaner.cleanStoreTestData(tenantSchemaNames);
  });

  afterAll(async () => {
    await TestSetup.cleanupTestApp(context);
  });

  describe('stores (list)', () => {
    beforeEach(async () => {
      await StoreTestHelpers.createStoresWithDelay(context.factory, org1.name, [
        { name: 'Store 1' },
        { name: 'Store 2' },
        { name: 'Store 3' },
      ]);
      await context.factory.createStore(org2.name, { name: 'Org2 Store' });
    });

    describe('authorization', () => {
      it('should list stores for organization as ADMIN', async () => {
        const response = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORES,
          {},
          adminToken,
        );

        StoreTestHelpers.validateStoreList(response, TEST_DATA_COUNTS.STORES_IN_LIST);
        response.stores.items.forEach((store: any) => {
          StoreTestHelpers.validateStoreFields(store);
        });
      });

      it('should list stores for MANAGER', async () => {
        const response = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORES,
          {},
          managerToken,
        );

        StoreTestHelpers.validateStoreList(response, TEST_DATA_COUNTS.STORES_IN_LIST);
      });

      it('should deny OPERATOR from listing stores', async () => {
        await context.client.queryExpectError(
          STORE_QUERIES.GET_STORES,
          ERROR_MESSAGES.FORBIDDEN,
          {},
          operatorToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          STORE_QUERIES.GET_STORES,
          ERROR_MESSAGES.UNAUTHORIZED,
          {},
        );
      });
    });

    describe('pagination and filtering', () => {
      it('should respect pagination (skip/take)', async () => {
        const response = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORES,
          { skip: TEST_DATA_COUNTS.PAGINATION_SKIP, take: TEST_DATA_COUNTS.PAGINATION_PAGE_SIZE },
          adminToken,
        );

        expect(response.stores.items).toBeInstanceOf(Array);
        expect(response.stores.items.length).toBeLessThanOrEqual(
          TEST_DATA_COUNTS.PAGINATION_PAGE_SIZE,
        );
        expect(response.stores.count).toBeGreaterThanOrEqual(TEST_DATA_COUNTS.STORES_IN_LIST);
      });

      it('should not list stores from other organizations', async () => {
        const response = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORES,
          {},
          adminToken,
        );

        expect(response.stores.items.every((store: any) => !store.name.includes('Org2'))).toBe(
          true,
        );
      });

      it('should filter stores by search value in name field', async () => {
        await context.factory.createStore(org1.name, TEST_STORES.FILTER_ALPHA);

        const response = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORES,
          {
            filter: {
              searchValue: 'Alpha',
              refineConditions: [],
            },
          },
          adminToken,
        );

        StoreTestHelpers.validateStoreList(response, 1);
        const foundStore = response.stores.items.find(
          (s: any) => s.name === TEST_STORES.FILTER_ALPHA.name,
        );
        expect(foundStore).toBeDefined();
        StoreTestHelpers.validateStoreFields(foundStore, {
          name: TEST_STORES.FILTER_ALPHA.name,
        });
      });

      it('should filter stores by search value in areaName field', async () => {
        await context.factory.createStore(org1.name, TEST_STORES.FILTER_BETA);

        const response = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORES,
          {
            filter: {
              searchValue: 'Beta Area',
              refineConditions: [],
            },
          },
          adminToken,
        );

        StoreTestHelpers.validateStoreList(response, 1);
        const foundStore = response.stores.items.find(
          (s: any) => s.areaName === TEST_STORES.FILTER_BETA.areaName,
        );
        expect(foundStore).toBeDefined();
        expect(foundStore.areaName).toBe(TEST_STORES.FILTER_BETA.areaName);
      });

      it('should filter stores by search value in typeName field', async () => {
        await context.factory.createStore(org1.name, TEST_STORES.FILTER_GAMMA);

        const response = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORES,
          {
            filter: {
              searchValue: 'Gamma Type',
              refineConditions: [],
            },
          },
          adminToken,
        );

        StoreTestHelpers.validateStoreList(response, 1);
        const foundStore = response.stores.items.find(
          (s: any) => s.typeName === TEST_STORES.FILTER_GAMMA.typeName,
        );
        expect(foundStore).toBeDefined();
        expect(foundStore.typeName).toBe(TEST_STORES.FILTER_GAMMA.typeName);
      });

      it('should filter stores by search value in note field', async () => {
        await context.factory.createStore(org1.name, TEST_STORES.FILTER_GAMMA);

        const response = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORES,
          {
            filter: {
              searchValue: 'gamma note',
              refineConditions: [],
            },
          },
          adminToken,
        );

        StoreTestHelpers.validateStoreList(response, 1);
        const foundStore = response.stores.items.find((s: any) => s.note?.includes('gamma'));
        expect(foundStore).toBeDefined();
        expect(foundStore.note).toBe(TEST_STORES.FILTER_GAMMA.note);
      });

      it('should return empty results when search value matches no stores', async () => {
        const response = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORES,
          {
            filter: {
              searchValue: 'NonExistentSearchTerm12345',
              refineConditions: [],
            },
          },
          adminToken,
        );

        expect(response.stores.items.length).toBe(0);
        expect(response.stores.count).toBe(0);
      });

      it('should return all stores when no filter is provided', async () => {
        const withoutFilter = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORES,
          {},
          adminToken,
        );

        const withNullFilter = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORES,
          { filter: null },
          adminToken,
        );

        expect(withoutFilter.stores.count).toBe(withNullFilter.stores.count);
      });
    });

    describe('ordering', () => {
      it('should order by createdAt descending (primary ordering)', async () => {
        const response = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORES,
          {},
          adminToken,
        );

        expect(response.stores.items.length).toBeGreaterThanOrEqual(
          TEST_DATA_COUNTS.STORES_IN_LIST,
        );
        TestValidators.validateDescendingOrder(response.stores.items);
      });
    });

    describe('field validation', () => {
      it('should include all store fields', async () => {
        const store = await context.factory.createStore(org1.name, TEST_STORES.COMPLETE);

        const response = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORES,
          {},
          adminToken,
        );

        const foundStore = response.stores.items.find((s: any) => s.id === store.id);
        StoreTestHelpers.validateStoreFields(foundStore, {
          name: TEST_STORES.COMPLETE.name,
          liglaStoreId: TEST_STORES.COMPLETE.liglaStoreId,
        });
        expect(foundStore.areaName).toBe(TEST_STORES.COMPLETE.areaName);
        expect(foundStore.typeName).toBe(TEST_STORES.COMPLETE.typeName);
        expect(foundStore.note).toBe(TEST_STORES.COMPLETE.note);
      });
    });
  });

  describe('storesCursor (cursor pagination)', () => {
    beforeEach(async () => {
      await StoreTestHelpers.createStoresWithDelay(context.factory, org1.name, [
        { name: 'Store 1' },
        { name: 'Store 2' },
        { name: 'Store 3' },
        { name: 'Store 4' },
      ]);
    });

    describe('authorization', () => {
      it('should return cursor paginated stores as ADMIN', async () => {
        const response = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORES_CURSOR,
          { take: TEST_DATA_COUNTS.PAGINATION_PAGE_SIZE },
          adminToken,
        );

        StoreTestHelpers.validateCursorPagination(
          response,
          TEST_DATA_COUNTS.PAGINATION_PAGE_SIZE,
          true,
        );
      });

      it('should return cursor paginated stores as MANAGER', async () => {
        const response = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORES_CURSOR,
          { take: TEST_DATA_COUNTS.PAGINATION_PAGE_SIZE },
          managerToken,
        );

        StoreTestHelpers.validateCursorPagination(
          response,
          TEST_DATA_COUNTS.PAGINATION_PAGE_SIZE,
          true,
        );
      });

      it('should deny OPERATOR from using cursor pagination', async () => {
        await context.client.queryExpectError(
          STORE_QUERIES.GET_STORES_CURSOR,
          ERROR_MESSAGES.FORBIDDEN,
          { take: TEST_DATA_COUNTS.PAGINATION_PAGE_SIZE },
          operatorToken,
        );
      });

      it('should deny unauthenticated access to cursor pagination', async () => {
        await context.client.queryExpectError(
          STORE_QUERIES.GET_STORES_CURSOR,
          ERROR_MESSAGES.UNAUTHORIZED,
          {
            take: TEST_DATA_COUNTS.PAGINATION_PAGE_SIZE,
          },
        );
      });
    });

    describe('pagination behavior', () => {
      it('should navigate to next page using cursor', async () => {
        const firstPage = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORES_CURSOR,
          { take: TEST_DATA_COUNTS.PAGINATION_PAGE_SIZE },
          adminToken,
        );

        const secondPage = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORES_CURSOR,
          {
            take: TEST_DATA_COUNTS.PAGINATION_PAGE_SIZE,
            cursorId: firstPage.storesCursor.nextCursorId,
            cursorCreatedAt: firstPage.storesCursor.nextCursorCreatedAt,
          },
          adminToken,
        );

        expect(secondPage.storesCursor.items.length).toBeGreaterThan(0);
        expect(secondPage.storesCursor.items[0].id).not.toBe(firstPage.storesCursor.items[0].id);
      });

      it('should return hasMore=false on last page', async () => {
        const response = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORES_CURSOR,
          { take: TEST_DATA_COUNTS.CURSOR_PAGE_SIZE },
          adminToken,
        );

        if (response.storesCursor.items.length < TEST_DATA_COUNTS.CURSOR_PAGE_SIZE) {
          expect(response.storesCursor.hasMore).toBe(false);
          expect(response.storesCursor.nextCursorId).toBeNull();
        }
      });

      it('should handle empty result set', async () => {
        const newOrg = await context.factory.createOrganization({ name: 'empty_store_org' });
        const newAdmin = await context.factory.createUser(newOrg.name, 'ADMIN');
        const newAdminToken = context.authHelper.generateToken(newAdmin.id);

        const response = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORES_CURSOR,
          { take: TEST_DATA_COUNTS.CURSOR_PAGE_SIZE },
          newAdminToken,
        );

        expect(response.storesCursor.items).toEqual([]);
        expect(response.storesCursor.hasMore).toBe(false);
        expect(response.storesCursor.nextCursorId).toBeNull();
      });
    });

    describe('multi-tenancy', () => {
      it('should not return stores from other organizations', async () => {
        await context.factory.createStore(org2.name, { name: 'Org2 Store' });

        const response = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORES_CURSOR,
          { take: TEST_DATA_COUNTS.CURSOR_PAGE_SIZE },
          adminToken,
        );

        expect(
          response.storesCursor.items.every((store: any) => !store.name.includes('Org2')),
        ).toBe(true);
      });
    });
  });

  describe('store (single)', () => {
    describe('successful retrieval', () => {
      it('should get single store as ADMIN', async () => {
        const store = await context.factory.createStore(org1.name, TEST_STORES.BASIC);

        const response = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORE,
          { id: store.id },
          adminToken,
        );

        StoreTestHelpers.validateStoreFields(response.store, { name: TEST_STORES.BASIC.name });
      });

      it('should get store with all fields', async () => {
        const store = await context.factory.createStore(org1.name, TEST_STORES.COMPLETE);

        const response = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORE,
          { id: store.id },
          adminToken,
        );

        StoreTestHelpers.validateStoreFields(response.store, {
          name: TEST_STORES.COMPLETE.name,
          liglaStoreId: TEST_STORES.COMPLETE.liglaStoreId,
        });
        expect(response.store.areaName).toBe(TEST_STORES.COMPLETE.areaName);
        expect(response.store.typeName).toBe(TEST_STORES.COMPLETE.typeName);
        expect(response.store.note).toBe(TEST_STORES.COMPLETE.note);
      });

      it('should handle inactive stores', async () => {
        const store = await context.factory.createStore(org1.name, TEST_STORES.INACTIVE);

        const response = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORE,
          { id: store.id },
          adminToken,
        );

        StoreTestHelpers.validateStoreFields(response.store, { isActive: false });
      });
    });

    describe('error cases', () => {
      it('should return error for non-existent store', async () => {
        await context.client.queryExpectError(
          STORE_QUERIES.GET_STORE,
          ERROR_MESSAGES.NOT_FOUND,
          { id: '00000000-0000-0000-0000-000000000000' },
          adminToken,
        );
      });

      it('should prevent cross-organization access', async () => {
        const store = await context.factory.createStore(org2.name);

        await context.client.queryExpectError(
          STORE_QUERIES.GET_STORE,
          ERROR_MESSAGES.NOT_FOUND,
          { id: store.id },
          adminToken,
        );
      });
    });

    describe('authorization', () => {
      it('should deny MANAGER from getting single store', async () => {
        const store = await context.factory.createStore(org1.name);

        await context.client.queryExpectError(
          STORE_QUERIES.GET_STORE,
          ERROR_MESSAGES.FORBIDDEN,
          { id: store.id },
          managerToken,
        );
      });

      it('should deny OPERATOR from getting single store', async () => {
        const store = await context.factory.createStore(org1.name);

        await context.client.queryExpectError(
          STORE_QUERIES.GET_STORE,
          ERROR_MESSAGES.FORBIDDEN,
          { id: store.id },
          operatorToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        const store = await context.factory.createStore(org1.name);

        await context.client.queryExpectError(
          STORE_QUERIES.GET_STORE,
          ERROR_MESSAGES.UNAUTHORIZED,
          {
            id: store.id,
          },
        );
      });
    });
  });

  describe('store data integrity', () => {
    it('should handle stores with null optional fields', async () => {
      const store = await context.factory.createStore(org1.name, TEST_STORES.MINIMAL);

      const response = await context.client.queryExpectSuccess(
        STORE_QUERIES.GET_STORE,
        { id: store.id },
        adminToken,
      );

      expect(response.store.name).toBe(TEST_STORES.MINIMAL.name);
      expect(response.store.liglaStoreId).toBeDefined();
      expect(response.store.areaName).toBeNull();
      expect(response.store.typeName).toBeNull();
      expect(response.store.note).toBeNull();
    });

    it('should handle stores with date fields', async () => {
      const store = await context.factory.createStore(org1.name, TEST_STORES.WITH_DATES);

      const response = await context.client.queryExpectSuccess(
        STORE_QUERIES.GET_STORE,
        { id: store.id },
        adminToken,
      );

      expect(response.store.startsAt).toBeDefined();
      expect(response.store.endsAt).toBeDefined();
      expect(new Date(response.store.startsAt).getFullYear()).toBe(2024);
      expect(new Date(response.store.endsAt).getFullYear()).toBe(2024);
    });

    it('should handle long store names', async () => {
      const store = await context.factory.createStore(org1.name, TEST_STORES.LONG_NAME);

      const response = await context.client.queryExpectSuccess(
        STORE_QUERIES.GET_STORE,
        { id: store.id },
        adminToken,
      );

      expect(response.store.name).toBe(TEST_STORES.LONG_NAME.name);
      expect(response.store.name.length).toBe(100);
    });

    it('should handle special characters in store fields', async () => {
      const store = await context.factory.createStore(org1.name, TEST_STORES.SPECIAL_CHARS);

      const response = await context.client.queryExpectSuccess(
        STORE_QUERIES.GET_STORE,
        { id: store.id },
        adminToken,
      );

      expect(response.store.name).toBe(TEST_STORES.SPECIAL_CHARS.name);
      expect(response.store.areaName).toBe(TEST_STORES.SPECIAL_CHARS.areaName);
      expect(response.store.typeName).toBe(TEST_STORES.SPECIAL_CHARS.typeName);
      expect(response.store.note).toBe(TEST_STORES.SPECIAL_CHARS.note);
    });

    it('should handle unicode characters in store fields', async () => {
      const store = await context.factory.createStore(org1.name, TEST_STORES.UNICODE);

      const response = await context.client.queryExpectSuccess(
        STORE_QUERIES.GET_STORE,
        { id: store.id },
        adminToken,
      );

      expect(response.store.name).toBe(TEST_STORES.UNICODE.name);
      expect(response.store.areaName).toBe(TEST_STORES.UNICODE.areaName);
      expect(response.store.note).toBe(TEST_STORES.UNICODE.note);
    });
  });

  describe('store performance', () => {
    it('should handle large number of stores efficiently', async () => {
      const stores = [];
      for (let i = 0; i < TEST_DATA_COUNTS.LARGE_DATASET; i++) {
        stores.push(context.factory.createStore(org1.name, { name: `Store ${i}` }));
      }
      await Promise.all(stores);

      const startTime = Date.now();
      const response = await context.client.queryExpectSuccess(
        STORE_QUERIES.GET_STORES,
        {},
        adminToken,
      );
      const endTime = Date.now();

      expect(response.stores.items.length).toBeGreaterThanOrEqual(TEST_DATA_COUNTS.LARGE_DATASET);
      expect(response.stores.count).toBeGreaterThanOrEqual(TEST_DATA_COUNTS.LARGE_DATASET);
      expect(endTime - startTime).toBeLessThan(TEST_DATA_COUNTS.MAX_QUERY_TIME_MS);
    });

    it('should handle pagination with large dataset', async () => {
      const stores = [];
      for (let i = 0; i < TEST_DATA_COUNTS.MEDIUM_DATASET; i++) {
        stores.push(context.factory.createStore(org1.name, { name: `Store ${i}` }));
      }
      await Promise.all(stores);

      const response = await context.client.queryExpectSuccess(
        STORE_QUERIES.GET_STORES,
        { skip: 10, take: 10 },
        adminToken,
      );

      expect(response.stores.items.length).toBe(10);
      expect(response.stores.count).toBeGreaterThanOrEqual(TEST_DATA_COUNTS.MEDIUM_DATASET);
    });
  });
});
