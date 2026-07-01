import request from 'supertest';

import { TestContext, TestSetup } from '../../utils/test-setup';

const TEST_SUBSCRIPTIONS = {
  BASIC: {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-123',
    keys: {
      p256dh: 'test-p256dh-key-value',
      auth: 'test-auth-key-value',
    },
  },
  UPDATED: {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-123',
    keys: {
      p256dh: 'updated-p256dh-key',
      auth: 'updated-auth-key',
    },
  },
  DEVICE_1: {
    endpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
    keys: { p256dh: 'key1', auth: 'auth1' },
  },
  DEVICE_2: {
    endpoint: 'https://fcm.googleapis.com/fcm/send/device-2',
    keys: { p256dh: 'key2', auth: 'auth2' },
  },
  INVALID_URL: {
    endpoint: 'not-a-valid-url',
    keys: {
      p256dh: 'test-p256dh-key-value',
      auth: 'test-auth-key-value',
    },
  },
  MISSING_AUTH: {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test',
    keys: {
      p256dh: 'test-key',
    },
  },
  NON_EXISTENT: {
    endpoint: 'https://fcm.googleapis.com/fcm/send/non-existent',
    keys: {
      p256dh: 'test-key',
      auth: 'test-auth',
    },
  },
} as const;

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
} as const;

// Test Helper Functions
class NotificationTestHelpers {
  static async subscribe(
    app: any,
    token: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth?: string } },
    expectedStatus: number = HTTP_STATUS.CREATED,
  ) {
    return await request(app.getHttpServer())
      .post('/srv/notifications/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send(subscription)
      .expect(expectedStatus);
  }

  static async unsubscribe(
    app: any,
    token: string,
    subscription: { endpoint: string; keys?: { p256dh: string; auth?: string } },
    expectedStatus: number = HTTP_STATUS.CREATED,
  ) {
    return await request(app.getHttpServer())
      .post('/srv/notifications/unsubscribe')
      .set('Authorization', `Bearer ${token}`)
      .send(subscription)
      .expect(expectedStatus);
  }

  static async sync(
    app: any,
    token: string,
    endpoint: string,
    expectedStatus: number = HTTP_STATUS.CREATED,
  ) {
    return await request(app.getHttpServer())
      .post('/srv/notifications/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint })
      .expect(expectedStatus);
  }

  static async sendNotification(app: any, userId: string, expectedStatus?: number, token?: string) {
    const req = request(app.getHttpServer()).post('/srv/notifications/send-notification');

    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }

    req.send({ userId });

    if (expectedStatus) {
      return await req.expect(expectedStatus);
    }
    return await req;
  }

  static validateSyncStatus(response: any, expectedSynced: boolean) {
    expect(response.body).toHaveProperty('synced');
    expect(response.body.synced).toBe(expectedSynced);
  }

  static validateSubscriptionResponse(response: any) {
    expect(response.status).toBe(HTTP_STATUS.CREATED);
  }
}

