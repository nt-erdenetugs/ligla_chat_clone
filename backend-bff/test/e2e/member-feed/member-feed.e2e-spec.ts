import { MEMBER_FEED_QUERIES } from '../../fixtures/graphql/member-feed.queries';
import { TestSetup, TestContext } from '../../utils/test-setup';

const TEST_COLUMNS = {
  CATEGORY_1: 'category1',
  CATEGORY_2: 'category2',
  NUMBER_1: 'number1',
  NUMBER_2: 'number2',
  DATETIME_1: 'datetime1',
  DATETIME_2: 'datetime2',
} as const;

const TEST_DATA = {
  DATE: new Date('2024-01-15T10:30:00Z'),
  CATEGORY_VALUE: 'Test Category',
  NUMBER_VALUE_1: 12345,
  NUMBER_VALUE_2: 67890,
} as const;

const ERROR_MESSAGES = {
  FORBIDDEN: 'Forbidden',
  UNAUTHORIZED: 'Unauthorized',
} as const;

const TEST_ORGANIZATIONS = {
  ORG1: 'member_feed_org1',
  ORG2: 'member_feed_org2',
} as const;

// Test Helper Functions
class MemberFeedTestHelpers {
  static updateSettingInput(enabledColumns: string[]) {
    return {
      updateMemberFeedSettingInput: {
        enabledColumns,
      },
    };
  }

  static validateMemberFeed(memberFeed: any) {
    expect(memberFeed.columnName).toBeDefined();
    expect(memberFeed.columnAlias).toBeDefined();
    expect(memberFeed.value).toBeDefined();
  }

  static validateMemberFeedColumn(column: any) {
    expect(column.name).toBeDefined();
    expect(column.alias).toBeDefined();
    expect(typeof column.isEnabled).toBe('boolean');
  }

  static findFeedByColumn(feeds: any[], columnName: string) {
    return feeds.find((f: any) => f.columnName === columnName);
  }

  static getEnabledColumnNames(columns: any[]): string[] {
    return columns.filter((col: any) => col.isEnabled).map((col: any) => col.name);
  }

  static getAliasMap(columns: any[]): Record<string, string> {
    return columns.reduce((acc: Record<string, string>, column: any) => {
      acc[column.name] = column.alias;
      return acc;
    }, {});
  }

  static expectAliasesUnchanged(before: any[], after: any[]) {
    const beforeAliases = this.getAliasMap(before);

    expect(after).toHaveLength(before.length);
    after.forEach((column: any) => {
      expect(column.alias).toBe(beforeAliases[column.name]);
    });
  }
}

