import { hkdfSync, randomUUID } from 'crypto';

import { Pool } from 'pg';

import { ATTRIBUTE_QUERIES } from '../../fixtures/graphql/attribute.queries';
import { CHAT_QUERIES } from '../../fixtures/graphql/chat.queries';

import {
  ChatTestContext,
  getSharedChatTestApp,
  cleanupSharedChatTestApp,
  setupChatTests,
} from './chat-test.setup';

/**
 * Zero-maintenance encryption rollover scenarios. Each test pins one property
 * of the deploy lifecycle — read PR #1006 (#1007 for context) for the design.
 *
 * Coverage:
 *  A — new BFF reads pre-deploy plaintext-only rows (fallback path)
 *  C — mixed-state chat (pre-deploy + post-deploy rows in same chat) round-trips
 *  D — simulated backfill UPDATE leaves plaintext intact + read still works
 *  E — old BFF read path (raw content::text) keeps working on post-deploy rows
 *  F — chatAttributeValue conditional encryption per isEncryptionEnabled
 *
 * Out of scope here (tracked separately):
 *  B — new BFF write → new BFF read dual-write (covered by chat.encryption-dual-write.e2e-spec.ts)
 *  G — mark_message_as_unsent (lives in backend-core/app/services/receiver/repository/chat_message.py;
 *      triggered by a LINE webhook into chat-core, not a BFF GraphQL mutation; belongs in pytest)
 */

const APPLICATION_SALT = Buffer.from('ligla-chat-encryption-v1');

function deriveOrgKey(orgId: string): string {
  const masterKeyBase64 = process.env.ENCRYPTION_MASTER_KEY;
  if (!masterKeyBase64) {
    throw new Error('ENCRYPTION_MASTER_KEY must be set in the test environment');
  }
  const masterKey = Buffer.from(masterKeyBase64, 'base64');
  const derived = hkdfSync('sha256', masterKey, APPLICATION_SALT, Buffer.from(orgId, 'utf-8'), 32);
  return Buffer.from(derived).toString('base64');
}

