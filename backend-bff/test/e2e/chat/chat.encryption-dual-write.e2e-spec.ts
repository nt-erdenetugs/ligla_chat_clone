import { Pool } from 'pg';

import { CHAT_QUERIES } from '../../fixtures/graphql/chat.queries';

import {
  ChatTestContext,
  getSharedChatTestApp,
  cleanupSharedChatTestApp,
  setupChatTests,
} from './chat-test.setup';

/**
 * Pins the dual-write encryption contract for `sendMessage`:
 *   - `content` (JSONB) holds the plaintext payload   (old-BFF backward compat)
 *   - `contentEncrypted` (BYTEA) holds pgp_sym_encrypt bytes
 *   - `isEncrypted` = true
 *
 * Bypasses Drizzle to read the row exactly as Postgres stores it. The GraphQL
 * response alone cannot detect a regression where one side of the dual-write
 * is silently dropped (BFF decrypts on read, so the API response looks fine
 * even when the plaintext column is empty).
 */
describe('Chat Message Encryption Dual-Write Contract (E2E)', () => {
  let context: ChatTestContext;
  let pool: Pool;

  beforeAll(async () => {
    const baseContext = await getSharedChatTestApp();
    context = await setupChatTests(baseContext, 'encryption_dual_write');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  beforeEach(async () => {
    const updated = await setupChatTests(context, 'encryption_dual_write');
    Object.assign(context, updated);
  });

  afterEach(async () => {
    await context.cleaner.cleanChatTestData(context.tenantSchemaNames);
  });

  afterAll(async () => {
    await pool.end();
    await cleanupSharedChatTestApp();
  });

  it('sendMessage persists plaintext JSONB + encrypted BYTEA + isEncrypted=true', async () => {
    const endUser = await context.factory.createEndUser(context.org1.name);
    const testChat = await context.factory.createChat(context.org1.name, endUser.userId, {
      chatStatus: 'ADDRESSING',
    });
    await context.factory.assignUserToChat(testChat.id, context.operatorUser.id);

    const messageText = 'Hello dual-write';
    const response = await context.client.queryExpectSuccess(
      CHAT_QUERIES.SEND_MESSAGE,
      {
        chatMessageInput: {
          chatId: testChat.id,
          message: { type: 'TEXT', text: messageText },
        },
      },
      context.operatorToken,
    );

    const messageId: string = response.sendMessage.id;
    expect(messageId).toBeDefined();

    const tenantSchemaName = context.tenantSchemaNames[0];
    const rawRows = await pool.query(
      `SELECT content::text AS content_text,
              "contentEncrypted" AS encrypted,
              "isEncrypted" AS is_encrypted
         FROM "${tenantSchemaName}"."chatMessage"
        WHERE id = $1::uuid
        LIMIT 1`,
      [messageId],
    );
    expect(rawRows.rowCount).toBe(1);

    const row = rawRows.rows[0] as {
      content_text: string;
      encrypted: Buffer | null;
      is_encrypted: boolean;
    };

    // Plaintext JSONB column must still hold the readable payload (old BFF
    // builds read `content` directly and would crash if this were dropped).
    const parsedContent = JSON.parse(row.content_text);
    expect(parsedContent.text).toBe(messageText);

    // BYTEA must be a non-empty pgp_sym_encrypt blob.
    expect(row.encrypted).not.toBeNull();
    expect(Buffer.isBuffer(row.encrypted)).toBe(true);
    expect((row.encrypted as Buffer).length).toBeGreaterThan(0);

    // Flag must be true so encrypted-read paths use the decrypted column.
    expect(row.is_encrypted).toBe(true);
  });
});
