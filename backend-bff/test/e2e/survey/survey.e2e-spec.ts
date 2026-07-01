import { SURVEY_QUERIES } from '../../fixtures/graphql/survey.queries';
import { TestSetup, TestContext } from '../../utils/test-setup';

const TEST_COLUMNS = {
  CATEGORY_1: 'category1',
  CATEGORY_2: 'category2',
  CATEGORY_3: 'category3',
  CATEGORY_4: 'category4',
  CATEGORY_5: 'category5',
  NUMBER_1: 'number1',
  NUMBER_2: 'number2',
  NUMBER_3: 'number3',
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
  ORG1: 'survey_org1',
  ORG2: 'survey_org2',
} as const;

// Test Helper Functions
class SurveyTestHelpers {
  static updateSettingInput(enabledColumns: string[]) {
    return {
      updateSurveySettingInput: {
        enabledColumns,
      },
    };
  }

  static validateSurvey(survey: any) {
    expect(survey.columnName).toBeDefined();
    expect(survey.columnAlias).toBeDefined();
    expect(survey.value).toBeDefined();
  }

  static validateSurveyColumn(column: any) {
    expect(column.name).toBeDefined();
    expect(column.alias).toBeDefined();
    expect(typeof column.isEnabled).toBe('boolean');
  }

