import {
  BadRequestException,
  INestApplication,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '@/app.module';
import { RestThrottlerGuard } from '@/common/guards/rest-throttler.guard';
import { CoreApiService } from '@/modules/core-api/core-api.service';
import { LiglaService } from '@/modules/ligla/ligla.service';
import { MailService } from '@/modules/mail/mail.service';

import { MockCoreApiService } from '../mocks/core-api.service.mock';
import { MockLiglaService } from '../mocks/ligla.service.mock';
import { MockMailService } from '../mocks/mail.service.mock';

import { AuthHelper } from './auth-helper';
import { DatabaseCleaner } from './database-cleaner';
import { GraphQLClient } from './graphql-client';
import { TestDataFactory } from './test-data-factory';

export interface TestContext {
  app: INestApplication;
  client: GraphQLClient;
  authHelper: AuthHelper;
  factory: TestDataFactory;
  cleaner: DatabaseCleaner;
}

export interface TestOrganizations {
  org1: any;
  org2: any;
}

export interface TestUsers {
  adminUser: any;
  managerUser: any;
  operatorUser: any;
  org2AdminUser: any;
}

export interface TestTokens {
  adminToken: string;
  managerToken: string;
  operatorToken: string;
  org2AdminToken: string;
}

export interface StandardTestSetup extends TestContext {
  organizations: TestOrganizations;
  users: TestUsers;
  tokens: TestTokens;
}

/**
 * Shared test setup helper to reduce duplication across e2e test files
 */
export class TestSetup {
  private static readonly DEFAULT_ORGS = {
    org1: 'test_org1',
    org2: 'test_org2',
  };

  static async createTestApp(): Promise<TestContext> {
    const startedAt = Date.now();
    const logStep = (step: string) => {
      const elapsedMs = Date.now() - startedAt;
      console.log(`[test-setup] ${step} (+${elapsedMs}ms)`);
    };

    logStep('begin createTestApp');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(RestThrottlerGuard)
      .useValue({
        canActivate: () => true,
      })
      // Override MailService to avoid sending real emails in tests
      .overrideProvider(MailService)
      .useClass(MockMailService)
      // Override LiglaService to avoid making real HTTP requests to external APIs
      .overrideProvider(LiglaService)
      .useClass(MockLiglaService)
      // Override CoreApiService to avoid external core API calls in e2e tests
      .overrideProvider(CoreApiService)
      .useClass(MockCoreApiService)
      .compile();

    logStep('compiled module');

    const app = moduleFixture.createNestApplication({
      logger: false,
    });

    logStep('created nest application');

    app.useGlobalPipes(
      new ValidationPipe({
        exceptionFactory: (validationErrors: ValidationError[] = []) => {
          return new BadRequestException(
            validationErrors.map((error) => ({
              property: error.property,
              value: error.value,
              constraints: error.constraints,
            })),
          );
        },
      }),
    );

    logStep('registered global pipes');

    await app.init();

    logStep('app initialized');

    const client = new GraphQLClient(app);
    const authHelper = new AuthHelper();
    const factory = new TestDataFactory();
    const cleaner = new DatabaseCleaner();

    logStep('created test helpers');

    return { app, client, authHelper, factory, cleaner };
  }

  static async createStandardTestData(
    factory: TestDataFactory,
    authHelper: AuthHelper,
    _org1Prefix: string = 'test_org1',
    _org2Prefix: string = 'test_org2',
  ): Promise<{
    organizations: TestOrganizations;
    users: TestUsers;
    tokens: TestTokens;
  }> {
    const org1Name = _org1Prefix;
    const org2Name = _org2Prefix;

    // Create test organizations with explicit loginLiffId
    const org1 = await factory.createOrganization({
      name: org1Name,
      loginLiffId: `test_liff_${org1Name}`,
    });
    const org2 = await factory.createOrganization({
      name: org2Name,
      loginLiffId: `test_liff_${org2Name}`,
    });

    // Create users for each role in org1
    const org1EmailDomain = org1Name.replace(/_/g, '-');
    const org2EmailDomain = org2Name.replace(/_/g, '-');

    const adminUser = await factory.createUser(org1.name, 'ADMIN', {
      email: `admin@${org1EmailDomain}.test`,
      displayName: `${org1Name} Admin`,
    });
    const managerUser = await factory.createUser(org1.name, 'MANAGER', {
      email: `manager@${org1EmailDomain}.test`,
      displayName: `${org1Name} Manager`,
    });
    const operatorUser = await factory.createUser(org1.name, 'OPERATOR', {
      email: `operator@${org1EmailDomain}.test`,
      displayName: `${org1Name} Operator`,
    });

    // Create admin for org2
    const org2AdminUser = await factory.createUser(org2.name, 'ADMIN', {
      email: `admin@${org2EmailDomain}.test`,
      displayName: `${org2Name} Admin`,
    });

    // Generate tokens
    const adminToken = authHelper.generateToken(adminUser.id);
    const managerToken = authHelper.generateToken(managerUser.id);
    const operatorToken = authHelper.generateToken(operatorUser.id);
    const org2AdminToken = authHelper.generateToken(org2AdminUser.id);

    return {
      organizations: { org1, org2 },
      users: { adminUser, managerUser, operatorUser, org2AdminUser },
      tokens: { adminToken, managerToken, operatorToken, org2AdminToken },
    };
  }

  static async cleanupTestApp(context: TestContext): Promise<void> {
    // Handle case where context was never created (test setup failed)
    if (!context) {
      return;
    }

    // Cleanup in reverse order of creation, with error handling for each
    const errors: Error[] = [];

    if (context.authHelper) {
      try {
        await context.authHelper.cleanup();
      } catch (error) {
        errors.push(error);
      }
    }

    if (context.factory) {
      try {
        await context.factory.cleanup();
      } catch (error) {
        errors.push(error);
      }
    }

    if (context.cleaner) {
      try {
        await context.cleaner.cleanup();
      } catch (error) {
        errors.push(error);
      }
    }

    if (context.app) {
      try {
        await context.app.close();
      } catch (error) {
        errors.push(error);
      }
    }

    // If there were any errors during cleanup, throw them
    if (errors.length > 0) {
      throw new Error(`Cleanup errors: ${errors.map((e) => e.message).join(', ')}`);
    }
  }
}

/**
 * Common validation helpers for test assertions
 */
export class TestValidators {
  static validateEntityBase(entity: any, additionalChecks?: Record<string, any>): void {
    expect(entity).toBeDefined();
    expect(entity.id).toBeDefined();
    expect(typeof entity.id).toBe('string');
    expect(entity.createdAt).toBeDefined();

    if (additionalChecks) {
      Object.entries(additionalChecks).forEach(([key, value]) => {
        expect(entity[key]).toBe(value);
      });
    }
  }

  /**
   * Validate active status fields
   */
  static validateActiveStatus(entity: any, expectedStatus: boolean = true): void {
    expect(entity.isActive).toBe(expectedStatus);
  }

  /**
   * Validate user entity
   */
  static validateUser(
    user: any,
    expectedFields: {
      email?: string;
      displayName?: string;
      roleType?: string;
      status?: string;
    },
  ): void {
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(typeof user.id).toBe('string');
    expect(user.email).toBeDefined();
    expect(user.displayName).toBeDefined();
    expect(user.roleType).toBeDefined();
    expect(user.status).toBeDefined();

    if (expectedFields.email) {
      expect(user.email).toBe(expectedFields.email);
    }
    if (expectedFields.displayName) {
      expect(user.displayName).toBe(expectedFields.displayName);
    }
    if (expectedFields.roleType) {
      expect(user.roleType).toBe(expectedFields.roleType);
    }
    if (expectedFields.status) {
      expect(user.status).toBe(expectedFields.status);
    }
  }

  /**
   * Validate attribute entity
   */
  static validateAttribute(
    attribute: any,
    expectedFields: {
      name?: string;
      type?: string;
      isActive?: boolean;
    },
  ): void {
    expect(attribute).toBeDefined();
    expect(attribute.id).toBeDefined();
    expect(typeof attribute.id).toBe('string');
    expect(attribute.name).toBeDefined();
    expect(attribute.type).toBeDefined();
    expect(typeof attribute.isActive).toBe('boolean');
    expect(attribute.createdAt).toBeDefined();

    if (expectedFields.name) {
      expect(attribute.name).toBe(expectedFields.name);
    }
    if (expectedFields.type) {
      expect(attribute.type).toBe(expectedFields.type);
    }
    if (expectedFields.isActive !== undefined) {
      expect(attribute.isActive).toBe(expectedFields.isActive);
    }
  }

  /**
   * Validate tag entity
   */
  static validateTag(
    tag: any,
    expectedFields: {
      name?: string;
      isActive?: boolean;
    },
  ): void {
    expect(tag).toBeDefined();
    expect(tag.id).toBeDefined();
    expect(typeof tag.id).toBe('string');
    expect(tag.name).toBeDefined();
    expect(typeof tag.isActive).toBe('boolean');
    expect(tag.createdAt).toBeDefined();

    if (expectedFields.name) {
      expect(tag.name).toBe(expectedFields.name);
    }
    if (expectedFields.isActive !== undefined) {
      expect(tag.isActive).toBe(expectedFields.isActive);
    }
  }

  /**
   * Validate chat entity
   */
  static validateChat(
    chat: any,
    expectedFields: {
      chatStatus?: string;
      endUserId?: string;
    },
  ): void {
    expect(chat).toBeDefined();
    expect(chat.id).toBeDefined();
    expect(typeof chat.id).toBe('string');
    expect(chat.chatStatus).toBeDefined();
    expect(chat.endUserId).toBeDefined();
    expect(chat.createdAt).toBeDefined();

    if (expectedFields.chatStatus) {
      expect(chat.chatStatus).toBe(expectedFields.chatStatus);
    }
    if (expectedFields.endUserId) {
      expect(chat.endUserId).toBe(expectedFields.endUserId);
    }
  }

  /**
   * Validate pagination structure
   */
  static validatePagination(result: any, expectedItemCount?: number, hasMore?: boolean): void {
    expect(result.items).toBeDefined();
    expect(Array.isArray(result.items)).toBe(true);

    if (expectedItemCount !== undefined) {
      expect(result.items.length).toBe(expectedItemCount);
    }

    if (hasMore !== undefined) {
      expect(result.hasMore).toBe(hasMore);
    }

    if (result.hasMore) {
      expect(result.nextCursorId).toBeDefined();
    }
  }

  /**
   * Validate team entity
   */
  static validateTeam(
    team: any,
    expectedFields: {
      name?: string;
      isActive?: boolean;
      isDefault?: boolean;
    },
  ): void {
    expect(team).toBeDefined();
    expect(team.id).toBeDefined();
    expect(typeof team.id).toBe('string');
    expect(team.name).toBeDefined();
    expect(typeof team.isActive).toBe('boolean');
    expect(typeof team.isDefault).toBe('boolean');
    expect(team.createdAt).toBeDefined();

    if (expectedFields.name) {
      expect(team.name).toBe(expectedFields.name);
    }
    if (expectedFields.isActive !== undefined) {
      expect(team.isActive).toBe(expectedFields.isActive);
    }
    if (expectedFields.isDefault !== undefined) {
      expect(team.isDefault).toBe(expectedFields.isDefault);
    }
  }

  /**
   * Validate store entity
   */
  static validateStore(
    store: any,
    expectedFields: {
      name?: string;
      isActive?: boolean;
      liglaStoreId?: number;
    },
  ): void {
    expect(store).toBeDefined();
    expect(store.id).toBeDefined();
    expect(typeof store.id).toBe('string');
    expect(store.name).toBeDefined();
    expect(typeof store.isActive).toBe('boolean');
    expect(store.createdAt).toBeDefined();

    if (expectedFields.name) {
      expect(store.name).toBe(expectedFields.name);
    }
    if (expectedFields.isActive !== undefined) {
      expect(store.isActive).toBe(expectedFields.isActive);
    }
    if (expectedFields.liglaStoreId !== undefined) {
      expect(store.liglaStoreId).toBe(expectedFields.liglaStoreId);
    }
  }

  /**
   * Validate organization entity
   */
  static validateOrganization(
    organization: any,
    expectedFields?: {
      name?: string;
      displayName?: string;
      description?: string;
      maxOperator?: number;
      isActive?: boolean;
      loginLiffId?: string;
      fileUploadLiffId?: string;
    },
  ): void {
    expect(organization).toBeDefined();
    expect(organization.name).toBeDefined();
    expect(typeof organization.name).toBe('string');
    expect(organization.displayName).toBeDefined();
    expect(typeof organization.isActive).toBe('boolean');
    expect(typeof organization.maxOperator).toBe('number');
    expect(organization.loginLiffId).toBeDefined();
    expect(organization.fileUploadLiffId).toBeDefined();

    if (expectedFields?.name) {
      expect(organization.name).toBe(expectedFields.name);
    }
    if (expectedFields?.displayName) {
      expect(organization.displayName).toBe(expectedFields.displayName);
    }
    if (expectedFields?.description !== undefined) {
      expect(organization.description).toBe(expectedFields.description);
    }
    if (expectedFields?.maxOperator !== undefined) {
      expect(organization.maxOperator).toBe(expectedFields.maxOperator);
    }
    if (expectedFields?.isActive !== undefined) {
      expect(organization.isActive).toBe(expectedFields.isActive);
    }
    if (expectedFields?.loginLiffId) {
      expect(organization.loginLiffId).toBe(expectedFields.loginLiffId);
    }
    if (expectedFields?.fileUploadLiffId !== undefined) {
      expect(organization.fileUploadLiffId).toBe(expectedFields.fileUploadLiffId);
    }
  }

  /**
   * Validate list ordering by createdAt (descending)
   */
  static validateDescendingOrder(items: any[]): void {
    const toleranceMs = 100;
    for (let i = 1; i < items.length; i++) {
      const prev = new Date(items[i - 1].createdAt);
      const curr = new Date(items[i].createdAt);
      const delta = prev.getTime() - curr.getTime();
      expect(delta).toBeGreaterThanOrEqual(-toleranceMs);
    }
  }

  /**
   * Validate list ordering by createdAt (ascending)
   */
  static validateAscendingOrder(items: any[]): void {
    for (let i = 1; i < items.length; i++) {
      const prev = new Date(items[i - 1].createdAt);
      const curr = new Date(items[i].createdAt);
      expect(prev.getTime()).toBeLessThanOrEqual(curr.getTime());
    }
  }

  /**
   * Validate authentication token structure
   */
  static validateAuthToken(loginResponse: any): void {
    expect(loginResponse).toBeDefined();
    expect(loginResponse.accessToken).toBeDefined();
    expect(typeof loginResponse.accessToken).toBe('string');
    expect(loginResponse.accessToken.length).toBeGreaterThan(0);
  }

  /**
   * Validate chat note entity
   */
  static validateChatNote(
    note: any,
    expectedFields: {
      chatId?: string;
      userId?: string;
      noteValue?: string;
      isActive?: boolean;
    },
  ): void {
    expect(note).toBeDefined();
    expect(note.id).toBeDefined();
    expect(typeof note.id).toBe('string');
    expect(note.chatId).toBeDefined();
    expect(note.userId).toBeDefined();
    expect(note.noteValue).toBeDefined();
    expect(typeof note.isActive).toBe('boolean');
    expect(note.createdAt).toBeDefined();

    if (expectedFields.chatId) {
      expect(note.chatId).toBe(expectedFields.chatId);
    }
    if (expectedFields.userId) {
      expect(note.userId).toBe(expectedFields.userId);
    }
    if (expectedFields.noteValue) {
      expect(note.noteValue).toBe(expectedFields.noteValue);
    }
    if (expectedFields.isActive !== undefined) {
      expect(note.isActive).toBe(expectedFields.isActive);
    }
  }

  /**
   * Validate chat activity entity
   */
  static validateChatActivity(
    activity: any,
    expectedFields: {
      chatId?: string;
      activityType?: string;
      actorId?: string;
      actorUserName?: string;
      oldUserId?: string;
      newUserId?: string;
      oldUserName?: string;
      newUserName?: string;
      oldTeamIds?: string;
      newTeamIds?: string;
      oldTeamNames?: string;
      newTeamNames?: string;
      teamAssignAction?: string;
    },
  ): void {
    expect(activity).toBeDefined();
    expect(activity.id).toBeDefined();
    expect(typeof activity.id).toBe('string');
    expect(activity.chatId).toBeDefined();
    expect(activity.activityType).toBeDefined();
    expect(activity.createdAt).toBeDefined();

    if (expectedFields.chatId) {
      expect(activity.chatId).toBe(expectedFields.chatId);
    }
    if (expectedFields.activityType) {
      expect(activity.activityType).toBe(expectedFields.activityType);
    }
    if (expectedFields.actorId) {
      expect(activity.actorId).toBe(expectedFields.actorId);
    }
    if (expectedFields.actorUserName) {
      expect(activity.actorUserName).toBe(expectedFields.actorUserName);
    }
    if (expectedFields.oldUserId !== undefined) {
      expect(activity.oldUserId).toBe(expectedFields.oldUserId);
    }
    if (expectedFields.newUserId) {
      expect(activity.newUserId).toBe(expectedFields.newUserId);
    }
    if (expectedFields.oldUserName !== undefined) {
      expect(activity.oldUserName).toBe(expectedFields.oldUserName);
    }
    if (expectedFields.newUserName) {
      expect(activity.newUserName).toBe(expectedFields.newUserName);
    }
    if (expectedFields.oldTeamIds !== undefined) {
      expect(activity.oldTeamIds).toBe(expectedFields.oldTeamIds);
    }
    if (expectedFields.newTeamIds) {
      expect(activity.newTeamIds).toBe(expectedFields.newTeamIds);
    }
    if (expectedFields.oldTeamNames !== undefined) {
      expect(activity.oldTeamNames).toBe(expectedFields.oldTeamNames);
    }
    if (expectedFields.newTeamNames) {
      expect(activity.newTeamNames).toBe(expectedFields.newTeamNames);
    }
    if (expectedFields.teamAssignAction) {
      expect(activity.teamAssignAction).toBe(expectedFields.teamAssignAction);
    }
  }

  /**
   * Validate chat message entity
   */
  static validateChatMessage(
    message: any,
    expectedFields: {
      chatId?: string;
      senderId?: string;
      senderType?: string;
      type?: string;
      isDelivered?: boolean;
      content?: any;
    },
  ): void {
    expect(message).toBeDefined();
    expect(message.id).toBeDefined();
    expect(typeof message.id).toBe('string');
    expect(message.chatId).toBeDefined();
    expect(message.senderType).toBeDefined();
    expect(message.type).toBeDefined();
    expect(message.createdAt).toBeDefined();
    expect(typeof message.isDelivered).toBe('boolean');

    if (expectedFields.chatId) {
      expect(message.chatId).toBe(expectedFields.chatId);
    }
    if (expectedFields.senderId) {
      expect(message.senderId).toBe(expectedFields.senderId);
    }
    if (expectedFields.senderType) {
      expect(message.senderType).toBe(expectedFields.senderType);
    }
    if (expectedFields.type) {
      expect(message.type).toBe(expectedFields.type);
    }
    if (expectedFields.isDelivered !== undefined) {
      expect(message.isDelivered).toBe(expectedFields.isDelivered);
    }
    if (expectedFields.content) {
      expect(message.content).toMatchObject(expectedFields.content);
    }
  }

  /**
   * Validate ChatReplySetting entity
   */
  static validateChatReplySetting(
    setting: any,
    expectedFields: {
      id?: string;
      isActive?: boolean;
      updatedBy?: string;
      scheduleCount?: number;
      messageCount?: number;
    } = {},
  ): void {
    expect(setting).toBeDefined();
    expect(setting.id).toBeDefined();
    expect(typeof setting.id).toBe('string');
    expect(typeof setting.isActive).toBe('boolean');
    expect(setting.chatReplySchedules).toBeDefined();
    expect(Array.isArray(setting.chatReplySchedules)).toBe(true);
    expect(setting.chatReplySettingMessages).toBeDefined();
    expect(Array.isArray(setting.chatReplySettingMessages)).toBe(true);

    if (expectedFields.id) {
      expect(setting.id).toBe(expectedFields.id);
    }
    if (expectedFields.isActive !== undefined) {
      expect(setting.isActive).toBe(expectedFields.isActive);
    }
    if (expectedFields.updatedBy) {
      expect(setting.updatedBy).toBe(expectedFields.updatedBy);
    }
    if (expectedFields.scheduleCount !== undefined) {
      expect(setting.chatReplySchedules).toHaveLength(expectedFields.scheduleCount);
    }
    if (expectedFields.messageCount !== undefined) {
      expect(setting.chatReplySettingMessages).toHaveLength(expectedFields.messageCount);
    }
  }

  /**
   * Validate ChatReplySchedule structure
   */
  static validateChatReplySchedule(schedule: any): void {
    expect(schedule).toBeDefined();
    expect(schedule.scheduleType).toBeDefined();
    expect(typeof schedule.scheduleType).toBe('string');
    expect(schedule.chatReplyScheduleTimeRanges).toBeDefined();
    expect(Array.isArray(schedule.chatReplyScheduleTimeRanges)).toBe(true);
    expect(schedule.chatReplyScheduleTimeRanges.length).toBeGreaterThan(0);

    // Validate time ranges
    schedule.chatReplyScheduleTimeRanges.forEach((range: any) => {
      expect(range.startTime).toBeDefined();
      expect(range.endTime).toBeDefined();
      expect(range.timeRangeType).toBeDefined();
      expect(typeof range.startTime).toBe('string');
      expect(typeof range.endTime).toBe('string');
    });

    // Validate custom dates if present
    if (schedule.scheduleType === 'CUSTOM_DATE') {
      expect(schedule.chatReplyScheduleCustomDates).toBeDefined();
      expect(Array.isArray(schedule.chatReplyScheduleCustomDates)).toBe(true);
    }
  }

  /**
   * Validate ChatReplySettingMessage structure
   */
  static validateChatReplySettingMessage(message: any): void {
    expect(message).toBeDefined();
    expect(message.timeRangeType).toBeDefined();
    expect(typeof message.timeRangeType).toBe('string');
    expect(message.chatReplyMessageTemplate).toBeDefined();
    expect(message.chatReplyMessageTemplate.type).toBeDefined();
    expect(typeof message.chatReplyMessageTemplate.type).toBe('string');
    expect(message.chatReplyMessageTemplate.content).toBeDefined();
  }
}