describe('Member Feed Module (E2E)', () => {
  let context: TestContext;
  let adminToken: string;
  let managerToken: string;
  let operatorToken: string;
  let org2AdminToken: string;
  let org1: any;
  let org2: any;
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
    org2AdminToken = tokens.org2AdminToken;
    tenantSchemaNames = await Promise.all([
      context.factory.getTenantSchemaNameForOrganization(org1.name),
      context.factory.getTenantSchemaNameForOrganization(org2.name),
    ]);
  });

  afterEach(async () => {
    await context.cleaner.cleanMemberFeedTestData(tenantSchemaNames);
  });

  afterAll(async () => {
    await TestSetup.cleanupTestApp(context);
  });

  describe('memberFeedColumns', () => {
    describe('authorization', () => {
      it('should allow ADMIN to get columns', async () => {
        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEED_COLUMNS,
          {},
          adminToken,
        );

        expect(response.memberFeedColumns).toBeInstanceOf(Array);
        expect(response.memberFeedColumns.length).toBeGreaterThan(0);
      });

      it('should allow MANAGER to get columns', async () => {
        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEED_COLUMNS,
          {},
          managerToken,
        );

        expect(response.memberFeedColumns).toBeInstanceOf(Array);
        expect(response.memberFeedColumns.length).toBeGreaterThan(0);
      });

      it('should deny OPERATOR from getting columns', async () => {
        await context.client.queryExpectError(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEED_COLUMNS,
          ERROR_MESSAGES.FORBIDDEN,
          {},
          operatorToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEED_COLUMNS,
          ERROR_MESSAGES.UNAUTHORIZED,
          {},
        );
      });
    });

    describe('column structure', () => {
      it('should return columns with name and alias', async () => {
        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEED_COLUMNS,
          {},
          adminToken,
        );

        response.memberFeedColumns.forEach((column: any) => {
          MemberFeedTestHelpers.validateMemberFeedColumn(column);
        });
      });

      it('should include all column types (category, number, datetime)', async () => {
        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEED_COLUMNS,
          {},
          adminToken,
        );

        const columnNames = response.memberFeedColumns.map((col: any) => col.name);

        const hasCategory = columnNames.some((name: string) => name.startsWith('category'));
        const hasNumber = columnNames.some((name: string) => name.startsWith('number'));
        const hasDatetime = columnNames.some((name: string) => name.startsWith('datetime'));

        expect(hasCategory).toBe(true);
        expect(hasNumber).toBe(true);
        expect(hasDatetime).toBe(true);
      });
    });
  });

  describe('memberFeeds', () => {
    describe('authorization', () => {
      beforeEach(async () => {
        await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.UPDATE_MEMBER_FEED_SETTING,
          MemberFeedTestHelpers.updateSettingInput([TEST_COLUMNS.CATEGORY_1]),
          adminToken,
        );
      });

      it('should allow ADMIN to get feeds', async () => {
        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEEDS,
          {},
          adminToken,
        );

        expect(response.memberFeeds).toBeDefined();
      });

      it('should allow MANAGER to get feeds', async () => {
        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEEDS,
          {},
          managerToken,
        );

        expect(response.memberFeeds).toBeDefined();
      });

      it('should allow OPERATOR to get feeds', async () => {
        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEEDS,
          {},
          operatorToken,
        );

        expect(response.memberFeeds).toBeDefined();
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEEDS,
          ERROR_MESSAGES.UNAUTHORIZED,
          {},
        );
      });
    });

    describe('empty settings handling', () => {
      it('should return null when no feed settings exist', async () => {
        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEEDS,
          {},
          adminToken,
        );

        expect(response.memberFeeds).toBeNull();
      });

      it('should return null when enabledColumns is empty', async () => {
        await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.UPDATE_MEMBER_FEED_SETTING,
          MemberFeedTestHelpers.updateSettingInput([]),
          adminToken,
        );

        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEEDS,
          {},
          adminToken,
        );

        expect(response.memberFeeds).toBeNull();
      });
    });

    describe('data retrieval', () => {
      it('should get member feeds for specific client user', async () => {
        await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.UPDATE_MEMBER_FEED_SETTING,
          MemberFeedTestHelpers.updateSettingInput([
            TEST_COLUMNS.CATEGORY_1,
            TEST_COLUMNS.NUMBER_1,
          ]),
          adminToken,
        );

        const endUser = await context.factory.createEndUser();

        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEEDS,
          { clientUserId: endUser.userId },
          adminToken,
        );

        expect(response.memberFeeds).toBeDefined();
        if (response.memberFeeds && response.memberFeeds.length > 0) {
          response.memberFeeds.forEach((feed: any) => {
            MemberFeedTestHelpers.validateMemberFeed(feed);
          });
        }
      });

      it('should get member feeds without clientUserId', async () => {
        await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.UPDATE_MEMBER_FEED_SETTING,
          MemberFeedTestHelpers.updateSettingInput([
            TEST_COLUMNS.CATEGORY_1,
            TEST_COLUMNS.NUMBER_1,
          ]),
          adminToken,
        );

        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEEDS,
          {},
          adminToken,
        );

        expect(response.memberFeeds).toBeDefined();
        expect(response.memberFeeds.length).toBeGreaterThan(0);
        expect(response.memberFeeds[0].value).toBe('-');
      });
    });

    describe('value transformation', () => {
      it('should transform date values to ISO string', async () => {
        await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.UPDATE_MEMBER_FEED_SETTING,
          MemberFeedTestHelpers.updateSettingInput([
            TEST_COLUMNS.DATETIME_1,
            TEST_COLUMNS.CATEGORY_1,
          ]),
          adminToken,
        );

        const endUser = await context.factory.createEndUser();

        await context.factory.createMemberFeedData(org1.name, endUser.userId, {
          datetime1: TEST_DATA.DATE,
          category1: TEST_DATA.CATEGORY_VALUE,
        });

        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEEDS,
          { clientUserId: endUser.userId },
          adminToken,
        );

        expect(response.memberFeeds).toBeDefined();
        const datetimeFeed = MemberFeedTestHelpers.findFeedByColumn(
          response.memberFeeds,
          TEST_COLUMNS.DATETIME_1,
        );
        expect(datetimeFeed).toBeDefined();
        expect(datetimeFeed.value).toBe(TEST_DATA.DATE.toISOString());
      });

      it('should transform number values to string', async () => {
        await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.UPDATE_MEMBER_FEED_SETTING,
          MemberFeedTestHelpers.updateSettingInput([TEST_COLUMNS.NUMBER_1, TEST_COLUMNS.NUMBER_2]),
          adminToken,
        );

        const endUser = await context.factory.createEndUser();

        await context.factory.createMemberFeedData(org1.name, endUser.userId, {
          number1: TEST_DATA.NUMBER_VALUE_1,
          number2: TEST_DATA.NUMBER_VALUE_2,
        });

        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEEDS,
          { clientUserId: endUser.userId },
          adminToken,
        );

        expect(response.memberFeeds).toBeDefined();
        const number1Feed = MemberFeedTestHelpers.findFeedByColumn(
          response.memberFeeds,
          TEST_COLUMNS.NUMBER_1,
        );
        const number2Feed = MemberFeedTestHelpers.findFeedByColumn(
          response.memberFeeds,
          TEST_COLUMNS.NUMBER_2,
        );
        expect(number1Feed.value).toBe(TEST_DATA.NUMBER_VALUE_1.toString());
        expect(number2Feed.value).toBe(TEST_DATA.NUMBER_VALUE_2.toString());
      });

      it('should return "-" for null or undefined values', async () => {
        await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.UPDATE_MEMBER_FEED_SETTING,
          MemberFeedTestHelpers.updateSettingInput([
            TEST_COLUMNS.CATEGORY_1,
            TEST_COLUMNS.NUMBER_1,
          ]),
          adminToken,
        );

        const endUser = await context.factory.createEndUser();

        await context.factory.createMemberFeedData(org1.name, endUser.userId, {
          category1: null,
          number1: null,
        });

        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEEDS,
          { clientUserId: endUser.userId },
          adminToken,
        );

        expect(response.memberFeeds).toBeDefined();
        response.memberFeeds.forEach((feed: any) => {
          expect(feed.value).toBe('-');
        });
      });
    });

    describe('multi-tenancy', () => {
      it('should return organization-specific data', async () => {
        await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.UPDATE_MEMBER_FEED_SETTING,
          MemberFeedTestHelpers.updateSettingInput([TEST_COLUMNS.CATEGORY_1]),
          adminToken,
        );

        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEEDS,
          {},
          adminToken,
        );

        expect(response.memberFeeds).toBeDefined();
      });
    });
  });

  describe('updateMemberFeedSetting', () => {
    describe('authorization', () => {
      const testInput = MemberFeedTestHelpers.updateSettingInput([TEST_COLUMNS.CATEGORY_1]);

      it('should allow ADMIN to update setting', async () => {
        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.UPDATE_MEMBER_FEED_SETTING,
          testInput,
          adminToken,
        );

        expect(response.updateMemberFeedSetting).toBeDefined();
        expect(response.updateMemberFeedSetting).toBeInstanceOf(Array);
        response.updateMemberFeedSetting.forEach((column: any) => {
          MemberFeedTestHelpers.validateMemberFeedColumn(column);
        });
        const enabledColumns = response.updateMemberFeedSetting.filter((col: any) => col.isEnabled);
        expect(enabledColumns.some((col: any) => col.name === TEST_COLUMNS.CATEGORY_1)).toBe(true);
      });

      it('should deny MANAGER from updating setting', async () => {
        await context.client.queryExpectError(
          MEMBER_FEED_QUERIES.UPDATE_MEMBER_FEED_SETTING,
          ERROR_MESSAGES.FORBIDDEN,
          testInput,
          managerToken,
        );
      });

      it('should deny OPERATOR from updating setting', async () => {
        await context.client.queryExpectError(
          MEMBER_FEED_QUERIES.UPDATE_MEMBER_FEED_SETTING,
          ERROR_MESSAGES.FORBIDDEN,
          testInput,
          operatorToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          MEMBER_FEED_QUERIES.UPDATE_MEMBER_FEED_SETTING,
          ERROR_MESSAGES.UNAUTHORIZED,
          testInput,
        );
      });
    });

    describe('column types', () => {
      it('should only update isEnabled for category columns', async () => {
        const before = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEED_COLUMNS,
          {},
          adminToken,
        );

        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.UPDATE_MEMBER_FEED_SETTING,
          MemberFeedTestHelpers.updateSettingInput([
            TEST_COLUMNS.CATEGORY_1,
            TEST_COLUMNS.CATEGORY_2,
          ]),
          adminToken,
        );

        const enabledColumnNames = MemberFeedTestHelpers.getEnabledColumnNames(
          response.updateMemberFeedSetting,
        );
        expect(enabledColumnNames.length).toBe(2);
        expect(enabledColumnNames).toContain(TEST_COLUMNS.CATEGORY_1);
        expect(enabledColumnNames).toContain(TEST_COLUMNS.CATEGORY_2);
        MemberFeedTestHelpers.expectAliasesUnchanged(
          before.memberFeedColumns,
          response.updateMemberFeedSetting,
        );
      });

      it('should only update isEnabled for number columns', async () => {
        const before = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEED_COLUMNS,
          {},
          adminToken,
        );

        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.UPDATE_MEMBER_FEED_SETTING,
          MemberFeedTestHelpers.updateSettingInput([TEST_COLUMNS.NUMBER_1, TEST_COLUMNS.NUMBER_2]),
          adminToken,
        );

        const enabledColumnNames = MemberFeedTestHelpers.getEnabledColumnNames(
          response.updateMemberFeedSetting,
        );
        expect(enabledColumnNames).toContain(TEST_COLUMNS.NUMBER_1);
        expect(enabledColumnNames).toContain(TEST_COLUMNS.NUMBER_2);
        MemberFeedTestHelpers.expectAliasesUnchanged(
          before.memberFeedColumns,
          response.updateMemberFeedSetting,
        );
      });

      it('should only update isEnabled for datetime columns', async () => {
        const before = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEED_COLUMNS,
          {},
          adminToken,
        );

        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.UPDATE_MEMBER_FEED_SETTING,
          MemberFeedTestHelpers.updateSettingInput([
            TEST_COLUMNS.DATETIME_1,
            TEST_COLUMNS.DATETIME_2,
          ]),
          adminToken,
        );

        const enabledColumnNames = MemberFeedTestHelpers.getEnabledColumnNames(
          response.updateMemberFeedSetting,
        );
        expect(enabledColumnNames).toContain(TEST_COLUMNS.DATETIME_1);
        expect(enabledColumnNames).toContain(TEST_COLUMNS.DATETIME_2);
        MemberFeedTestHelpers.expectAliasesUnchanged(
          before.memberFeedColumns,
          response.updateMemberFeedSetting,
        );
      });

      it('should only update isEnabled for all column types', async () => {
        const before = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEED_COLUMNS,
          {},
          adminToken,
        );

        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.UPDATE_MEMBER_FEED_SETTING,
          MemberFeedTestHelpers.updateSettingInput([
            TEST_COLUMNS.CATEGORY_1,
            TEST_COLUMNS.NUMBER_1,
            TEST_COLUMNS.DATETIME_1,
          ]),
          adminToken,
        );

        const enabledColumnNames = MemberFeedTestHelpers.getEnabledColumnNames(
          response.updateMemberFeedSetting,
        );
        expect(enabledColumnNames).toContain(TEST_COLUMNS.CATEGORY_1);
        expect(enabledColumnNames).toContain(TEST_COLUMNS.NUMBER_1);
        expect(enabledColumnNames).toContain(TEST_COLUMNS.DATETIME_1);
        MemberFeedTestHelpers.expectAliasesUnchanged(
          before.memberFeedColumns,
          response.updateMemberFeedSetting,
        );
      });
    });

    describe('update behavior', () => {
      it('should update with empty enabled columns', async () => {
        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.UPDATE_MEMBER_FEED_SETTING,
          MemberFeedTestHelpers.updateSettingInput([]),
          adminToken,
        );

        const enabledColumnNames = MemberFeedTestHelpers.getEnabledColumnNames(
          response.updateMemberFeedSetting,
        );
        expect(enabledColumnNames).toBeInstanceOf(Array);
        expect(enabledColumnNames.length).toBe(0);
      });

      it('should update setting multiple times (upsert behavior)', async () => {
        await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.UPDATE_MEMBER_FEED_SETTING,
          MemberFeedTestHelpers.updateSettingInput([
            TEST_COLUMNS.CATEGORY_1,
            TEST_COLUMNS.CATEGORY_2,
          ]),
          adminToken,
        );

        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.UPDATE_MEMBER_FEED_SETTING,
          MemberFeedTestHelpers.updateSettingInput([TEST_COLUMNS.NUMBER_1, TEST_COLUMNS.NUMBER_2]),
          adminToken,
        );

        const enabledColumnNames = MemberFeedTestHelpers.getEnabledColumnNames(
          response.updateMemberFeedSetting,
        );
        expect(enabledColumnNames).toEqual([TEST_COLUMNS.NUMBER_1, TEST_COLUMNS.NUMBER_2]);
      });

      it('should persist updated setting', async () => {
        await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.UPDATE_MEMBER_FEED_SETTING,
          MemberFeedTestHelpers.updateSettingInput([
            TEST_COLUMNS.CATEGORY_1,
            TEST_COLUMNS.NUMBER_1,
            TEST_COLUMNS.DATETIME_1,
          ]),
          adminToken,
        );

        const response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEED_COLUMNS,
          {},
          adminToken,
        );

        const enabledColumnNames = MemberFeedTestHelpers.getEnabledColumnNames(
          response.memberFeedColumns,
        );
        expect(enabledColumnNames).toContain(TEST_COLUMNS.CATEGORY_1);
        expect(enabledColumnNames).toContain(TEST_COLUMNS.NUMBER_1);
        expect(enabledColumnNames).toContain(TEST_COLUMNS.DATETIME_1);
      });
    });

    describe('multi-tenancy', () => {
      it('should handle organization isolation', async () => {
        await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.UPDATE_MEMBER_FEED_SETTING,
          MemberFeedTestHelpers.updateSettingInput([
            TEST_COLUMNS.CATEGORY_1,
            TEST_COLUMNS.CATEGORY_2,
          ]),
          adminToken,
        );

        await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.UPDATE_MEMBER_FEED_SETTING,
          MemberFeedTestHelpers.updateSettingInput([TEST_COLUMNS.NUMBER_1, TEST_COLUMNS.NUMBER_2]),
          org2AdminToken,
        );

        const org1Response = await context.client.queryExpectSuccess(
          MEMBER_FEED_QUERIES.GET_MEMBER_FEED_COLUMNS,
          {},
          adminToken,
        );

        const enabledColumnNames = MemberFeedTestHelpers.getEnabledColumnNames(
          org1Response.memberFeedColumns,
        );
        expect(enabledColumnNames).toContain(TEST_COLUMNS.CATEGORY_1);
        expect(enabledColumnNames).not.toContain(TEST_COLUMNS.NUMBER_1);
      });
    });
  });
});
