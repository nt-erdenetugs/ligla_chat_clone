import { CHAT_REPLY_QUERIES } from '../../fixtures/graphql/chat-reply.queries';
import {
  getMockStorageCalls,
  resetMockStorage,
  setMockStorageFile,
} from '../../mocks/google-cloud-storage.mock';
import { TestSetup, TestValidators, TestContext } from '../../utils/test-setup';

jest.mock('@google-cloud/storage', () =>
  jest.requireActual('../../mocks/google-cloud-storage.mock'),
);

const TEST_SCHEDULES = {
  MONDAY: {
    scheduleType: 'MONDAY',
    timeRanges: [
      {
        startTime: '09:00',
        endTime: '18:00',
        timeRangeType: 'ACTIVE_TIME',
      },
    ],
  },
  TUESDAY: {
    scheduleType: 'TUESDAY',
    timeRanges: [
      {
        startTime: '10:00',
        endTime: '17:00',
        timeRangeType: 'ACTIVE_TIME',
      },
    ],
  },
  CUSTOM_DATE: (date: Date) => ({
    scheduleType: 'CUSTOM_DATE',
    customDates: [date],
    timeRanges: [
      {
        startTime: '00:00',
        endTime: '23:59',
        timeRangeType: 'ACTIVE_TIME',
      },
    ],
  }),
  MULTI_RANGE: {
    scheduleType: 'WEDNESDAY',
    timeRanges: [
      {
        startTime: '09:00',
        endTime: '12:00',
        timeRangeType: 'ACTIVE_TIME',
      },
      {
        startTime: '13:00',
        endTime: '18:00',
        timeRangeType: 'ACTIVE_TIME',
      },
    ],
  },
} as const;

const TEST_MESSAGES = {
  DEFAULT_TEXT: {
    messageTemplate: {
      type: 'TEXT',
      text: 'Test auto reply',
    },
    timeRangeType: 'DEFAULT',
  },
  ACTIVE_TIME_TEXT: {
    messageTemplate: {
      type: 'TEXT',
      text: 'We are available now',
    },
    timeRangeType: 'ACTIVE_TIME',
  },
  OFFLINE_TEXT: {
    messageTemplate: {
      type: 'TEXT',
      text: 'We are currently offline',
    },
    timeRangeType: 'DEFAULT',
  },
} as const;

const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized',
  NOT_FOUND: 'not found',
  DIFFERENT_ORG: 'belongs to a different organization',
} as const;

const TEST_ORGANIZATIONS = {
  ORG1: 'chat_reply_org1',
  ORG2: 'chat_reply_org2',
} as const;

// Test Helper Class
class ChatReplyTestHelpers {
  static createSettingInput(overrides: any = {}) {
    return {
      isActive: true,
      schedules: [],
      messages: [TEST_MESSAGES.DEFAULT_TEXT],
      ...overrides,
    };
  }

  static updateSettingInput(id: string, overrides: any = {}) {
    return {
      id,
      isActive: true,
      schedules: [],
      messages: [TEST_MESSAGES.DEFAULT_TEXT],
      ...overrides,
    };
  }

  static validateSchedules(actual: any[], expectedCount: number, expectedType?: string) {
    expect(actual).toHaveLength(expectedCount);
    actual.forEach((schedule) => {
      TestValidators.validateChatReplySchedule(schedule);
      if (expectedType) {
        expect(schedule.scheduleType).toBe(expectedType);
      }
    });
  }

  static validateMessages(actual: any[], expectedCount: number) {
    expect(actual).toHaveLength(expectedCount);
    actual.forEach((message) => {
      TestValidators.validateChatReplySettingMessage(message);
    });
  }

  static validateTimeRangeTypes(messages: any[], expectedTypes: string[]) {
    const actualTypes = messages.map((m) => m.timeRangeType);
    expectedTypes.forEach((type) => {
      expect(actualTypes).toContain(type);
    });
    expect(actualTypes).toHaveLength(expectedTypes.length);
  }