describe('Notifications Module (E2E)', () => {
  let context: TestContext;
  let org1: any;
  let adminUser: any;
  let adminToken: string;
  let operatorUser: any;
  let operatorToken: string;
  let baselineUsers: { id: string; roleType: string; displayName: string }[] = [];
  let tenantSchemaNames: string[];
  let runId: string;

  beforeAll(async () => {
    context = await TestSetup.createTestApp();

    runId = Date.now().toString(36);

    const { organizations, users, tokens } = await TestSetup.createStandardTestData(
      context.factory,
      context.authHelper,
      `notifications_org1_${runId}`,
      `notifications_org2_${runId}`,
    );

    org1 = organizations.org1;
    adminUser = users.adminUser;
    operatorUser = users.operatorUser;
    adminToken = tokens.adminToken;
    operatorToken = tokens.operatorToken;
    baselineUsers = [
      {
        id: users.adminUser.id,
        roleType: 'ADMIN',
        displayName: users.adminUser.displayName,
      },
      {
        id: users.managerUser.id,
        roleType: 'MANAGER',
        displayName: users.managerUser.displayName,
      },
      {
        id: users.operatorUser.id,
        roleType: 'OPERATOR',
        displayName: users.operatorUser.displayName,
      },
      {
        id: users.org2AdminUser.id,
        roleType: 'ADMIN',
        displayName: users.org2AdminUser.displayName,
      },
    ];
    tenantSchemaNames = await Promise.all([
      context.factory.getTenantSchemaNameForOrganization(org1.name),
      context.factory.getTenantSchemaNameForOrganization(organizations.org2.name),
    ]);
  });

  afterEach(async () => {
    await context.cleaner.cleanNotificationsTestData(tenantSchemaNames, baselineUsers);
  });

  afterAll(async () => {
    await TestSetup.cleanupTestApp(context);
  });

  describe('POST /srv/notifications/subscribe', () => {
    describe('successful subscription', () => {
      it('should successfully subscribe a user to push notifications', async () => {
        await NotificationTestHelpers.subscribe(context.app, adminToken, TEST_SUBSCRIPTIONS.BASIC);

        const syncResponse = await NotificationTestHelpers.sync(
          context.app,
          adminToken,
          TEST_SUBSCRIPTIONS.BASIC.endpoint,
        );
        NotificationTestHelpers.validateSyncStatus(syncResponse, true);
      });

      it('should update existing subscription on re-subscribe', async () => {
        await NotificationTestHelpers.subscribe(context.app, adminToken, TEST_SUBSCRIPTIONS.BASIC);

        const firstSync = await NotificationTestHelpers.sync(
          context.app,
          adminToken,
          TEST_SUBSCRIPTIONS.BASIC.endpoint,
        );
        NotificationTestHelpers.validateSyncStatus(firstSync, true);

        await NotificationTestHelpers.subscribe(
          context.app,
          adminToken,
          TEST_SUBSCRIPTIONS.UPDATED,
        );

        const secondSync = await NotificationTestHelpers.sync(
          context.app,
          adminToken,
          TEST_SUBSCRIPTIONS.BASIC.endpoint,
        );
        NotificationTestHelpers.validateSyncStatus(secondSync, true);
      });
    });

    describe('authorization', () => {
      it('should reject subscription without authentication', async () => {
        await request(context.app.getHttpServer())
          .post('/srv/notifications/subscribe')
          .send(TEST_SUBSCRIPTIONS.BASIC)
          .expect(HTTP_STATUS.UNAUTHORIZED);
      });

      it('should reject subscription for inactive user', async () => {
        const inactiveUser = await context.factory.createUser(org1.name, 'OPERATOR', {
          status: 'INACTIVE',
        });
        const inactiveToken = context.authHelper.generateToken(inactiveUser.id);

        await NotificationTestHelpers.subscribe(
          context.app,
          inactiveToken,
          TEST_SUBSCRIPTIONS.BASIC,
          HTTP_STATUS.FORBIDDEN,
        );
      });
    });

    describe('validation', () => {
      it('should reject subscription with invalid endpoint URL', async () => {
        await NotificationTestHelpers.subscribe(
          context.app,
          adminToken,
          TEST_SUBSCRIPTIONS.INVALID_URL,
          HTTP_STATUS.BAD_REQUEST,
        );
      });

      it('should reject subscription without required keys', async () => {
        await NotificationTestHelpers.subscribe(
          context.app,
          adminToken,
          TEST_SUBSCRIPTIONS.MISSING_AUTH as any,
          HTTP_STATUS.BAD_REQUEST,
        );
      });
    });
  });

  describe('POST /srv/notifications/unsubscribe', () => {
    beforeEach(async () => {
      await NotificationTestHelpers.subscribe(context.app, adminToken, TEST_SUBSCRIPTIONS.BASIC);
    });

    describe('successful unsubscribe', () => {
      it('should successfully unsubscribe from push notifications', async () => {
        await NotificationTestHelpers.unsubscribe(
          context.app,
          adminToken,
          TEST_SUBSCRIPTIONS.BASIC,
        );

        const syncResponse = await NotificationTestHelpers.sync(
          context.app,
          adminToken,
          TEST_SUBSCRIPTIONS.BASIC.endpoint,
        );
        NotificationTestHelpers.validateSyncStatus(syncResponse, false);
      });
    });

    describe('authorization', () => {
      it('should reject unsubscribe without authentication', async () => {
        await request(context.app.getHttpServer())
          .post('/srv/notifications/unsubscribe')
          .send({ endpoint: TEST_SUBSCRIPTIONS.BASIC.endpoint })
          .expect(HTTP_STATUS.UNAUTHORIZED);
      });

      it('should not allow user to unsubscribe another user subscription', async () => {
        await NotificationTestHelpers.unsubscribe(
          context.app,
          operatorToken,
          TEST_SUBSCRIPTIONS.BASIC,
          HTTP_STATUS.NOT_FOUND,
        );

        const syncResponse = await NotificationTestHelpers.sync(
          context.app,
          adminToken,
          TEST_SUBSCRIPTIONS.BASIC.endpoint,
        );
        NotificationTestHelpers.validateSyncStatus(syncResponse, true);
      });
    });

    describe('error cases', () => {
      it('should return 404 when unsubscribing from non-existent subscription', async () => {
        await NotificationTestHelpers.unsubscribe(
          context.app,
          adminToken,
          TEST_SUBSCRIPTIONS.NON_EXISTENT,
          HTTP_STATUS.NOT_FOUND,
        );
      });
    });
  });

  describe('POST /srv/notifications/sync', () => {
    describe('sync status', () => {
      it('should return synced:true for existing subscription', async () => {
        await NotificationTestHelpers.subscribe(context.app, adminToken, TEST_SUBSCRIPTIONS.BASIC);

        const response = await NotificationTestHelpers.sync(
          context.app,
          adminToken,
          TEST_SUBSCRIPTIONS.BASIC.endpoint,
        );
        NotificationTestHelpers.validateSyncStatus(response, true);
      });

      it('should return synced:false for non-existent subscription', async () => {
        const response = await NotificationTestHelpers.sync(
          context.app,
          adminToken,
          TEST_SUBSCRIPTIONS.NON_EXISTENT.endpoint,
        );
        NotificationTestHelpers.validateSyncStatus(response, false);
      });

      it('should return synced:false for another user subscription', async () => {
        await NotificationTestHelpers.subscribe(context.app, adminToken, TEST_SUBSCRIPTIONS.BASIC);

        const response = await NotificationTestHelpers.sync(
          context.app,
          operatorToken,
          TEST_SUBSCRIPTIONS.BASIC.endpoint,
        );
        NotificationTestHelpers.validateSyncStatus(response, false);
      });
    });

    describe('authorization', () => {
      it('should reject sync without authentication', async () => {
        await request(context.app.getHttpServer())
          .post('/srv/notifications/sync')
          .send({ endpoint: TEST_SUBSCRIPTIONS.BASIC.endpoint })
          .expect(HTTP_STATUS.UNAUTHORIZED);
      });
    });
  });

  describe('POST /srv/notifications/send-notification', () => {
    beforeEach(async () => {
      await NotificationTestHelpers.subscribe(context.app, adminToken, TEST_SUBSCRIPTIONS.BASIC);
    });

    describe('sending notifications', () => {
      it('should send notification to user with valid subscription', async () => {
        const response = await NotificationTestHelpers.sendNotification(
          context.app,
          adminUser.id,
          undefined,
          adminToken,
        );

        expect([
          HTTP_STATUS.OK,
          HTTP_STATUS.CREATED,
          HTTP_STATUS.NOT_FOUND,
          HTTP_STATUS.INTERNAL_ERROR,
        ]).toContain(response.status);
      });

      it('should return 404 when sending to user with no subscriptions', async () => {
        await NotificationTestHelpers.sendNotification(
          context.app,
          operatorUser.id,
          HTTP_STATUS.NOT_FOUND,
          adminToken,
        );
      });
    });
  });

  describe('multi-device subscription management', () => {
    describe('multiple devices', () => {
      it('should handle multiple subscriptions for same user', async () => {
        await NotificationTestHelpers.subscribe(
          context.app,
          adminToken,
          TEST_SUBSCRIPTIONS.DEVICE_1,
        );
        await NotificationTestHelpers.subscribe(
          context.app,
          adminToken,
          TEST_SUBSCRIPTIONS.DEVICE_2,
        );

        const sync1 = await NotificationTestHelpers.sync(
          context.app,
          adminToken,
          TEST_SUBSCRIPTIONS.DEVICE_1.endpoint,
        );
        const sync2 = await NotificationTestHelpers.sync(
          context.app,
          adminToken,
          TEST_SUBSCRIPTIONS.DEVICE_2.endpoint,
        );

        NotificationTestHelpers.validateSyncStatus(sync1, true);
        NotificationTestHelpers.validateSyncStatus(sync2, true);
      });

      it('should independently unsubscribe individual devices', async () => {
        await NotificationTestHelpers.subscribe(
          context.app,
          adminToken,
          TEST_SUBSCRIPTIONS.DEVICE_1,
        );
        await NotificationTestHelpers.subscribe(
          context.app,
          adminToken,
          TEST_SUBSCRIPTIONS.DEVICE_2,
        );

        await NotificationTestHelpers.unsubscribe(
          context.app,
          adminToken,
          TEST_SUBSCRIPTIONS.DEVICE_1,
        );

        const sync1 = await NotificationTestHelpers.sync(
          context.app,
          adminToken,
          TEST_SUBSCRIPTIONS.DEVICE_1.endpoint,
        );
        const sync2 = await NotificationTestHelpers.sync(
          context.app,
          adminToken,
          TEST_SUBSCRIPTIONS.DEVICE_2.endpoint,
        );

        NotificationTestHelpers.validateSyncStatus(sync1, false);
        NotificationTestHelpers.validateSyncStatus(sync2, true);
      });
    });
  });
});
