import request from 'supertest';

import {
  ChatTestContext,
  getSharedChatTestApp,
  cleanupSharedChatTestApp,
  setupChatTests,
} from './chat-test.setup';

const SSE_ENDPOINTS = {
  EVENTS: '/srv/events',
  RECEIVE: '/srv/events/receive',
} as const;

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_for_e2e_testing_only';

const ERROR_STATUS = {
  UNAUTHORIZED: 401,
  BAD_REQUEST: 400,
  CREATED: 201,
} as const;

// Test Helper Class
class SSETestHelpers {
  static createReceiveEventPayload(
    chatId: string,
    endUserId: string,
    clientName: string,
    options: any = {},
  ) {
    return {
      chatId,
      endUserId,
      clientName,
      ...options,
    };
  }

  static async sendReceiveEvent(
    app: any,
    payload: any,
    expectedStatus: number = ERROR_STATUS.CREATED,
    authorization: string | undefined = `Bearer ${JWT_SECRET}`,
  ) {
    const httpRequest = request(app.getHttpServer()).post(SSE_ENDPOINTS.RECEIVE).send(payload);

    if (authorization !== undefined) {
      httpRequest.set('Authorization', authorization);
    }

    return httpRequest.expect(expectedStatus);
  }

  static validateSuccessResponse(response: any) {
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBeDefined();
  }
}

describe('Chat SSE and Events (E2E)', () => {
  let context: ChatTestContext;

  beforeAll(async () => {
    const baseContext = await getSharedChatTestApp();
    context = await setupChatTests(baseContext, 'chat_sse');
  });

  beforeEach(async () => {
    const updated = await setupChatTests(context, 'chat_sse');
    Object.assign(context, updated);
  });

  afterEach(async () => {
    await context.cleaner.cleanChatTestData(context.tenantSchemaNames);
  });

  afterAll(async () => {
    await cleanupSharedChatTestApp();
  });

  describe('SSE (Server-Sent Events)', () => {
    describe('authentication', () => {
      it('should deny SSE connection for unauthenticated user', (done) => {
        request(context.app.getHttpServer())
          .get(SSE_ENDPOINTS.EVENTS)
          .expect(ERROR_STATUS.UNAUTHORIZED)
          .end((err) => {
            if (err) return done(err);
            done();
          });
      });

      it('should deny SSE connection with invalid token', (done) => {
        request(context.app.getHttpServer())
          .get(SSE_ENDPOINTS.EVENTS)
          .set('Authorization', 'Bearer invalid-token')
          .expect(ERROR_STATUS.UNAUTHORIZED)
          .end((err) => {
            if (err) return done(err);
            done();
          });
      });
    });

    describe('Chat Event Receive (SSE broadcast)', () => {
      let endUser: any;
      let testChat: any;

      beforeEach(async () => {
        endUser = await context.factory.createEndUser(context.org1.name);
        testChat = await context.factory.createChat(context.org1.name, endUser.userId);
      });

      describe('successful event broadcasting', () => {
        it('should reject receive event when authorization header is missing', async () => {
          await SSETestHelpers.sendReceiveEvent(
            context.app,
            SSETestHelpers.createReceiveEventPayload(
              testChat.id,
              endUser.userId,
              context.org1.name,
            ),
            ERROR_STATUS.UNAUTHORIZED,
            undefined,
          );
        });

        it('should reject receive event when token is invalid', async () => {
          await SSETestHelpers.sendReceiveEvent(
            context.app,
            SSETestHelpers.createReceiveEventPayload(
              testChat.id,
              endUser.userId,
              context.org1.name,
            ),
            ERROR_STATUS.UNAUTHORIZED,
            'Bearer invalid-token',
          );
        });

        it('should reject receive event when bearer token is empty', async () => {
          await SSETestHelpers.sendReceiveEvent(
            context.app,
            SSETestHelpers.createReceiveEventPayload(
              testChat.id,
              endUser.userId,
              context.org1.name,
            ),
            ERROR_STATUS.UNAUTHORIZED,
            'Bearer ',
          );
        });

        it('should trigger SSE event broadcast when chat event is received', async () => {
          const response = await SSETestHelpers.sendReceiveEvent(
            context.app,
            SSETestHelpers.createReceiveEventPayload(
              testChat.id,
              endUser.userId,
              context.org1.name,
            ),
          );

          SSETestHelpers.validateSuccessResponse(response);
        });

        it('should handle event for chat with assigned user', async () => {
          const assignedChat = await context.factory.createChat(context.org1.name, endUser.userId, {
            assignedUserId: context.operatorUser.id,
          });

          const response = await SSETestHelpers.sendReceiveEvent(
            context.app,
            SSETestHelpers.createReceiveEventPayload(
              assignedChat.id,
              endUser.userId,
              context.org1.name,
            ),
          );

          expect(response.body.success).toBe(true);
        });
      });

      describe('auto-reply message handling', () => {
        it('should handle auto-reply message flag', async () => {
          const testMessage = await context.factory.createChatMessage(
            testChat.id,
            context.operatorUser.id,
          );

          const response = await SSETestHelpers.sendReceiveEvent(
            context.app,
            SSETestHelpers.createReceiveEventPayload(
              testChat.id,
              endUser.userId,
              context.org1.name,
              {
                isAutoReplyMessage: true,
                messageId: testMessage.id,
              },
            ),
          );

          expect(response.body.success).toBe(true);
        });

        it('should handle close chat flag in auto-reply', async () => {
          const testMessage = await context.factory.createChatMessage(
            testChat.id,
            context.operatorUser.id,
          );

          const response = await SSETestHelpers.sendReceiveEvent(
            context.app,
            SSETestHelpers.createReceiveEventPayload(
              testChat.id,
              endUser.userId,
              context.org1.name,
              {
                isAutoReplyMessage: true,
                messageId: testMessage.id,
                closeChat: true,
              },
            ),
          );

          expect(response.body.success).toBe(true);
        });

        it('should handle event with invalid message ID in auto-reply', async () => {
          const response = await SSETestHelpers.sendReceiveEvent(
            context.app,
            SSETestHelpers.createReceiveEventPayload(
              testChat.id,
              endUser.userId,
              context.org1.name,
              {
                isAutoReplyMessage: true,
                messageId: 'invalid-message-id',
              },
            ),
          );

          expect(response.body.success).toBe(true);
        });
      });

      describe('concurrent operations', () => {
        it('should handle rapid event receive calls', async () => {
          const requests = [];
          for (let i = 0; i < 5; i++) {
            requests.push(
              SSETestHelpers.sendReceiveEvent(
                context.app,
                SSETestHelpers.createReceiveEventPayload(
                  testChat.id,
                  endUser.userId,
                  context.org1.name,
                ),
              ),
            );
          }

          const responses = await Promise.all(requests);
          expect(responses.length).toBe(5);
          responses.forEach((res) => {
            expect(res.body.success).toBe(true);
          });
        });
      });

      describe('validation', () => {
        it('should handle event without chatId', async () => {
          await request(context.app.getHttpServer())
            .post(SSE_ENDPOINTS.RECEIVE)
            .set('Authorization', `Bearer ${JWT_SECRET}`)
            .send({ endUserId: endUser.userId })
            .expect(ERROR_STATUS.BAD_REQUEST);
        });
      });
    });
  });
});