  static validateScheduleType(schedules: any[], expectedType: string, index: number = 0) {
    expect(schedules[index].scheduleType).toBe(expectedType);
  }

  static validateTimeRangeCount(schedules: any[], expectedCount: number, index: number = 0) {
    expect(schedules[index].chatReplyScheduleTimeRanges).toHaveLength(expectedCount);
  }
}

describe('ChatReply (E2E)', () => {
  let context: TestContext;
  let org1: any;
  let org2: any;
  let adminToken: string;
  let managerToken: string;
  let operatorToken: string;
  let adminUser: any;
  let managerUser: any;
  let _operatorUser: any;
  let tenantSchemaNames: string[];

  beforeAll(async () => {
    context = await TestSetup.createTestApp();
    const { organizations, users, tokens } = await TestSetup.createStandardTestData(
      context.factory,
      context.authHelper,
      TEST_ORGANIZATIONS.ORG1,
      TEST_ORGANIZATIONS.ORG2,
    );

    org1 = organizations.org1;
    org2 = organizations.org2;
    adminUser = users.adminUser;
    managerUser = users.managerUser;
    _operatorUser = users.operatorUser;
    adminToken = tokens.adminToken;
    managerToken = tokens.managerToken;
    operatorToken = tokens.operatorToken;
    tenantSchemaNames = await Promise.all([
      context.factory.getTenantSchemaNameForOrganization(org1.name),
      context.factory.getTenantSchemaNameForOrganization(org2.name),
    ]);
  });

  afterEach(async () => {
    resetMockStorage();
    await context.cleaner.cleanChatReplyTestData(tenantSchemaNames);
  });

  afterAll(async () => {
    await TestSetup.cleanupTestApp(context);
  });

  describe('chatReplySetting (query)', () => {
    describe('authorization', () => {
      beforeEach(async () => {
        await context.factory.createCompleteChatReplySetting(org1.name, adminUser.email);
      });

      it('should allow ADMIN to get chat reply setting', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.GET_CHAT_REPLY_SETTING,
          { inputOrganizationId: org1.id },
          adminToken,
        );

        TestValidators.validateChatReplySetting(response.chatReplySetting, { isActive: true });
      });

      it('should allow MANAGER to get chat reply setting', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.GET_CHAT_REPLY_SETTING,
          { inputOrganizationId: org1.id },
          managerToken,
        );

        TestValidators.validateChatReplySetting(response.chatReplySetting);
      });

      it('should allow OPERATOR to get chat reply setting', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.GET_CHAT_REPLY_SETTING,
          { inputOrganizationId: org1.id },
          operatorToken,
        );

        TestValidators.validateChatReplySetting(response.chatReplySetting);
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          CHAT_REPLY_QUERIES.GET_CHAT_REPLY_SETTING,
          ERROR_MESSAGES.UNAUTHORIZED,
          { inputOrganizationId: org1.id },
        );
      });
    });

    describe('setting retrieval', () => {
      it('should return null when no setting exists', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.GET_CHAT_REPLY_SETTING,
          { inputOrganizationId: org1.id },
          adminToken,
        );

        expect(response.chatReplySetting).toBeNull();
      });

      it('should get setting with complete details', async () => {
        const setting = await context.factory.createCompleteChatReplySetting(
          org1.name,
          adminUser.email,
        );

        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.GET_CHAT_REPLY_SETTING,
          { inputOrganizationId: org1.id },
          adminToken,
        );

        TestValidators.validateChatReplySetting(response.chatReplySetting, {
          id: setting.id,
          updatedBy: adminUser.email,
        });
      });

      it('should include schedules in response', async () => {
        await context.factory.createCompleteChatReplySetting(org1.name, adminUser.email);

        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.GET_CHAT_REPLY_SETTING,
          { inputOrganizationId: org1.id },
          adminToken,
        );

        TestValidators.validateChatReplySetting(response.chatReplySetting);
        expect(response.chatReplySetting.chatReplySchedules.length).toBeGreaterThan(0);
        response.chatReplySetting.chatReplySchedules.forEach((schedule: any) => {
          TestValidators.validateChatReplySchedule(schedule);
        });
      });

      it('should include messages in response', async () => {
        await context.factory.createCompleteChatReplySetting(org1.name, adminUser.email);

        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.GET_CHAT_REPLY_SETTING,
          { inputOrganizationId: org1.id },
          adminToken,
        );

        TestValidators.validateChatReplySetting(response.chatReplySetting);
        expect(response.chatReplySetting.chatReplySettingMessages.length).toBeGreaterThan(0);
        response.chatReplySetting.chatReplySettingMessages.forEach((message: any) => {
          TestValidators.validateChatReplySettingMessage(message);
        });
      });

      it('should convert same-tenant gs image content in chat reply templates', async () => {
        const bucketName = process.env.GCP_STORAGE_CHAT_DATA_BUCKET || 'ligla-chat-data-test';
        const imagePath = `${org1.name}/images/U1234567890abcdef1234567890abcdef/chat-reply-message-1710000002.jpg`;

        setMockStorageFile(bucketName, imagePath, { content: 'chat-reply-image' });

        const template = await context.factory.createChatReplyMessageTemplate(org1.name, {
          type: 'IMAGE',
          content: JSON.stringify({ image: `gs://${bucketName}/${imagePath}` }),
        });

        await context.factory.createChatReplySettingWithTemplates(
          org1.name,
          [template.id],
          adminUser.email,
        );

        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.GET_CHAT_REPLY_SETTING,
          { inputOrganizationId: org1.id },
          adminToken,
        );

        const message = response.chatReplySetting.chatReplySettingMessages[0];
        expect(message.chatReplyMessageTemplate.content).toBe(
          `data:image/jpg;base64, ${Buffer.from('chat-reply-image').toString('base64')}`,
        );
        expect(getMockStorageCalls().download).toEqual([{ bucketName, filePath: imagePath }]);
      });

      it('should block cross-tenant gs image content in chat reply templates', async () => {
        const bucketName = process.env.GCP_STORAGE_CHAT_DATA_BUCKET || 'ligla-chat-data-test';
        const imagePath = `${org2.name}/images/U1234567890abcdef1234567890abcdef/chat-reply-message-1710000003.jpg`;

        setMockStorageFile(bucketName, imagePath, { content: 'cross-tenant-chat-reply-image' });

        const template = await context.factory.createChatReplyMessageTemplate(org1.name, {
          type: 'IMAGE',
          content: JSON.stringify({ image: `gs://${bucketName}/${imagePath}` }),
        });

        await context.factory.createChatReplySettingWithTemplates(
          org1.name,
          [template.id],
          adminUser.email,
        );

        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.GET_CHAT_REPLY_SETTING,
          { inputOrganizationId: org1.id },
          adminToken,
        );

        const message = response.chatReplySetting.chatReplySettingMessages[0];
        expect(message.chatReplyMessageTemplate.content).toBe('');
        expect(getMockStorageCalls().download).toEqual([]);
      });
    });

    describe('multi-tenancy', () => {
      it('should not return settings from other organizations', async () => {
        await context.factory.createCompleteChatReplySetting(org2.name);

        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.GET_CHAT_REPLY_SETTING,
          { inputOrganizationId: org1.id },
          adminToken,
        );

        expect(response.chatReplySetting).toBeNull();
      });
    });
  });

  describe('createChatReplySetting (mutation)', () => {
    describe('authorization', () => {
      const input = ChatReplyTestHelpers.createSettingInput();

      it('should allow ADMIN to create chat reply setting', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.CREATE_CHAT_REPLY_SETTING,
          {
            createChatReplySettingInput: input,
            inputOrganizationId: org1.id,
          },
          adminToken,
        );

        TestValidators.validateChatReplySetting(response.createChatReplySetting, {
          isActive: true,
          messageCount: 1,
          scheduleCount: 0,
        });
      });

      it('should allow MANAGER to create chat reply setting', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.CREATE_CHAT_REPLY_SETTING,
          {
            createChatReplySettingInput: input,
            inputOrganizationId: org1.id,
          },
          managerToken,
        );

        TestValidators.validateChatReplySetting(response.createChatReplySetting);
      });

      it('should allow OPERATOR to create chat reply setting', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.CREATE_CHAT_REPLY_SETTING,
          {
            createChatReplySettingInput: input,
            inputOrganizationId: org1.id,
          },
          operatorToken,
        );

        TestValidators.validateChatReplySetting(response.createChatReplySetting);
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          CHAT_REPLY_QUERIES.CREATE_CHAT_REPLY_SETTING,
          ERROR_MESSAGES.UNAUTHORIZED,
          {
            createChatReplySettingInput: input,
            inputOrganizationId: org1.id,
          },
        );
      });
    });

    describe('schedule creation', () => {
      it('should create setting with single schedule', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.CREATE_CHAT_REPLY_SETTING,
          {
            createChatReplySettingInput: ChatReplyTestHelpers.createSettingInput({
              schedules: [TEST_SCHEDULES.MONDAY],
            }),
            inputOrganizationId: org1.id,
          },
          adminToken,
        );

        TestValidators.validateChatReplySetting(response.createChatReplySetting, {
          scheduleCount: 1,
        });
        ChatReplyTestHelpers.validateSchedules(
          response.createChatReplySetting.chatReplySchedules,
          1,
          'MONDAY',
        );
      });

      it('should create setting with multiple schedules', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.CREATE_CHAT_REPLY_SETTING,
          {
            createChatReplySettingInput: ChatReplyTestHelpers.createSettingInput({
              schedules: [TEST_SCHEDULES.MONDAY, TEST_SCHEDULES.TUESDAY],
            }),
            inputOrganizationId: org1.id,
          },
          adminToken,
        );

        TestValidators.validateChatReplySetting(response.createChatReplySetting, {
          scheduleCount: 2,
        });
        ChatReplyTestHelpers.validateSchedules(
          response.createChatReplySetting.chatReplySchedules,
          2,
        );
      });

      it('should create setting with custom dates', async () => {
        const customDate = new Date('2024-12-25');
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.CREATE_CHAT_REPLY_SETTING,
          {
            createChatReplySettingInput: ChatReplyTestHelpers.createSettingInput({
              schedules: [TEST_SCHEDULES.CUSTOM_DATE(customDate)],
            }),
            inputOrganizationId: org1.id,
          },
          adminToken,
        );

        TestValidators.validateChatReplySetting(response.createChatReplySetting, {
          scheduleCount: 1,
        });
        ChatReplyTestHelpers.validateScheduleType(
          response.createChatReplySetting.chatReplySchedules,
          'CUSTOM_DATE',
        );
        expect(
          response.createChatReplySetting.chatReplySchedules[0].chatReplyScheduleCustomDates,
        ).toBeDefined();
        expect(
          Array.isArray(
            response.createChatReplySetting.chatReplySchedules[0].chatReplyScheduleCustomDates,
          ),
        ).toBe(true);
      });

      it('should create setting with multiple time ranges', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.CREATE_CHAT_REPLY_SETTING,
          {
            createChatReplySettingInput: ChatReplyTestHelpers.createSettingInput({
              schedules: [TEST_SCHEDULES.MULTI_RANGE],
            }),
            inputOrganizationId: org1.id,
          },
          adminToken,
        );

        TestValidators.validateChatReplySetting(response.createChatReplySetting, {
          scheduleCount: 1,
        });
        ChatReplyTestHelpers.validateTimeRangeCount(
          response.createChatReplySetting.chatReplySchedules,
          2,
        );
      });

      it('should create setting without schedules', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.CREATE_CHAT_REPLY_SETTING,
          {
            createChatReplySettingInput: ChatReplyTestHelpers.createSettingInput({
              schedules: [],
            }),
            inputOrganizationId: org1.id,
          },
          adminToken,
        );

        TestValidators.validateChatReplySetting(response.createChatReplySetting, {
          scheduleCount: 0,
        });
      });
    });

    describe('message creation', () => {
      it('should create setting with single message', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.CREATE_CHAT_REPLY_SETTING,
          {
            createChatReplySettingInput: ChatReplyTestHelpers.createSettingInput({
              messages: [TEST_MESSAGES.DEFAULT_TEXT],
            }),
            inputOrganizationId: org1.id,
          },
          adminToken,
        );

        TestValidators.validateChatReplySetting(response.createChatReplySetting, {
          messageCount: 1,
        });
        ChatReplyTestHelpers.validateMessages(
          response.createChatReplySetting.chatReplySettingMessages,
          1,
        );
      });

      it('should create setting with ACTIVE_TIME and DEFAULT messages', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.CREATE_CHAT_REPLY_SETTING,
          {
            createChatReplySettingInput: ChatReplyTestHelpers.createSettingInput({
              schedules: [TEST_SCHEDULES.MONDAY],
              messages: [TEST_MESSAGES.ACTIVE_TIME_TEXT, TEST_MESSAGES.OFFLINE_TEXT],
            }),
            inputOrganizationId: org1.id,
          },
          adminToken,
        );

        TestValidators.validateChatReplySetting(response.createChatReplySetting, {
          scheduleCount: 1,
          messageCount: 2,
        });
        ChatReplyTestHelpers.validateMessages(
          response.createChatReplySetting.chatReplySettingMessages,
          2,
        );
        ChatReplyTestHelpers.validateTimeRangeTypes(
          response.createChatReplySetting.chatReplySettingMessages,
          ['ACTIVE_TIME', 'DEFAULT'],
        );
      });
    });

    describe('status settings', () => {
      it('should create active setting', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.CREATE_CHAT_REPLY_SETTING,
          {
            createChatReplySettingInput: ChatReplyTestHelpers.createSettingInput({
              isActive: true,
            }),
            inputOrganizationId: org1.id,
          },
          adminToken,
        );

        TestValidators.validateActiveStatus(response.createChatReplySetting, true);
      });

      it('should create inactive setting', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.CREATE_CHAT_REPLY_SETTING,
          {
            createChatReplySettingInput: ChatReplyTestHelpers.createSettingInput({
              isActive: false,
            }),
            inputOrganizationId: org1.id,
          },
          adminToken,
        );

        TestValidators.validateActiveStatus(response.createChatReplySetting, false);
      });
    });
  });

  describe('updateChatReplySetting (mutation)', () => {
    let existingSetting: any;

    beforeEach(async () => {
      existingSetting = await context.factory.createCompleteChatReplySetting(
        org1.name,
        adminUser.email,
      );
    });

    describe('authorization', () => {
      const getUpdateInput = () =>
        ChatReplyTestHelpers.updateSettingInput(existingSetting.id, {
          isActive: false,
        });

      it('should allow ADMIN to update chat reply setting', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.UPDATE_CHAT_REPLY_SETTING,
          {
            updateChatReplySettingInput: getUpdateInput(),
          },
          adminToken,
        );

        TestValidators.validateChatReplySetting(response.updateChatReplySetting, {
          id: existingSetting.id,
          isActive: false,
        });
      });

      it('should allow MANAGER to update chat reply setting', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.UPDATE_CHAT_REPLY_SETTING,
          {
            updateChatReplySettingInput: getUpdateInput(),
          },
          managerToken,
        );

        TestValidators.validateChatReplySetting(response.updateChatReplySetting, {
          updatedBy: managerUser.id,
        });
      });

      it('should allow OPERATOR to update chat reply setting', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.UPDATE_CHAT_REPLY_SETTING,
          {
            updateChatReplySettingInput: getUpdateInput(),
          },
          operatorToken,
        );

        TestValidators.validateChatReplySetting(response.updateChatReplySetting);
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          CHAT_REPLY_QUERIES.UPDATE_CHAT_REPLY_SETTING,
          ERROR_MESSAGES.UNAUTHORIZED,
          {
            updateChatReplySettingInput: getUpdateInput(),
          },
        );
      });
    });

    describe('field updates', () => {
      it('should update isActive status', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.UPDATE_CHAT_REPLY_SETTING,
          {
            updateChatReplySettingInput: ChatReplyTestHelpers.updateSettingInput(
              existingSetting.id,
              {
                isActive: false,
              },
            ),
          },
          adminToken,
        );

        TestValidators.validateChatReplySetting(response.updateChatReplySetting, {
          isActive: false,
        });
      });

      it('should replace schedules when updating', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.UPDATE_CHAT_REPLY_SETTING,
          {
            updateChatReplySettingInput: ChatReplyTestHelpers.updateSettingInput(
              existingSetting.id,
              {
                schedules: [TEST_SCHEDULES.TUESDAY],
              },
            ),
          },
          adminToken,
        );

        TestValidators.validateChatReplySetting(response.updateChatReplySetting, {
          scheduleCount: 1,
        });
        ChatReplyTestHelpers.validateSchedules(
          response.updateChatReplySetting.chatReplySchedules,
          1,
          'TUESDAY',
        );
      });

      it('should replace messages when updating', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.UPDATE_CHAT_REPLY_SETTING,
          {
            updateChatReplySettingInput: ChatReplyTestHelpers.updateSettingInput(
              existingSetting.id,
              {
                messages: [TEST_MESSAGES.ACTIVE_TIME_TEXT, TEST_MESSAGES.OFFLINE_TEXT],
              },
            ),
          },
          adminToken,
        );

        TestValidators.validateChatReplySetting(response.updateChatReplySetting, {
          messageCount: 2,
        });
        ChatReplyTestHelpers.validateMessages(
          response.updateChatReplySetting.chatReplySettingMessages,
          2,
        );
        ChatReplyTestHelpers.validateTimeRangeTypes(
          response.updateChatReplySetting.chatReplySettingMessages,
          ['ACTIVE_TIME', 'DEFAULT'],
        );
      });

      it('should update all fields simultaneously', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.UPDATE_CHAT_REPLY_SETTING,
          {
            updateChatReplySettingInput: ChatReplyTestHelpers.updateSettingInput(
              existingSetting.id,
              {
                isActive: false,
                schedules: [TEST_SCHEDULES.MONDAY, TEST_SCHEDULES.TUESDAY],
                messages: [TEST_MESSAGES.ACTIVE_TIME_TEXT],
              },
            ),
          },
          adminToken,
        );

        TestValidators.validateChatReplySetting(response.updateChatReplySetting, {
          isActive: false,
          scheduleCount: 2,
          messageCount: 1,
        });
      });

      it('should clear schedules by updating with empty array', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_REPLY_QUERIES.UPDATE_CHAT_REPLY_SETTING,
          {
            updateChatReplySettingInput: ChatReplyTestHelpers.updateSettingInput(
              existingSetting.id,
              {
                schedules: [],
              },
            ),
          },
          adminToken,
        );

        TestValidators.validateChatReplySetting(response.updateChatReplySetting, {
          scheduleCount: 0,
        });
      });
    });

    describe('error cases', () => {
      it('should not allow updating settings from other organizations', async () => {
        const org2Setting = await context.factory.createCompleteChatReplySetting(org2.name);

        await context.client.queryExpectError(
          CHAT_REPLY_QUERIES.UPDATE_CHAT_REPLY_SETTING,
          ERROR_MESSAGES.DIFFERENT_ORG,
          {
            updateChatReplySettingInput: ChatReplyTestHelpers.updateSettingInput(org2Setting.id, {
              isActive: false,
            }),
          },
          adminToken,
        );
      });

      it('should return error for non-existent setting', async () => {
        await context.cleaner.cleanChatReplyTestData(tenantSchemaNames);

        await context.client.queryExpectError(
          CHAT_REPLY_QUERIES.UPDATE_CHAT_REPLY_SETTING,
          ERROR_MESSAGES.NOT_FOUND,
          {
            updateChatReplySettingInput: ChatReplyTestHelpers.updateSettingInput(
              `${org1.id}:chatReply`,
              {
                isActive: true,
              },
            ),
          },
          adminToken,
        );
      });
    });
  });
});