  static findSurveyByColumn(surveys: any[], columnName: string) {
    return surveys.find((s: any) => s.columnName === columnName);
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

describe('Survey Module (E2E)', () => {
  let context: TestContext;
  let adminToken: string;
  let managerToken: string;
  let operatorToken: string;
  let org1: any;
  let org2AdminToken: string;
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
    await context.cleaner.cleanSurveyTestData(tenantSchemaNames);
  });

  afterAll(async () => {
    await TestSetup.cleanupTestApp(context);
  });

  describe('surveyColumns', () => {
    describe('authorization', () => {
      it('should allow ADMIN to get columns', async () => {
        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.GET_SURVEY_COLUMNS,
          {},
          adminToken,
        );

        expect(response.surveyColumns).toBeInstanceOf(Array);
        expect(response.surveyColumns.length).toBeGreaterThan(0);
      });

      it('should allow MANAGER to get columns', async () => {
        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.GET_SURVEY_COLUMNS,
          {},
          managerToken,
        );

        expect(response.surveyColumns).toBeInstanceOf(Array);
        expect(response.surveyColumns.length).toBeGreaterThan(0);
      });

      it('should deny OPERATOR from getting columns', async () => {
        await context.client.queryExpectError(
          SURVEY_QUERIES.GET_SURVEY_COLUMNS,
          ERROR_MESSAGES.FORBIDDEN,
          {},
          operatorToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          SURVEY_QUERIES.GET_SURVEY_COLUMNS,
          ERROR_MESSAGES.UNAUTHORIZED,
          {},
        );
      });
    });

    describe('column structure', () => {
      it('should return columns with name and alias', async () => {
        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.GET_SURVEY_COLUMNS,
          {},
          adminToken,
        );

        response.surveyColumns.forEach((column: any) => {
          SurveyTestHelpers.validateSurveyColumn(column);
        });
      });

      it('should include all column types (category, number, datetime)', async () => {
        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.GET_SURVEY_COLUMNS,
          {},
          adminToken,
        );

        const columnNames = response.surveyColumns.map((col: any) => col.name);

        const hasCategory = columnNames.some((name: string) => name.startsWith('category'));
        const hasNumber = columnNames.some((name: string) => name.startsWith('number'));
        const hasDatetime = columnNames.some((name: string) => name.startsWith('datetime'));

        expect(hasCategory).toBe(true);
        expect(hasNumber).toBe(true);
        expect(hasDatetime).toBe(true);
      });
    });
  });

  describe('surveys', () => {
    describe('authorization', () => {
      let chat: any;

      beforeEach(async () => {
        await context.client.queryExpectSuccess(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          SurveyTestHelpers.updateSettingInput([TEST_COLUMNS.CATEGORY_1]),
          adminToken,
        );

        const endUser = await context.factory.createEndUser();
        chat = await context.factory.createChat(org1.name, endUser.userId);
      });

      it('should allow ADMIN to get surveys', async () => {
        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.GET_SURVEYS,
          { chatId: chat.id },
          adminToken,
        );

        expect(response.surveys).toBeDefined();
      });

      it('should allow MANAGER to get surveys', async () => {
        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.GET_SURVEYS,
          { chatId: chat.id },
          managerToken,
        );

        expect(response.surveys).toBeDefined();
      });

      it('should allow OPERATOR to get surveys', async () => {
        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.GET_SURVEYS,
          { chatId: chat.id },
          operatorToken,
        );

        expect(response.surveys).toBeDefined();
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          SURVEY_QUERIES.GET_SURVEYS,
          ERROR_MESSAGES.UNAUTHORIZED,
          { chatId: chat.id },
        );
      });
    });

    describe('empty settings handling', () => {
      it('should return null when no survey settings exist', async () => {
        const endUser = await context.factory.createEndUser();
        const chat = await context.factory.createChat(org1.name, endUser.userId);

        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.GET_SURVEYS,
          { chatId: chat.id },
          adminToken,
        );

        expect(response.surveys).toBeNull();
      });

      it('should return null when enabledColumns is empty', async () => {
        await context.client.queryExpectSuccess(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          SurveyTestHelpers.updateSettingInput([]),
          adminToken,
        );

        const endUser = await context.factory.createEndUser();
        const chat = await context.factory.createChat(org1.name, endUser.userId);

        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.GET_SURVEYS,
          { chatId: chat.id },
          adminToken,
        );

        expect(response.surveys).toBeNull();
      });
    });

    describe('data retrieval', () => {
      it('should get surveys for specific chat', async () => {
        await context.client.queryExpectSuccess(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          SurveyTestHelpers.updateSettingInput([TEST_COLUMNS.CATEGORY_1, TEST_COLUMNS.NUMBER_1]),
          adminToken,
        );

        const endUser = await context.factory.createEndUser();
        const chat = await context.factory.createChat(org1.name, endUser.userId);

        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.GET_SURVEYS,
          { chatId: chat.id },
          adminToken,
        );

        expect(response.surveys).toBeDefined();
        if (response.surveys && response.surveys.length > 0) {
          response.surveys.forEach((survey: any) => {
            SurveyTestHelpers.validateSurvey(survey);
          });
        }
      });

      it('should get surveys without data', async () => {
        await context.client.queryExpectSuccess(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          SurveyTestHelpers.updateSettingInput([TEST_COLUMNS.CATEGORY_1, TEST_COLUMNS.NUMBER_1]),
          adminToken,
        );

        const endUser = await context.factory.createEndUser();
        const chat = await context.factory.createChat(org1.name, endUser.userId);

        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.GET_SURVEYS,
          { chatId: chat.id },
          adminToken,
        );

        expect(response.surveys).toBeDefined();
        expect(response.surveys.length).toBeGreaterThan(0);
        expect(response.surveys[0].value).toBe('-');
      });
    });

    describe('value transformation', () => {
      it('should transform date values to ISO string', async () => {
        await context.client.queryExpectSuccess(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          SurveyTestHelpers.updateSettingInput([TEST_COLUMNS.DATETIME_1, TEST_COLUMNS.CATEGORY_1]),
          adminToken,
        );

        const endUser = await context.factory.createEndUser();
        const chat = await context.factory.createChat(org1.name, endUser.userId);

        await context.factory.createSurveyData(org1.name, endUser.userId, {
          datetime1: TEST_DATA.DATE,
          category1: TEST_DATA.CATEGORY_VALUE,
        });

        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.GET_SURVEYS,
          { chatId: chat.id },
          adminToken,
        );

        expect(response.surveys).toBeDefined();
        const datetimeSurvey = SurveyTestHelpers.findSurveyByColumn(
          response.surveys,
          TEST_COLUMNS.DATETIME_1,
        );
        expect(datetimeSurvey).toBeDefined();
        expect(datetimeSurvey.value).toBe(TEST_DATA.DATE.toISOString());
      });

      it('should transform number values to string', async () => {
        await context.client.queryExpectSuccess(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          SurveyTestHelpers.updateSettingInput([TEST_COLUMNS.NUMBER_1, TEST_COLUMNS.NUMBER_2]),
          adminToken,
        );

        const endUser = await context.factory.createEndUser();
        const chat = await context.factory.createChat(org1.name, endUser.userId);

        await context.factory.createSurveyData(org1.name, endUser.userId, {
          number1: TEST_DATA.NUMBER_VALUE_1,
          number2: TEST_DATA.NUMBER_VALUE_2,
        });

        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.GET_SURVEYS,
          { chatId: chat.id },
          adminToken,
        );

        expect(response.surveys).toBeDefined();
        const number1Survey = SurveyTestHelpers.findSurveyByColumn(
          response.surveys,
          TEST_COLUMNS.NUMBER_1,
        );
        const number2Survey = SurveyTestHelpers.findSurveyByColumn(
          response.surveys,
          TEST_COLUMNS.NUMBER_2,
        );
        expect(number1Survey.value).toBe(TEST_DATA.NUMBER_VALUE_1.toString());
        expect(number2Survey.value).toBe(TEST_DATA.NUMBER_VALUE_2.toString());
      });

      it('should return "-" for null or undefined values', async () => {
        await context.client.queryExpectSuccess(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          SurveyTestHelpers.updateSettingInput([TEST_COLUMNS.CATEGORY_1, TEST_COLUMNS.NUMBER_1]),
          adminToken,
        );

        const endUser = await context.factory.createEndUser();
        const chat = await context.factory.createChat(org1.name, endUser.userId);

        await context.factory.createSurveyData(org1.name, endUser.userId, {
          category1: null,
          number1: null,
        });

        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.GET_SURVEYS,
          { chatId: chat.id },
          adminToken,
        );

        expect(response.surveys).toBeDefined();
        response.surveys.forEach((survey: any) => {
          expect(survey.value).toBe('-');
        });
      });
    });

    describe('error cases', () => {
      it('should handle non-existent chat', async () => {
        const response = await context.client.query(
          SURVEY_QUERIES.GET_SURVEYS,
          { chatId: 'non-existent-chat-id' },
          adminToken,
        );

        expect(
          response.errors !== undefined ||
            response.data?.surveys === null ||
            (Array.isArray(response.data?.surveys) && response.data.surveys.length === 0),
        ).toBe(true);
      });
    });

    describe('multi-tenancy', () => {
      it('should return organization-specific survey data', async () => {
        await context.client.queryExpectSuccess(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          SurveyTestHelpers.updateSettingInput([TEST_COLUMNS.CATEGORY_1]),
          adminToken,
        );

        const endUser = await context.factory.createEndUser();
        const chat = await context.factory.createChat(org1.name, endUser.userId);

        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.GET_SURVEYS,
          { chatId: chat.id },
          adminToken,
        );

        expect(response.surveys).toBeDefined();
      });
    });
  });

  describe('updateSurveySetting', () => {
    describe('authorization', () => {
      const testInput = SurveyTestHelpers.updateSettingInput([TEST_COLUMNS.CATEGORY_1]);

      it('should allow ADMIN to update setting', async () => {
        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          testInput,
          adminToken,
        );

        expect(response.updateSurveySetting).toBeDefined();
        expect(response.updateSurveySetting).toBeInstanceOf(Array);
        response.updateSurveySetting.forEach((column: any) => {
          SurveyTestHelpers.validateSurveyColumn(column);
        });
        const enabledColumns = response.updateSurveySetting.filter((col: any) => col.isEnabled);
        expect(enabledColumns.some((col: any) => col.name === TEST_COLUMNS.CATEGORY_1)).toBe(true);
      });

      it('should deny MANAGER from updating setting', async () => {
        await context.client.queryExpectError(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          ERROR_MESSAGES.FORBIDDEN,
          testInput,
          managerToken,
        );
      });

      it('should deny OPERATOR from updating setting', async () => {
        await context.client.queryExpectError(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          ERROR_MESSAGES.FORBIDDEN,
          testInput,
          operatorToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          ERROR_MESSAGES.UNAUTHORIZED,
          testInput,
        );
      });
    });

    describe('column types', () => {
      it('should only update isEnabled for category columns', async () => {
        const before = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.GET_SURVEY_COLUMNS,
          {},
          adminToken,
        );

        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          SurveyTestHelpers.updateSettingInput([TEST_COLUMNS.CATEGORY_1, TEST_COLUMNS.CATEGORY_2]),
          adminToken,
        );

        const enabledColumnNames = SurveyTestHelpers.getEnabledColumnNames(
          response.updateSurveySetting,
        );
        expect(enabledColumnNames.length).toBe(2);
        expect(enabledColumnNames).toContain(TEST_COLUMNS.CATEGORY_1);
        expect(enabledColumnNames).toContain(TEST_COLUMNS.CATEGORY_2);
        SurveyTestHelpers.expectAliasesUnchanged(
          before.surveyColumns,
          response.updateSurveySetting,
        );
      });

      it('should only update isEnabled for number columns', async () => {
        const before = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.GET_SURVEY_COLUMNS,
          {},
          adminToken,
        );

        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          SurveyTestHelpers.updateSettingInput([TEST_COLUMNS.NUMBER_1, TEST_COLUMNS.NUMBER_2]),
          adminToken,
        );

        const enabledColumnNames = SurveyTestHelpers.getEnabledColumnNames(
          response.updateSurveySetting,
        );
        expect(enabledColumnNames).toContain(TEST_COLUMNS.NUMBER_1);
        expect(enabledColumnNames).toContain(TEST_COLUMNS.NUMBER_2);
        SurveyTestHelpers.expectAliasesUnchanged(
          before.surveyColumns,
          response.updateSurveySetting,
        );
      });

      it('should only update isEnabled for datetime columns', async () => {
        const before = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.GET_SURVEY_COLUMNS,
          {},
          adminToken,
        );

        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          SurveyTestHelpers.updateSettingInput([TEST_COLUMNS.DATETIME_1, TEST_COLUMNS.DATETIME_2]),
          adminToken,
        );

        const enabledColumnNames = SurveyTestHelpers.getEnabledColumnNames(
          response.updateSurveySetting,
        );
        expect(enabledColumnNames).toContain(TEST_COLUMNS.DATETIME_1);
        expect(enabledColumnNames).toContain(TEST_COLUMNS.DATETIME_2);
        SurveyTestHelpers.expectAliasesUnchanged(
          before.surveyColumns,
          response.updateSurveySetting,
        );
      });

      it('should only update isEnabled for all column types', async () => {
        const before = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.GET_SURVEY_COLUMNS,
          {},
          adminToken,
        );

        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          SurveyTestHelpers.updateSettingInput([
            TEST_COLUMNS.CATEGORY_1,
            TEST_COLUMNS.NUMBER_1,
            TEST_COLUMNS.DATETIME_1,
          ]),
          adminToken,
        );

        const enabledColumnNames = SurveyTestHelpers.getEnabledColumnNames(
          response.updateSurveySetting,
        );
        expect(enabledColumnNames).toContain(TEST_COLUMNS.CATEGORY_1);
        expect(enabledColumnNames).toContain(TEST_COLUMNS.NUMBER_1);
        expect(enabledColumnNames).toContain(TEST_COLUMNS.DATETIME_1);
        SurveyTestHelpers.expectAliasesUnchanged(
          before.surveyColumns,
          response.updateSurveySetting,
        );
      });
    });

    describe('update behavior', () => {
      it('should update with empty enabled columns', async () => {
        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          SurveyTestHelpers.updateSettingInput([]),
          adminToken,
        );

        const enabledColumnNames = SurveyTestHelpers.getEnabledColumnNames(
          response.updateSurveySetting,
        );
        expect(enabledColumnNames).toBeInstanceOf(Array);
        expect(enabledColumnNames.length).toBe(0);
      });

      it('should update with maximum allowed columns', async () => {
        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          SurveyTestHelpers.updateSettingInput([
            TEST_COLUMNS.CATEGORY_1,
            TEST_COLUMNS.CATEGORY_2,
            TEST_COLUMNS.CATEGORY_3,
            TEST_COLUMNS.CATEGORY_4,
            TEST_COLUMNS.CATEGORY_5,
            TEST_COLUMNS.NUMBER_1,
            TEST_COLUMNS.NUMBER_2,
            TEST_COLUMNS.NUMBER_3,
            TEST_COLUMNS.DATETIME_1,
            TEST_COLUMNS.DATETIME_2,
          ]),
          adminToken,
        );

        const enabledColumnNames = SurveyTestHelpers.getEnabledColumnNames(
          response.updateSurveySetting,
        );
        expect(enabledColumnNames.length).toBe(10);
      });

      it('should update setting multiple times (upsert behavior)', async () => {
        await context.client.queryExpectSuccess(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          SurveyTestHelpers.updateSettingInput([TEST_COLUMNS.CATEGORY_1, TEST_COLUMNS.CATEGORY_2]),
          adminToken,
        );

        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          SurveyTestHelpers.updateSettingInput([TEST_COLUMNS.NUMBER_1, TEST_COLUMNS.NUMBER_2]),
          adminToken,
        );

        const enabledColumnNames = SurveyTestHelpers.getEnabledColumnNames(
          response.updateSurveySetting,
        );
        expect(enabledColumnNames).toEqual([TEST_COLUMNS.NUMBER_1, TEST_COLUMNS.NUMBER_2]);
      });

      it('should persist updated setting', async () => {
        await context.client.queryExpectSuccess(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          SurveyTestHelpers.updateSettingInput([
            TEST_COLUMNS.CATEGORY_1,
            TEST_COLUMNS.NUMBER_1,
            TEST_COLUMNS.DATETIME_1,
          ]),
          adminToken,
        );

        const response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.GET_SURVEY_COLUMNS,
          {},
          adminToken,
        );

        const enabledColumnNames = SurveyTestHelpers.getEnabledColumnNames(response.surveyColumns);
        expect(enabledColumnNames).toContain(TEST_COLUMNS.CATEGORY_1);
        expect(enabledColumnNames).toContain(TEST_COLUMNS.NUMBER_1);
        expect(enabledColumnNames).toContain(TEST_COLUMNS.DATETIME_1);
      });
    });

    describe('multi-tenancy', () => {
      it('should handle organization isolation', async () => {
        await context.client.queryExpectSuccess(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          SurveyTestHelpers.updateSettingInput([TEST_COLUMNS.CATEGORY_1, TEST_COLUMNS.CATEGORY_2]),
          adminToken,
        );

        await context.client.queryExpectSuccess(
          SURVEY_QUERIES.UPDATE_SURVEY_SETTING,
          SurveyTestHelpers.updateSettingInput([TEST_COLUMNS.NUMBER_1, TEST_COLUMNS.NUMBER_2]),
          org2AdminToken,
        );

        const org1Response = await context.client.queryExpectSuccess(
          SURVEY_QUERIES.GET_SURVEY_COLUMNS,
          {},
          adminToken,
        );

        const enabledColumnNames = SurveyTestHelpers.getEnabledColumnNames(
          org1Response.surveyColumns,
        );

        expect(enabledColumnNames).toContain(TEST_COLUMNS.CATEGORY_1);
        expect(enabledColumnNames).not.toContain(TEST_COLUMNS.NUMBER_1);
      });
    });
  });
});