describe('Encryption Rollover Scenarios (E2E)', () => {
  let context: ChatTestContext;
  let pool: Pool;

  beforeAll(async () => {
    const baseContext = await getSharedChatTestApp();
    context = await setupChatTests(baseContext, 'encryption_rollover');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  beforeEach(async () => {
    const updated = await setupChatTests(context, 'encryption_rollover');
    Object.assign(context, updated);
  });

  afterEach(async () => {
    await context.cleaner.cleanChatTestData(context.tenantSchemaNames);
  });

  afterAll(async () => {
    await pool.end();
    await cleanupSharedChatTestApp();
  });

  /**
   * Insert a chatMessage directly via raw SQL, populating ONLY the plaintext
   * `content` column. Simulates a row written by pre-deploy BFF code that
   * doesn't know about `contentEncrypted` / `isEncrypted`.
   */
  async function insertPreDeployMessage(
    tenantSchema: string,
    chatId: string,
    text: string,
    senderId: string,
  ): Promise<string> {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO "${tenantSchema}"."chatMessage"
         (id, "chatId", "senderId", "senderType", type, content, "isEncrypted", "isDelivered")
       VALUES ($1::uuid, $2::uuid, $3, 'END_USER', 'TEXT', $4::jsonb, false, true)`,
      [id, chatId, senderId, JSON.stringify({ text })],
    );
    return id;
  }

  /**
   * Insert a chatMessage in dual-written (post-deploy) state via raw SQL:
   * plaintext in `content`, pgp_sym_encrypt bytes in `contentEncrypted`,
   * `isEncrypted=true`. Bypasses the BFF mutation so we control `isDelivered`
   * and don't have to set up team membership for chatHistory visibility.
   */
  async function insertPostDeployMessage(
    tenantSchema: string,
    orgId: string,
    chatId: string,
    text: string,
    senderId: string,
  ): Promise<string> {
    const id = randomUUID();
    const orgKey = deriveOrgKey(orgId);
    const client = await pool.connect();
    try {
      await client.query("SELECT set_config('app.organizationKey', $1, false)", [orgKey]);
      await client.query(
        `INSERT INTO "${tenantSchema}"."chatMessage"
           (id, "chatId", "senderId", "senderType", type,
            content, "contentEncrypted", "isEncrypted", "isDelivered")
         VALUES ($1::uuid, $2::uuid, $3, 'OPERATOR', 'TEXT',
                 $4::jsonb,
                 pgp_sym_encrypt($4::text, current_setting('app.organizationKey', true), 's2k-mode=0'),
                 true, true)`,
        [id, chatId, senderId, JSON.stringify({ text })],
      );
    } finally {
      client.release();
    }
    return id;
  }

  /**
   * Replicate one batch of the production backfill (jobs/tenant_manager/operations/encryption.py)
   * against a tenant schema: SET app.organizationKey, then UPDATE rows where
   * isEncrypted = false to populate `contentEncrypted` from `content::text`.
   *
   * Plaintext column is NEVER touched — invariant the production backfill also holds.
   */
  async function simulateBackfill(tenantSchema: string, orgId: string): Promise<void> {
    const orgKey = deriveOrgKey(orgId);
    const client = await pool.connect();
    try {
      await client.query("SELECT set_config('app.organizationKey', $1, false)", [orgKey]);
      await client.query(
        `UPDATE "${tenantSchema}"."chatMessage"
            SET "contentEncrypted" = pgp_sym_encrypt(
                  content::text,
                  current_setting('app.organizationKey', true),
                  's2k-mode=0'
                ),
                "isEncrypted" = true
          WHERE "isEncrypted" = false`,
      );
    } finally {
      client.release();
    }
  }

  // ---------------------------------------------------------------------------
  // A — new BFF reads pre-deploy plaintext-only rows (fallback path)
  // ---------------------------------------------------------------------------
  it('A: new BFF reads pre-deploy plaintext-only row via fallback', async () => {
    const endUser = await context.factory.createEndUser(context.org1.name);
    const chat = await context.factory.createChat(context.org1.name, endUser.userId, {
      chatStatus: 'ADDRESSING',
      assignedUserId: context.operatorUser.id,
    });

    const tenantSchema = context.tenantSchemaNames[0];
    const legacyText = 'Legacy plaintext from before encryption deploy';
    await insertPreDeployMessage(tenantSchema, chat.id, legacyText, endUser.userId);

    // Sanity-check the inserted row really is pre-deploy state.
    const rawCheck = await pool.query(
      `SELECT "contentEncrypted", "isEncrypted"
         FROM "${tenantSchema}"."chatMessage" WHERE "chatId" = $1::uuid`,
      [chat.id],
    );
    expect(rawCheck.rows[0].contentEncrypted).toBeNull();
    expect(rawCheck.rows[0].isEncrypted).toBe(false);

    // New BFF read MUST fall back to content::text and return the readable string.
    // adminToken bypasses team-membership checks in chatHistory (operator-role
    // readers require explicit team setup; orthogonal to the read-path contract
    // being tested here).
    const response = await context.client.queryExpectSuccess(
      CHAT_QUERIES.GET_CHAT_HISTORY,
      { id: chat.id },
      context.adminToken,
    );
    // BFF's resolver extracts `.text` from the dict and returns the bare string.
    const messages = response.chatHistory.chatMessages as Array<{ content: string }>;
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe(legacyText);
  });

  // ---------------------------------------------------------------------------
  // C — mixed-state chat: pre-deploy and post-deploy rows coexist + both readable
  // ---------------------------------------------------------------------------
  it('C: mixed-state chat returns both pre-deploy and post-deploy messages', async () => {
    const endUser = await context.factory.createEndUser(context.org1.name);
    const chat = await context.factory.createChat(context.org1.name, endUser.userId, {
      chatStatus: 'ADDRESSING',
      assignedUserId: context.operatorUser.id,
    });
    const tenantSchema = context.tenantSchemaNames[0];

    const preDeployText = 'Legacy message from before deploy';
    await insertPreDeployMessage(tenantSchema, chat.id, preDeployText, endUser.userId);

    const postDeployText = 'New message via dual-write';
    await insertPostDeployMessage(
      tenantSchema,
      context.org1.id,
      chat.id,
      postDeployText,
      context.operatorUser.id,
    );

    // Confirm DB state genuinely is mixed: one row with NULL encrypted, one with bytes.
    const dbState = await pool.query(
      `SELECT "isEncrypted", "contentEncrypted" IS NOT NULL AS has_encrypted
         FROM "${tenantSchema}"."chatMessage"
        WHERE "chatId" = $1::uuid
        ORDER BY "createdAt"`,
      [chat.id],
    );
    expect(dbState.rows).toHaveLength(2);
    expect(dbState.rows[0]).toEqual({ isEncrypted: false, has_encrypted: false });
    expect(dbState.rows[1]).toEqual({ isEncrypted: true, has_encrypted: true });

    // chatHistory's chatMessages field returns the LATEST message only (MESSAGE_LIMIT=1)
    // for the chat-list preview. The mixed-state property we pin here is:
    //   1. The chat query succeeds (no decrypt error on either row state)
    //   2. The latest message (post-deploy) is correctly decrypted
    //   3. Both DB rows still exist after the query — query didn't drop the pre-deploy row
    const response = await context.client.queryExpectSuccess(
      CHAT_QUERIES.GET_CHAT_HISTORY,
      { id: chat.id },
      context.adminToken,
    );
    expect(response.chatHistory).not.toBeNull();
    const latest = response.chatHistory.chatMessages[0] as { content: string };
    expect(latest.content).toBe(postDeployText);

    const afterQuery = await pool.query(
      `SELECT COUNT(*) AS n FROM "${tenantSchema}"."chatMessage" WHERE "chatId" = $1::uuid`,
      [chat.id],
    );
    expect(Number(afterQuery.rows[0].n)).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // D — simulated backfill leaves plaintext intact + read returns same text
  // ---------------------------------------------------------------------------
  it('D: backfill encrypts pre-deploy row without mutating plaintext; read unchanged', async () => {
    const endUser = await context.factory.createEndUser(context.org1.name);
    const chat = await context.factory.createChat(context.org1.name, endUser.userId, {
      chatStatus: 'ADDRESSING',
      assignedUserId: context.operatorUser.id,
    });
    const tenantSchema = context.tenantSchemaNames[0];

    const originalText = 'Plaintext that should survive backfill';
    await insertPreDeployMessage(tenantSchema, chat.id, originalText, endUser.userId);

    // Capture plaintext BEFORE backfill.
    const before = await pool.query(
      `SELECT content::text AS content_text
         FROM "${tenantSchema}"."chatMessage" WHERE "chatId" = $1::uuid`,
      [chat.id],
    );
    const plaintextBefore = before.rows[0].content_text;

    // Run the production backfill SQL.
    await simulateBackfill(tenantSchema, context.org1.id);

    // Plaintext column MUST be byte-identical. Encrypted column MUST be populated.
    const after = await pool.query(
      `SELECT content::text AS content_text,
              "contentEncrypted" IS NOT NULL AS has_encrypted,
              "isEncrypted"
         FROM "${tenantSchema}"."chatMessage" WHERE "chatId" = $1::uuid`,
      [chat.id],
    );
    expect(after.rows[0].content_text).toBe(plaintextBefore);
    expect(after.rows[0].has_encrypted).toBe(true);
    expect(after.rows[0].isEncrypted).toBe(true);

    // GraphQL read uses the encrypted branch now → must decrypt back to same text.
    const response = await context.client.queryExpectSuccess(
      CHAT_QUERIES.GET_CHAT_HISTORY,
      { id: chat.id },
      context.adminToken,
    );
    const messages = response.chatHistory.chatMessages as Array<{ content: string }>;
    expect(messages[0].content).toBe(originalText);
  });

  // ---------------------------------------------------------------------------
  // E — old BFF read path simulation: post-deploy row stays readable as JSONB
  // ---------------------------------------------------------------------------
  it('E: post-deploy row is still parseable as JSONB (old BFF code path safe)', async () => {
    const endUser = await context.factory.createEndUser(context.org1.name);
    const chat = await context.factory.createChat(context.org1.name, endUser.userId, {
      chatStatus: 'ADDRESSING',
      assignedUserId: context.operatorUser.id,
    });
    const tenantSchema = context.tenantSchemaNames[0];

    const messageText = 'Message visible to old BFF instances during rollover';
    await context.client.queryExpectSuccess(
      CHAT_QUERIES.SEND_MESSAGE,
      {
        chatMessageInput: {
          chatId: chat.id,
          message: { type: 'TEXT', text: messageText },
        },
      },
      context.operatorToken,
    );

    // Old BFF code reads `content` as JSONB. If it tried to read on this row,
    // the column must still parse as JSON and contain the text — i.e. the
    // dual-write didn't break the App Engine Flex rollover compatibility.
    const oldReadSimulation = await pool.query(
      `SELECT content, jsonb_typeof(content) AS content_kind, content->>'text' AS text_field
         FROM "${tenantSchema}"."chatMessage" WHERE "chatId" = $1::uuid`,
      [chat.id],
    );
    expect(oldReadSimulation.rows[0].content_kind).toBe('object');
    expect(oldReadSimulation.rows[0].text_field).toBe(messageText);
  });

  // ---------------------------------------------------------------------------
  // F — chatAttributeValue conditional encryption per isEncryptionEnabled
  // ---------------------------------------------------------------------------
  it('F: chatAttributeValue dual-writes always; isEncrypted flag tracks attribute.isEncryptionEnabled', async () => {
    const endUser = await context.factory.createEndUser(context.org1.name);
    const chat = await context.factory.createChat(context.org1.name, endUser.userId, {
      chatStatus: 'ADDRESSING',
      assignedUserId: context.operatorUser.id,
    });
    const tenantSchema = context.tenantSchemaNames[0];

    // Unique suffix prevents name collisions across re-runs that didn't fully
    // clean the attribute table (factory cleanup focuses on chat-side state).
    const suffix = randomUUID().slice(0, 4); // attribute.name has maxLength=20
    const encAttr = await context.client.queryExpectSuccess(
      ATTRIBUTE_QUERIES.CREATE_ATTRIBUTE,
      {
        createAttributeInput: {
          name: `enc-${suffix}`,
          type: 'string',
          isEncryptionEnabled: true,
        },
      },
      context.adminToken,
    );
    const plainAttr = await context.client.queryExpectSuccess(
      ATTRIBUTE_QUERIES.CREATE_ATTRIBUTE,
      {
        createAttributeInput: {
          name: `plain-${suffix}`,
          type: 'string',
          isEncryptionEnabled: false,
        },
      },
      context.adminToken,
    );

    const encValue = 'secret-value';
    const plainValue = 'public-value';
    await context.client.queryExpectSuccess(
      ATTRIBUTE_QUERIES.FILL_CHAT_ATTRIBUTE_VALUE,
      {
        createChatAttributeValueInput: {
          chatId: chat.id,
          attributeId: encAttr.createAttribute.id,
          value: encValue,
        },
      },
      context.operatorToken,
    );
    await context.client.queryExpectSuccess(
      ATTRIBUTE_QUERIES.FILL_CHAT_ATTRIBUTE_VALUE,
      {
        createChatAttributeValueInput: {
          chatId: chat.id,
          attributeId: plainAttr.createAttribute.id,
          value: plainValue,
        },
      },
      context.operatorToken,
    );

    const rows = await pool.query(
      `SELECT v."attributeId",
              v.value::text AS value_text,
              v."valueEncrypted" IS NOT NULL AS has_encrypted,
              v."isEncrypted",
              a.name AS attr_name
         FROM "${tenantSchema}"."chatAttributeValue" v
         JOIN "${tenantSchema}".attribute a ON a.id = v."attributeId"
        WHERE v."chatId" = $1::uuid
        ORDER BY a.name`,
      [chat.id],
    );
    expect(rows.rows).toHaveLength(2);

    const enc = rows.rows.find((r) => r.attr_name === `enc-${suffix}`);
    expect(enc).toBeDefined();
    expect(enc.value_text).toBe(encValue);
    expect(enc.has_encrypted).toBe(true);
    expect(enc.isEncrypted).toBe(true);

    const plain = rows.rows.find((r) => r.attr_name === `plain-${suffix}`);
    expect(plain).toBeDefined();
    expect(plain.value_text).toBe(plainValue);
    // Dual-write contract: valueEncrypted is populated even when encryption is
    // disabled — the trigger writes UTF-8 bytes via convert_to(value, 'UTF8')
    // and the isEncrypted flag (not the column nullability) records whether
    // the bytes are ciphertext or plaintext.
    expect(plain.has_encrypted).toBe(true);
    expect(plain.isEncrypted).toBe(false);
  });
});
