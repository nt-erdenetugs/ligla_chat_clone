import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { v4 as uuid } from 'uuid';

export class TestDataFactory {
  private pool: Pool;
  private ensuredSchemas = new Set<string>();
  private tableExistCache = new Map<string, boolean>();
  private attributeOrganizationMap = new Map<string, string>();
  private teamOrganizationMap = new Map<string, string>();
  private chatOrganizationMap = new Map<string, string>();
  private chatMessageOrganizationMap = new Map<string, string>();

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  private buildSchemaName(organizationId: string) {
    return `org_${organizationId.replace(/-/g, '').toLowerCase()}`;
  }

  private assertSchemaName(schemaName: string) {
    if (!/^org_[a-f0-9]{32}$/.test(schemaName)) {
      throw new Error(`Invalid tenant schema name: ${schemaName}`);
    }
  }

  private async tableExists(schemaName: string, tableName: string) {
    const cacheKey = `${schemaName}.${tableName}`;
    const cached = this.tableExistCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const result = await this.pool.query(
      'SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2',
      [schemaName, tableName],
    );
    const exists = Boolean(result.rowCount);
    this.tableExistCache.set(cacheKey, exists);
    return exists;
  }

  async schemaExists(schemaName: string) {
    const result = await this.pool.query(
      'SELECT 1 FROM information_schema.schemata WHERE schema_name = $1',
      [schemaName],
    );
    return Boolean(result.rowCount);
  }

  async tableExistsInSchema(schemaName: string, tableName: string) {
    return this.tableExists(schemaName, tableName);
  }

  private async getOrganizationId(organizationName: string) {
    const result = await this.pool.query('SELECT id FROM organization WHERE name = $1', [
      organizationName,
    ]);
    const organizationId = result.rows[0]?.id;
    if (!organizationId) {
      throw new Error(`Organization ${organizationName} not found`);
    }
    return organizationId;
  }

  private async ensureTenantSchema(schemaName: string) {
    if (this.ensuredSchemas.has(schemaName)) {
      return;
    }

    this.assertSchemaName(schemaName);

    const existingSchema = await this.pool.query(
      'SELECT 1 FROM information_schema.schemata WHERE schema_name = $1',
      [schemaName],
    );

    if (existingSchema.rowCount) {
      const existingTable = await this.pool.query(
        'SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2',
        [schemaName, 'attribute'],
      );

      if (existingTable.rowCount) {
        await this.ensureTenantAlembicVersion(schemaName);
        await this.ensureTenantChatColumns(schemaName);
        this.ensuredSchemas.add(schemaName);
        return;
      }
    }

    await this.pool.query(`
      DO $$
      DECLARE
        target_schema text := '${schemaName}';
        table_record record;
      BEGIN
        EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', target_schema);

        FOR table_record IN
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'tenant_template'
        LOOP
          EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I.%I (LIKE tenant_template.%I INCLUDING DEFAULTS INCLUDING IDENTITY INCLUDING INDEXES)',
            target_schema,
            table_record.table_name,
            table_record.table_name
          );
        END LOOP;
      END $$;
    `);

    await this.ensureTenantAlembicVersion(schemaName);
    await this.ensureTenantChatColumns(schemaName);
    this.ensuredSchemas.add(schemaName);
  }

  private async ensureTenantAlembicVersion(schemaName: string) {
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS "${schemaName}".alembic_version (version_num varchar(32) PRIMARY KEY)`,
    );
    await this.pool.query(`TRUNCATE "${schemaName}".alembic_version`);
    await this.pool.query(
      `INSERT INTO "${schemaName}".alembic_version (version_num)
       VALUES ('test_head')`,
    );
  }

  private async ensureTenantChatColumns(schemaName: string) {
    const hasChatTable = await this.tableExists(schemaName, 'chat');
    if (!hasChatTable) {
      return;
    }

    await this.pool.query(
      `ALTER TABLE "${schemaName}".chat
       ADD COLUMN IF NOT EXISTS "isManuallyAssigned" boolean NOT NULL DEFAULT false,
       ADD COLUMN IF NOT EXISTS "latestMessageTimestamp" timestamptz DEFAULT NOW(),
       ADD COLUMN IF NOT EXISTS "latestActivityAt" timestamptz,
       ADD COLUMN IF NOT EXISTS "latestReadTimestamp" timestamptz DEFAULT NOW(),
       ADD COLUMN IF NOT EXISTS "clientUserId" varchar(255)`,
    );
  }

  private async getTenantSchemaName(organizationName: string) {
    const organizationId = await this.getOrganizationId(organizationName);
    const schemaName = this.buildSchemaName(organizationId);
    await this.ensureTenantSchema(schemaName);
    return schemaName;
  }

  private async resolveChatOrganizationName(chatId: string) {
    const mapped = this.chatOrganizationMap.get(chatId);
    if (mapped) {
      return mapped;
    }

    const organizations = await this.pool.query('SELECT id, name FROM organization');
    for (const organization of organizations.rows) {
      const schemaName = this.buildSchemaName(organization.id);
      if (!(await this.schemaExists(schemaName))) {
        continue;
      }
      const hasTenantChat = await this.tableExists(schemaName, 'chat');
      if (!hasTenantChat) {
        continue;
      }

      const chatResult = await this.pool.query(
        `SELECT 1 FROM "${schemaName}".chat WHERE id = $1::uuid`,
        [chatId],
      );
      if (chatResult.rowCount) {
        this.chatOrganizationMap.set(chatId, organization.name);
        return organization.name as string;
      }
    }

    return null;
  }

  async getTenantSchemaNameForOrganization(organizationName: string) {
    return this.getTenantSchemaName(organizationName);
  }

  private async getTenantSchemaNameByAttributeId(attributeId: string) {
    const cachedOrganizationName = this.attributeOrganizationMap.get(attributeId);
    if (cachedOrganizationName) {
      return this.getTenantSchemaName(cachedOrganizationName);
    }
    const organizations = await this.pool.query('SELECT id, name FROM organization');
    for (const organization of organizations.rows) {
      const schemaName = this.buildSchemaName(organization.id);
      if (!(await this.schemaExists(schemaName))) {
        continue;
      }
      const hasTenantAttribute = await this.tableExists(schemaName, 'attribute');
      if (!hasTenantAttribute) {
        continue;
      }

      const attributeResult = await this.pool.query(
        `SELECT 1 FROM "${schemaName}".attribute WHERE id = $1::uuid`,
        [attributeId],
      );
      if (attributeResult.rowCount) {
        this.attributeOrganizationMap.set(attributeId, organization.name);
        return this.getTenantSchemaName(organization.name);
      }
    }

    throw new Error(`Attribute ${attributeId} not found in tenant schemas`);
  }

  // Organization factory
  async createOrganization(overrides?: Partial<any> & { skipSchemaCreation?: boolean }) {
    const { skipSchemaCreation, ...organizationOverrides } = overrides || {};
    const data = {
      id: uuid(),
      name: `test_org_${uuid().substring(0, 8)}`,
      displayName: 'Test Organization',
      description: null,
      maxOperator: 10,
      loginLiffId: `test_loginLiff_${uuid().substring(0, 8)}`,
      fileUploadLiffId: `test_fileUploadLiff_${uuid().substring(0, 8)}`,
      apiKey: '',
      isActive: true,
      ...organizationOverrides,
    };

    const existing = await this.pool.query('SELECT * FROM organization WHERE name = $1', [
      data.name,
    ]);
    const existingOrg = existing.rows[0];
    if (existingOrg) {
      const schemaName = this.buildSchemaName(existingOrg.id);
      if (!skipSchemaCreation) {
        await this.ensureTenantSchema(schemaName);
      }
      return { ...existingOrg, schemaName };
    }

    const result = await this.pool.query(
      `INSERT INTO organization (id, name, "displayName", description, "maxOperator", "loginLiffId", "fileUploadLiffId", "apiKey", "isActive", "createdAt")
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (name) DO UPDATE SET
         "displayName" = EXCLUDED."displayName",
         description = EXCLUDED.description,
         "maxOperator" = EXCLUDED."maxOperator",
         "loginLiffId" = EXCLUDED."loginLiffId",
         "fileUploadLiffId" = EXCLUDED."fileUploadLiffId",
         "apiKey" = EXCLUDED."apiKey",
         "isActive" = EXCLUDED."isActive",
         "updatedAt" = NOW()
       RETURNING *`,
      [
        data.id,
        data.name,
        data.displayName,
        data.description,
        data.maxOperator,
        data.loginLiffId,
        data.fileUploadLiffId,
        data.apiKey,
        data.isActive,
      ],
    );
    const organization = result.rows[0];
    const organizationId = organization.id;
    const schemaName = this.buildSchemaName(organizationId);
    if (!skipSchemaCreation) {
      await this.ensureTenantSchema(schemaName);
    }

    return { ...organization, schemaName };
  }

  // User factory
  async createUser(organizationName: string, role: any, overrides?: Partial<any>) {
    const resolvedOrganizationName =
      typeof organizationName === 'string' ? organizationName : organizationName?.name;
    if (!resolvedOrganizationName) {
      throw new Error('Organization name is required to create user');
    }
    const hashedPassword = await bcrypt.hash('Test@123', 10);
    const { organizationName: _ignoredOrganizationName, ...safeOverrides } = overrides || {};
    const data = {
      id: uuid(),
      email: `test_${uuid().substring(0, 8)}@test.com`,
      displayName: `Test ${role}`,
      senderName: null as string | null,
      hashedPassword,
      roleType: role,
      status: 'ACTIVE',
      pictureUrl: '',
      loginAttempts: 0,
      ...safeOverrides,
    };

    if (data.email) {
      data.email = data.email.toLowerCase();
    }

    const existingAuth = await this.pool.query('SELECT * FROM "auth" WHERE email = $1 LIMIT 1', [
      data.email,
    ]);
    if (existingAuth.rowCount) {
      const authRow = existingAuth.rows[0];
      const schemaName = await this.getTenantSchemaName(authRow.organizationName);
      const tenantUser = await this.pool
        .query(`SELECT * FROM "${schemaName}"."user" WHERE id = $1::uuid LIMIT 1`, [authRow.id])
        .then((rows) => rows.rows?.[0]);

      return {
        ...(tenantUser || {}),
        id: authRow.id,
        email: authRow.email,
        hashedPassword: authRow.hashedPassword,
        organizationName: authRow.organizationName,
      };
    }

    // First, insert into auth table
    await this.pool.query(
      `INSERT INTO "auth" (id, "organizationName", email, "hashedPassword", status, "loginAttempts", "createdAt")
       VALUES ($1::uuid, $2, $3, $4, $5::"userstatus", $6, NOW())`,
      [
        data.id,
        resolvedOrganizationName,
        data.email,
        data.hashedPassword,
        data.status,
        data.loginAttempts,
      ],
    );

    const schemaName = await this.getTenantSchemaName(resolvedOrganizationName);
    const tenantInsert = await this.pool.query(
      `INSERT INTO "${schemaName}"."user" (id, "displayName", "senderName", "roleType", "pictureUrl", "createdAt")
       VALUES ($1::uuid, $2, $3, $4, $5, NOW())
       ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
       RETURNING *`,
      [data.id, data.displayName, data.senderName ?? null, data.roleType, data.pictureUrl],
    );

    return {
      ...tenantInsert.rows[0],
      email: data.email,
      hashedPassword: data.hashedPassword,
      organizationName: resolvedOrganizationName,
    };
  }

  async findUserByEmail(email: string) {
    const normalizedEmail = email.toLowerCase();
    const authResult = await this.pool.query(`SELECT * FROM "auth" WHERE email = $1 LIMIT 1`, [
      normalizedEmail,
    ]);
    const authRow = authResult.rows[0];
    if (!authRow) {
      return null;
    }

    if (authRow.organizationName) {
      const schemaName = await this.getTenantSchemaName(authRow.organizationName);
      const tenantUserResult = await this.pool.query(
        `SELECT * FROM "${schemaName}"."user" WHERE id = $1::uuid`,
        [authRow.id],
      );
      const tenantUser = tenantUserResult.rows[0];
      if (tenantUser) {
        return {
          ...tenantUser,
          email: authRow.email,
          hashedPassword: authRow.hashedPassword,
          status: authRow.status,
          organizationName: authRow.organizationName,
          roleType: tenantUser.roleType,
        };
      }
    }

    return {
      id: authRow.id,
      email: authRow.email,
      hashedPassword: authRow.hashedPassword,
      status: authRow.status,
      organizationName: authRow.organizationName,
    };
  }

  // Attribute factory
  async createAttribute(organizationName: string, overrides?: Partial<any>) {
    const { organizationName: _ignoredOrganizationName, ...safeOverrides } = overrides || {};
    const data = {
      id: uuid(),
      name: `Test Attribute ${uuid().substring(0, 8)}`,
      type: 'string',
      isActive: true,
      isEncryptionEnabled: false,
      ...safeOverrides,
    };

    const schemaName = await this.getTenantSchemaName(organizationName);
    const tenantInsert = await this.pool.query(
      `INSERT INTO "${schemaName}".attribute
       (id, name, type, "isActive", "isEncryptionEnabled", "createdAt", "updatedAt")
       VALUES ($1::uuid, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
       RETURNING *`,
      [data.id, data.name, data.type, data.isActive, data.isEncryptionEnabled],
    );
    this.attributeOrganizationMap.set(data.id, organizationName);

    return tenantInsert.rows[0];
  }

  // SelectOption factory
  async createSelectOption(attributeId: string, overrides?: Partial<any>) {
    const data = {
      id: uuid(),
      attributeId,
      value: `Option ${uuid().substring(0, 8)}`,
      label: null,
      ...overrides,
    };

    const schemaName = await this.getTenantSchemaNameByAttributeId(attributeId);
    await this.pool.query(
      `INSERT INTO "${schemaName}"."selectOption" (id, "attributeId", value, label, "createdAt", "updatedAt")
       VALUES ($1::uuid, $2::uuid, $3, $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id`,
      [data.id, data.attributeId, data.value, data.label],
    );
    return data;
  }

  // Chat factory (for attribute value tests)
  async createChat(
    organizationName: string,
    endUserIdOrOverrides?: string | Partial<any>,
    overrides?: Partial<any>,
  ) {
    // Handle both signatures: (org, endUserId, overrides) and (org, overrides)
    let endUserId: string;
    let options: Partial<any>;

    if (typeof endUserIdOrOverrides === 'string') {
      endUserId = endUserIdOrOverrides;
      options = overrides || {};
    } else {
      // Create an endUser if not provided
      const endUser = await this.createEndUser();
      endUserId = endUser.userId;
      options = endUserIdOrOverrides || {};
    }

    const { organizationName: _ignoredOrganizationNameInOptions, ...sanitizedOptions } =
      options || {};
    const data = {
      id: uuid(),
      endUserId,
      clientUserId: `client_${uuid().substring(0, 8)}`,
      chatStatus: 'PENDING',
      isUserBlocked: false,
      assignedUserId: null,
      ...sanitizedOptions,
    };

    const schemaName = await this.getTenantSchemaName(organizationName);
    await this.pool.query(
      `INSERT INTO "${schemaName}"."endUser" ("userId", "displayName", "pictureUrl", "createdAt")
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT ("userId") DO NOTHING`,
      [data.endUserId, 'Test End User', ''],
    );

    const chatInsert = await this.pool.query(
      `INSERT INTO "${schemaName}".chat
       (id, "endUserId", "clientUserId", "chatStatus", "isUserBlocked", "assignedUserId", "createdAt", "latestMessageTimestamp", "latestReadTimestamp")
        VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid, NOW(), NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
       RETURNING *`,
      [
        data.id,
        data.endUserId,
        data.clientUserId,
        data.chatStatus,
        data.isUserBlocked,
        data.assignedUserId,
      ],
    );
    this.chatOrganizationMap.set(data.id, organizationName);
    return chatInsert.rows?.[0] ?? data;
  }

  async assignUserToChat(chatId: string, userId: string) {
    const organizationName = this.chatOrganizationMap.get(chatId);
    if (!organizationName) {
      throw new Error(`Organization not found for chat ${chatId}`);
    }

    const schemaName = await this.getTenantSchemaName(organizationName);
    await this.pool.query(
      `UPDATE "${schemaName}".chat SET "assignedUserId" = $1::uuid WHERE id = $2::uuid`,
      [userId, chatId],
    );
  }

  // EndUser factory
  async createEndUser(
    organizationNameOrOverrides?: string | Partial<any>,
    overrides?: Partial<any>,
  ) {
    // Handle both signatures: (organizationName, overrides) and (overrides)
    let organizationName: string | undefined;
    let options: Partial<any>;

    if (typeof organizationNameOrOverrides === 'string') {
      organizationName = organizationNameOrOverrides;
      options = overrides || {};
    } else {
      options = organizationNameOrOverrides || {};
    }

    const data = {
      userId: `U${uuid().replace(/-/g, '').substring(0, 32)}`,
      displayName: 'Test End User',
      pictureUrl: '',
      ...options,
    };

    // If organizationName provided, insert into tenant schema
    if (organizationName) {
      const schemaName = await this.getTenantSchemaName(organizationName);
      const result = await this.pool.query(
        `INSERT INTO "${schemaName}"."endUser" ("userId", "displayName", "pictureUrl", "createdAt")
         VALUES ($1, $2, $3, NOW())
         RETURNING *`,
        [data.userId, data.displayName, data.pictureUrl],
      );
      return result.rows[0];
    }

    return { ...data, createdAt: new Date() };
  }

  // Tag factory
  async createTag(organizationName: string, overrides?: Partial<any>) {
    const { organizationName: _ignoredOrganizationName, ...safeOverrides } = overrides || {};
    const data = {
      id: uuid(),
      name: `Test Tag ${uuid().substring(0, 8)}`,
      isActive: true,
      ...safeOverrides,
    };

    const schemaName = await this.getTenantSchemaName(organizationName);
    const tenantInsert = await this.pool.query(
      `INSERT INTO "${schemaName}"."tags" (id, name, "isActive", "createdAt")
       VALUES ($1::uuid, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
       RETURNING *`,
      [data.id, data.name, data.isActive],
    );

    return tenantInsert.rows[0];
  }

  // Link tag to chat
  async linkTagToChat(chatId: string, tagId: string) {
    const id = uuid();
    const organizationName = await this.resolveChatOrganizationName(chatId);

    if (organizationName) {
      const schemaName = await this.getTenantSchemaName(organizationName);
      const result = await this.pool.query(
        `INSERT INTO "${schemaName}"."chatTags" (id, "chatId", "tagId", "createdAt")
         VALUES ($1::uuid, $2::uuid, $3::uuid, NOW())
         RETURNING *`,
        [id, chatId, tagId],
      );
      return result.rows[0];
    }
    throw new Error(`Organization not found for chat ${chatId}`);
  }

  // Hypervisor user factory
  async createHypervisorUser(overrides?: Partial<any>) {
    const hashedPassword = await bcrypt.hash('Test@123', 10);
    const data = {
      id: uuid(),
      email: `hypervisor_${uuid().substring(0, 8)}@test.com`,
      hashedPassword,
      ...overrides,
    };

    // Normalize email to lowercase to match application behavior
    if (data.email) {
      data.email = data.email.toLowerCase();
    }

    const existing = await this.pool.query(
      'SELECT * FROM "hypervisorUser" WHERE email = $1 LIMIT 1',
      [data.email],
    );
    if (existing.rowCount) {
      return existing.rows[0];
    }

    const result = await this.pool.query(
      `INSERT INTO "hypervisorUser" (id, email, "hashedPassword", "createdAt")
       VALUES ($1::uuid, $2, $3, NOW())
       RETURNING *`,
      [data.id, data.email, data.hashedPassword],
    );
    return result.rows[0];
  }

  // ChatMessage factory
  async createChatMessage(chatId: string, senderId: string, overrides?: Partial<any>) {
    const data = {
      id: uuid(),
      chatId,
      senderId,
      senderType: 'OPERATOR',
      type: 'TEXT',
      content: { text: 'Test message' },
      isDelivered: true,
      createdAt: new Date(),
      ...overrides,
    };

    const createdAtValue = data.createdAt || new Date();
    const organizationName = await this.resolveChatOrganizationName(chatId);

    if (organizationName) {
      const schemaName = await this.getTenantSchemaName(organizationName);
      const result = await this.pool.query(
        `INSERT INTO "${schemaName}"."chatMessage" (id, "chatId", "senderId", "senderType", type, content, "isDelivered", "createdAt")
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, $7, $8)
         RETURNING *`,
        [
          data.id,
          data.chatId,
          data.senderId,
          data.senderType,
          data.type,
          data.content,
          data.isDelivered,
          createdAtValue,
        ],
      );

      // Keep chat.latestMessageTimestamp in sync (mirrors production behavior)
      await this.pool.query(
        `UPDATE "${schemaName}".chat
         SET "latestMessageTimestamp" = GREATEST("latestMessageTimestamp", $2)
         WHERE id = $1::uuid`,
        [data.chatId, createdAtValue],
      );

      this.chatMessageOrganizationMap.set(data.id, organizationName);
      return result.rows[0];
    }
    throw new Error(`Organization not found for chat ${chatId}`);
  }

  // Get user by id (for verification)
  async getUserById(userId: string) {
    const authResult = await this.pool.query(
      `SELECT a.*, a.email, a."hashedPassword", a.status, a."loginAttempts"
       FROM "auth" a
       WHERE a.id = $1::uuid`,
      [userId],
    );
    const authRow = authResult.rows.length > 0 ? authResult.rows[0] : null;

    let user = null;
    if (authRow?.organizationName) {
      const schemaName = await this.getTenantSchemaName(authRow.organizationName);
      const tenantUserResult = await this.pool.query(
        `SELECT * FROM "${schemaName}"."user" WHERE id = $1::uuid`,
        [userId],
      );
      if (tenantUserResult.rows.length > 0) {
        user = {
          ...tenantUserResult.rows[0],
          email: authRow.email,
          hashedPassword: authRow.hashedPassword,
          status: authRow.status,
          loginAttempts: authRow.loginAttempts,
          organizationName: authRow.organizationName,
        };
      }
    }

    if (!user) return null;

    let userTeamRows: any[] = [];
    if (user?.organizationName) {
      const schemaName = await this.getTenantSchemaName(user.organizationName);
      const hasTenantUserTeam = await this.tableExists(schemaName, 'userTeam');
      if (hasTenantUserTeam) {
        const userTeamResult = await this.pool.query(
          `SELECT * FROM "${schemaName}"."userTeam" WHERE "userId" = $1::uuid`,
          [userId],
        );
        userTeamRows = userTeamResult.rows;
      }
    }

    user.userTeam = userTeamRows;
    return user;
  }

  // Get hypervisor user by id (for verification)
  async getHypervisorUserById(userId: string) {
    const result = await this.pool.query(`SELECT * FROM "hypervisorUser" WHERE id = $1::uuid`, [
      userId,
    ]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  // Update user updatedAt (for testing time-based scenarios)
  async updateUserUpdatedAt(userId: string, updatedAt: Date) {
    const authResult = await this.pool.query(
      `SELECT "organizationName" FROM "auth" WHERE id = $1::uuid`,
      [userId],
    );
    const organizationName = authResult.rows[0]?.organizationName;
    if (organizationName) {
      const schemaName = await this.getTenantSchemaName(organizationName);
      await this.pool.query(
        `UPDATE "${schemaName}"."user" SET "updatedAt" = $1 WHERE id = $2::uuid`,
        [updatedAt, userId],
      );
    }
    await this.pool.query(`UPDATE "auth" SET "updatedAt" = $1 WHERE id = $2::uuid`, [
      updatedAt,
      userId,
    ]);
  }

  // Update user password (for testing password reset)
  async updateUserPassword(userId: string, hashedPassword: string) {
    await this.pool.query(`UPDATE "auth" SET "hashedPassword" = $1 WHERE id = $2::uuid`, [
      hashedPassword,
      userId,
    ]);
  }

  // Update user status (for testing status changes)
  async updateUserStatus(userId: string, status: string) {
    await this.pool.query(`UPDATE "auth" SET "status" = $1::"userstatus" WHERE id = $2::uuid`, [
      status,
      userId,
    ]);
  }

  // Get password reset token by user ID
  async getPasswordResetToken(userId: string) {
    const result = await this.pool.query(
      `SELECT * FROM "userPasswordResetToken" WHERE "userId" = $1::uuid`,
      [userId],
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  // Expire password reset token
  async expirePasswordResetToken(userId: string) {
    const expiresAt = new Date(Date.now() - 1000);
    await this.pool.query(
      `UPDATE "userPasswordResetToken" SET "expiresAt" = $1 WHERE "userId" = $2::uuid`,
      [expiresAt, userId],
    );
  }

  // Delete password reset token (for cleanup)
  async deletePasswordResetToken(userId: string) {
    await this.pool.query(`DELETE FROM "userPasswordResetToken" WHERE "userId" = $1::uuid`, [
      userId,
    ]);
  }

  // Get chat message by id (for verification)
  async getChatMessageById(messageId: string) {
    const mappedOrganizationName = this.chatMessageOrganizationMap.get(messageId);
    if (mappedOrganizationName) {
      const schemaName = await this.getTenantSchemaName(mappedOrganizationName);
      const tenantResult = await this.pool.query(
        `SELECT * FROM "${schemaName}"."chatMessage" WHERE id = $1::uuid`,
        [messageId],
      );
      return tenantResult.rows.length > 0 ? tenantResult.rows[0] : null;
    }
    return null;
  }

  // ChatNote factory
  async createChatNote(
    chatId: string,
    userId: string,
    organizationName: string,
    overrides?: Partial<any>,
  ) {
    const { organizationName: _ignoredOrganizationName, ...safeOverrides } = overrides || {};
    const data = {
      id: uuid(),
      chatId,
      userId,
      noteValue: `Test note ${uuid().substring(0, 8)}`,
      isActive: true,
      ...safeOverrides,
    };

    const schemaName = await this.getTenantSchemaName(organizationName);
    const tenantInsert = await this.pool.query(
      `INSERT INTO "${schemaName}".note (id, "chatId", "userId", "noteValue", "isActive", "createdAt")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::text, $5, NOW())
       RETURNING *`,
      [data.id, data.chatId, data.userId, data.noteValue, data.isActive],
    );

    return tenantInsert.rows[0];
  }

  // Team factory
  async createTeam(organizationName: string, overrides?: Partial<any>) {
    const { organizationName: _ignoredOrganizationName, ...safeOverrides } = overrides || {};
    const data = {
      id: uuid(),
      name: `Test Team ${uuid().substring(0, 8)}`,
      isActive: true,
      isDefault: false,
      ...safeOverrides,
    };

    const schemaName = await this.getTenantSchemaName(organizationName);
    const tenantInsert = await this.pool.query(
      `INSERT INTO "${schemaName}".team (id, name, "isActive", "isDefault", "createdAt")
       VALUES ($1::uuid, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
       RETURNING *`,
      [data.id, data.name, data.isActive, data.isDefault],
    );

    this.teamOrganizationMap.set(data.id, organizationName);
    return tenantInsert.rows[0];
  }

  // Add user to team
  async addUserToTeam(teamId: string, userId: string) {
    const organizationName = this.teamOrganizationMap.get(teamId);
    if (!organizationName) {
      throw new Error(`Organization not found for team ${teamId}`);
    }

    const schemaName = await this.getTenantSchemaName(organizationName);
    const tenantInsert = await this.pool.query(
      `INSERT INTO "${schemaName}"."userTeam" ("teamId", "userId", "createdAt")
       VALUES ($1::uuid, $2::uuid, NOW())
       ON CONFLICT ("teamId", "userId") DO UPDATE SET "teamId" = EXCLUDED."teamId"
       RETURNING *`,
      [teamId, userId],
    );
    return tenantInsert.rows[0];
  }

  // Create team chat setting
  async createTeamChatSetting(teamId: string, viewAllChatsEnabled: boolean = true) {
    const organizationName = this.teamOrganizationMap.get(teamId);
    if (!organizationName) {
      throw new Error(`Organization not found for team ${teamId}`);
    }

    const schemaName = await this.getTenantSchemaName(organizationName);

    // First, ensure teamSetting exists
    const teamSettingResult = await this.pool.query(
      `INSERT INTO "${schemaName}"."teamSetting" (id, "teamId", "createdAt")
       VALUES (gen_random_uuid(), $1::uuid, NOW())
       ON CONFLICT ("teamId") DO UPDATE SET "teamId" = $1::uuid
       RETURNING id`,
      [teamId],
    );
    const teamSettingId = teamSettingResult.rows[0].id;

    // Then create or update teamChatSetting
    const tenantResult = await this.pool.query(
      `INSERT INTO "${schemaName}"."teamChatSetting" (id, "teamSettingId", "viewAllChatsEnabled", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1::uuid, $2, NOW(), NOW())
       ON CONFLICT ("teamSettingId") DO UPDATE
       SET "viewAllChatsEnabled" = $2, "updatedAt" = NOW()
       RETURNING *`,
      [teamSettingId, viewAllChatsEnabled],
    );

    return tenantResult.rows[0];
  }

  // Update chat properties
  async updateChat(chatId: string, data: any) {
    const updates: string[] = [];
    const values: any[] = [chatId];
    let paramIndex = 2;

    if (data.latestReadTimestamp !== undefined) {
      updates.push(`"latestReadTimestamp" = $${paramIndex}`);
      values.push(data.latestReadTimestamp);
      paramIndex++;
    }
    if (data.chatStatus !== undefined) {
      updates.push(`"chatStatus" = $${paramIndex}::"chatStatus"`);
      values.push(data.chatStatus);
      paramIndex++;
    }

    if (updates.length === 0) return null;

    const organizationName = await this.resolveChatOrganizationName(chatId);
    const schemaName = await this.getTenantSchemaName(organizationName);
    const result = await this.pool.query(
      `UPDATE "${schemaName}".chat SET ${updates.join(', ')} WHERE id = $1::uuid RETURNING *`,
      values,
    );
    return result.rows[0];
  }

  // Get chat by ID
  async getChat(chatId: string) {
    const organizationName = await this.resolveChatOrganizationName(chatId);
    const schemaName = await this.getTenantSchemaName(organizationName);
    const result = await this.pool.query(`SELECT * FROM "${schemaName}".chat WHERE id = $1::uuid`, [
      chatId,
    ]);
    if (result.rows[0]) {
      return result.rows[0];
    }
    return null;
  }

  // Assign team to chat
  async assignTeamToChat(chatId: string, teamId: string) {
    const id = uuid();
    const organizationName =
      this.chatOrganizationMap.get(chatId) || this.teamOrganizationMap.get(teamId);
    if (!organizationName) {
      throw new Error(`Organization not found for chat ${chatId}`);
    }

    const schemaName = await this.getTenantSchemaName(organizationName);
    const tenantInsert = await this.pool.query(
      `INSERT INTO "${schemaName}"."chatTeamAssignment" (id, "chatId", "teamId", "createdAt")
       VALUES ($1::uuid, $2::uuid, $3::uuid, NOW())
       ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
       RETURNING *`,
      [id, chatId, teamId],
    );
    return tenantInsert.rows[0];
  }

  async countChatTeamAssignments(chatId: string, teamId?: string): Promise<number> {
    const organizationName = await this.resolveChatOrganizationName(chatId);
    const schemaName = await this.getTenantSchemaName(organizationName);

    if (teamId) {
      const result = await this.pool.query(
        `SELECT COUNT(*)::int AS count FROM "${schemaName}"."chatTeamAssignment" WHERE "chatId" = $1::uuid AND "teamId" = $2::uuid`,
        [chatId, teamId],
      );
      return result.rows[0]?.count ?? 0;
    }

    const result = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM "${schemaName}"."chatTeamAssignment" WHERE "chatId" = $1::uuid`,
      [chatId],
    );

    return result.rows[0]?.count ?? 0;
  }

  // Store factory
  async createStore(organizationName: string, overrides?: Partial<any>) {
    const { organizationName: _ignoredOrganizationName, ...safeOverrides } = overrides || {};
    const data = {
      id: uuid(),
      name: `Test Store ${uuid().substring(0, 8)}`,
      isActive: true,
      liglaStoreId: Math.floor(Math.random() * 1000000),
      areaName: null,
      typeName: null,
      note: null,
      startsAt: null,
      endsAt: null,
      ...safeOverrides,
    };

    const schemaName = await this.getTenantSchemaName(organizationName);
    const tenantInsert = await this.pool.query(
      `INSERT INTO "${schemaName}"."store" (
        id, name, "isActive", "liglaStoreId",
        "areaName", "typeName", note, "startsAt", "endsAt", "createdAt"
      )
      VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::timestamp, $9::timestamp, NOW())
      ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
      RETURNING *`,
      [
        data.id,
        data.name,
        data.isActive,
        data.liglaStoreId,
        data.areaName,
        data.typeName,
        data.note,
        data.startsAt,
        data.endsAt,
      ],
    );

    return tenantInsert.rows[0];
  }

  // Assign store to team
  async assignStoreToTeam(storeId: string, teamId: string) {
    const id = uuid();
    const organizationName = this.teamOrganizationMap.get(teamId);
    if (!organizationName) {
      throw new Error(`Organization not found for team ${teamId}`);
    }

    const schemaName = await this.getTenantSchemaName(organizationName);
    const tenantInsert = await this.pool.query(
      `INSERT INTO "${schemaName}"."storeTeam" (id, "storeId", "teamId", "createdAt")
       VALUES ($1::uuid, $2::uuid, $3::uuid, NOW())
       ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
       RETURNING *`,
      [id, storeId, teamId],
    );
    return tenantInsert.rows[0];
  }

  // Chat Reply Message Template factory
  async createChatReplyMessageTemplate(organizationName: string, overrides?: Partial<any>) {
    const schemaName = await this.getTenantSchemaName(organizationName);
    const data = {
      id: uuid(),
      type: 'TEXT',
      content: JSON.stringify({ text: 'Test auto reply message' }),
      contentUrl: null,
      previewImageUrl: null,
      updatedBy: null,
      ...overrides,
    };

    const result = await this.pool.query(
      `INSERT INTO "${schemaName}"."chatReplyMessageTemplate" (id, type, content, "contentUrl", "previewImageUrl", "updatedBy", "createdAt", "updatedAt")
       VALUES ($1::uuid, $2, $3::jsonb, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [data.id, data.type, data.content, data.contentUrl, data.previewImageUrl, data.updatedBy],
    );
    return result.rows[0];
  }

  // Chat Reply Setting factory
  // Note: The following methods are deprecated - chatReplySettings now stored in organizationSettings
  // Kept for backward compatibility but should not be used in new tests

  /**
   * Creates a complete chat reply setting in organizationSettings table.
   * This is the NEW implementation that stores settings as JSON in organizationSettings.
   */
  async createCompleteChatReplySetting(organizationName: string, updatedBy?: string) {
    const schemaName = await this.getTenantSchemaName(organizationName);
    // 1. Create message templates
    const activeTimeTemplate = await this.createChatReplyMessageTemplate(organizationName, {
      content: JSON.stringify({ text: 'We are currently available. We will respond shortly.' }),
      updatedBy,
    });

    const defaultTemplate = await this.createChatReplyMessageTemplate(organizationName, {
      content: JSON.stringify({
        text: 'We are currently offline. We will respond during business hours.',
      }),
      updatedBy,
    });

    // 2. Build JSON structure
    const jsonSettings = {
      isActive: true,
      updatedBy,
      schedules: [
        {
          scheduleType: 'MONDAY',
          timeRanges: [
            { startTime: '09:00', endTime: '12:00', timeRangeType: 'ACTIVE_TIME' },
            { startTime: '13:00', endTime: '18:00', timeRangeType: 'ACTIVE_TIME' },
          ],
          customDates: [],
        },
      ],
      messages: [
        { timeRangeType: 'ACTIVE_TIME', templateId: activeTimeTemplate.id },
        { timeRangeType: 'DEFAULT', templateId: defaultTemplate.id },
      ],
    };

    // 3. Insert into organizationSettings
    await this.pool.query(
      `INSERT INTO "${schemaName}"."organizationSettings"
       ("type", "chatReplySettings", "createdAt")
       VALUES ('chatReply', $1::jsonb, NOW())
       ON CONFLICT ("type")
       DO UPDATE SET "chatReplySettings" = EXCLUDED."chatReplySettings"
       RETURNING *`,
      [JSON.stringify(jsonSettings)],
    );

    const organizationId = await this.getOrganizationId(organizationName);

    return {
      id: `${organizationId}:chatReply`,
      ...jsonSettings,
    };
  }

  async createChatReplySettingWithTemplates(
    organizationName: string,
    templateIds: string[],
    updatedBy?: string,
  ) {
    const schemaName = await this.getTenantSchemaName(organizationName);
    const jsonSettings = {
      isActive: true,
      updatedBy: updatedBy ?? null,
      schedules: [
        {
          scheduleType: 'MONDAY',
          timeRanges: [{ startTime: '09:00', endTime: '18:00', timeRangeType: 'ACTIVE_TIME' }],
          customDates: [],
        },
      ],
      messages: templateIds.map((templateId, index) => ({
        timeRangeType: index === 0 ? 'ACTIVE_TIME' : 'DEFAULT',
        templateId,
      })),
    };

    await this.pool.query(
      `INSERT INTO "${schemaName}"."organizationSettings"
       ("type", "chatReplySettings", "createdAt")
       VALUES ('chatReply', $1::jsonb, NOW())
       ON CONFLICT ("type")
       DO UPDATE SET "chatReplySettings" = EXCLUDED."chatReplySettings"
       RETURNING *`,
      [JSON.stringify(jsonSettings)],
    );

    const organizationId = await this.getOrganizationId(organizationName);

    return {
      id: `${organizationId}:chatReply`,
      ...jsonSettings,
    };
  }

  // Member Feed Data factory
  async createMemberFeedData(
    organizationName: string,
    clientUserId: string,
    overrides?: Partial<any>,
  ) {
    const schemaName = await this.getTenantSchemaName(organizationName);

    // Prepare data
    const data = {
      clientUserId,
      category1: null,
      category2: null,
      number1: null,
      number2: null,
      datetime1: null,
      datetime2: null,
      ...overrides,
    };

    // Set search path to tenant schema
    await this.pool.query(`SET search_path TO "${schemaName}", public`);

    try {
      // Insert data into tenant schema's memberFeedData table
      const result = await this.pool.query(
        `INSERT INTO "${schemaName}"."memberFeedData" (
          "clientUserId",
          "category1", "category2",
          "number1", "number2",
          "datetime1", "datetime2",
          "createdAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *`,
        [
          data.clientUserId,
          data.category1,
          data.category2,
          data.number1,
          data.number2,
          data.datetime1,
          data.datetime2,
        ],
      );

      return result.rows[0];
    } finally {
      // Reset search path to public schema
      await this.pool.query('SET search_path TO public');
    }
  }

  // Survey Data factory
  async createSurveyData(organizationName: string, endUserId: string, overrides?: Partial<any>) {
    // Survey data is stored as JSON in the userSurvey column
    const userSurvey = {
      category1: null,
      category2: null,
      category3: null,
      category4: null,
      category5: null,
      number1: null,
      number2: null,
      number3: null,
      datetime1: null,
      datetime2: null,
      ...overrides,
    };

    const schemaName = await this.getTenantSchemaName(organizationName);
    const result = await this.pool.query(
      `INSERT INTO "${schemaName}"."surveyData" (
        "endUserId",
        "clientUserId",
        "userSurvey",
        "createdAt"
      )
      VALUES ($1, $2, $3::jsonb, NOW())
      ON CONFLICT ("endUserId")
      DO UPDATE SET
        "userSurvey" = EXCLUDED."userSurvey",
        "updatedAt" = NOW()
      RETURNING *`,
      [endUserId, null, JSON.stringify(userSurvey)],
    );
    return result.rows[0];
  }

  async cleanup() {
    await this.pool.end();
  }
}
