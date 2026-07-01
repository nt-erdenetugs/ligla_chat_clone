import { Pool } from 'pg';

export class DatabaseCleaner {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  private async tableExists(schemaName: string, tableName: string) {
    const result = await this.pool.query(
      'SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2',
      [schemaName, tableName],
    );
    return Boolean(result.rowCount);
  }

  /**
   * Clean all test data using TRUNCATE CASCADE for better performance
   * Dynamically discovers all tables from information_schema to avoid maintenance issues
   */
  async cleanTestData() {
    // Get all user tables from public + tenant schemas
    const result = await this.pool.query<{ schemaname: string; tablename: string }>(`
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE (schemaname = 'public' OR schemaname LIKE 'org_%')
        AND tablename NOT LIKE 'pg_%'
        AND tablename NOT LIKE 'sql_%'
        AND tablename != 'alembic_version'
        AND NOT (schemaname = 'public' AND tablename = 'organization')
      ORDER BY schemaname, tablename
    `);

    const tables = result.rows.map((row) => `"${row.schemaname}"."${row.tablename}"`);

    if (tables.length === 0) {
      return; // No tables to clean
    }

    // Use TRUNCATE CASCADE to:
    // 1. Clear all data faster than DELETE
    // 2. Reclaim disk space immediately
    // 3. Reset auto-increment sequences (RESTART IDENTITY)
    // 4. Handle foreign key constraints automatically (CASCADE)
    // All in a single network round-trip
    await this.pool.query(`
      TRUNCATE TABLE ${tables.join(', ')}
      RESTART IDENTITY
      CASCADE
    `);
  }

  async cleanAttributeTestData(schemaNames: string[] | undefined) {
    const publicTables = [
      'attribute',
      'selectOption',
      'chatAttributeValue',
      'chatAttributeValueSelectOption',
      'chat',
      'endUser',
    ];

    const tenantTables = [
      'attribute',
      'selectOption',
      'chatAttributeValue',
      'chatAttributeValueSelectOption',
      'chat',
      'endUser',
    ];

    const tables: string[] = [];

    publicTables.forEach((table) => tables.push(`"public"."${table}"`));

    schemaNames?.forEach((schemaName) => {
      tenantTables.forEach((table) => tables.push(`"${schemaName}"."${table}"`));
    });

    if (!tables.length) {
      return;
    }

    const schemas = ['public', ...(schemaNames || [])];
    const existing = await this.pool.query<{ schemaname: string; tablename: string }>(
      `
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname = ANY ($1)
    `,
      [schemas],
    );

    const existingSet = new Set(existing.rows.map((row) => `${row.schemaname}.${row.tablename}`));
    const existingTables = tables.filter((table) => {
      const normalized = table.replace(/"/g, '').replace('.', '.');
      const [schema, name] = normalized.split('.');
      return existingSet.has(`${schema}.${name}`);
    });

    if (!existingTables.length) {
      return;
    }

    await this.pool.query(`
      TRUNCATE TABLE ${existingTables.join(', ')}
      RESTART IDENTITY
      CASCADE
    `);
  }

  async cleanAuthTestData(schemaNames: string[] | undefined) {
    const publicTables = ['auth', 'user', 'userPasswordResetToken', 'hypervisorUser'];

    const tenantTables = ['user', 'userTeam'];

    const tables: string[] = [];

    publicTables.forEach((table) => tables.push(`"public"."${table}"`));

    (schemaNames || []).forEach((schemaName) => {
      tenantTables.forEach((table) => tables.push(`"${schemaName}"."${table}"`));
    });

    if (!tables.length) {
      return;
    }

    const schemas = ['public', ...(schemaNames || [])];
    const existing = await this.pool.query<{ schemaname: string; tablename: string }>(
      `
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname = ANY ($1)
    `,
      [schemas],
    );

    const existingSet = new Set(existing.rows.map((row) => `${row.schemaname}.${row.tablename}`));
    const existingTables = tables.filter((table) => {
      const normalized = table.replace(/"/g, '').replace('.', '.');
      const [schema, name] = normalized.split('.');
      return existingSet.has(`${schema}.${name}`);
    });

    if (!existingTables.length) {
      return;
    }

    await this.pool.query(`
      TRUNCATE TABLE ${existingTables.join(', ')}
      RESTART IDENTITY
      CASCADE
    `);
  }

  async cleanChatAssignmentTestData(schemaNames: string[] | undefined) {
    const publicTables = [
      'team',
      'userTeam',
      'teamSetting',
      'teamChatSetting',
      'chatTeamAssignment',
      'chatActivity',
      'chat',
      'endUser',
    ];

    const tenantTables = [...publicTables];

    const tables: string[] = [];

    publicTables.forEach((table) => tables.push(`"public"."${table}"`));

    (schemaNames || []).forEach((schemaName) => {
      tenantTables.forEach((table) => tables.push(`"${schemaName}"."${table}"`));
    });

    if (!tables.length) {
      return;
    }

    const schemas = ['public', ...(schemaNames || [])];
    const existing = await this.pool.query<{ schemaname: string; tablename: string }>(
      `
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname = ANY ($1)
    `,
      [schemas],
    );

    const existingSet = new Set(existing.rows.map((row) => `${row.schemaname}.${row.tablename}`));
    const existingTables = tables.filter((table) => {
      const normalized = table.replace(/"/g, '').replace('.', '.');
      const [schema, name] = normalized.split('.');
      return existingSet.has(`${schema}.${name}`);
    });

    if (!existingTables.length) {
      return;
    }

    await this.pool.query(`
      TRUNCATE TABLE ${existingTables.join(', ')}
      RESTART IDENTITY
      CASCADE
    `);
  }

  async cleanTeamTestData(schemaNames: string[] | undefined) {
    const publicTables = [
      'team',
      'userTeam',
      'teamSetting',
      'teamChatSetting',
      'store',
      'storeTeam',
      'chatTeamAssignment',
      'chatActivity',
      'chat',
      'endUser',
    ];

    const tenantTables = [...publicTables];
    const tables: string[] = [];

    publicTables.forEach((table) => tables.push(`"public"."${table}"`));

    (schemaNames || []).forEach((schemaName) => {
      tenantTables.forEach((table) => tables.push(`"${schemaName}"."${table}"`));
    });

    if (!tables.length) {
      return;
    }

    const schemas = ['public', ...(schemaNames || [])];
    const existing = await this.pool.query<{ schemaname: string; tablename: string }>(
      `
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname = ANY ($1)
    `,
      [schemas],
    );

    const existingSet = new Set(existing.rows.map((row) => `${row.schemaname}.${row.tablename}`));
    const existingTables = tables.filter((table) => {
      const normalized = table.replace(/"/g, '').replace('.', '.');
      const [schema, name] = normalized.split('.');
      return existingSet.has(`${schema}.${name}`);
    });

    if (!existingTables.length) {
      return;
    }

    await this.pool.query(`
      TRUNCATE TABLE ${existingTables.join(', ')}
      RESTART IDENTITY
      CASCADE
    `);
  }

  async cleanChatReplyTestData(schemaNames: string[] | undefined) {
    const tenantTables = ['organizationSettings', 'chatReplyMessageTemplate'];
    const tables: string[] = [];

    (schemaNames || []).forEach((schemaName) => {
      tenantTables.forEach((table) => tables.push(`"${schemaName}"."${table}"`));
    });

    if (!tables.length) {
      return;
    }

    const schemas = [...(schemaNames || [])];
    const existing = await this.pool.query<{ schemaname: string; tablename: string }>(
      `
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname = ANY ($1)
    `,
      [schemas],
    );

    const existingSet = new Set(existing.rows.map((row) => `${row.schemaname}.${row.tablename}`));
    const existingTables = tables.filter((table) => {
      const normalized = table.replace(/"/g, '').replace('.', '.');
      const [schema, name] = normalized.split('.');
      return existingSet.has(`${schema}.${name}`);
    });

    if (!existingTables.length) {
      return;
    }

    await this.pool.query(`
      TRUNCATE TABLE ${existingTables.join(', ')}
      RESTART IDENTITY
      CASCADE
    `);
  }

  async cleanMemberFeedTestData(schemaNames: string[] | undefined) {
    const publicTables = ['memberFeedData', 'organizationSettings', 'endUser'];
    const tenantTables = ['memberFeedData', 'organizationSettings', 'endUser'];
    const tables: string[] = [];

    publicTables.forEach((table) => tables.push(`"public"."${table}"`));

    (schemaNames || []).forEach((schemaName) => {
      tenantTables.forEach((table) => tables.push(`"${schemaName}"."${table}"`));
    });

    if (!tables.length) {
      return;
    }

    const schemas = ['public', ...(schemaNames || [])];
    const existing = await this.pool.query<{ schemaname: string; tablename: string }>(
      `
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname = ANY ($1)
    `,
      [schemas],
    );

    const existingSet = new Set(existing.rows.map((row) => `${row.schemaname}.${row.tablename}`));
    const existingTables = tables.filter((table) => {
      const normalized = table.replace(/"/g, '').replace('.', '.');
      const [schema, name] = normalized.split('.');
      return existingSet.has(`${schema}.${name}`);
    });

    if (!existingTables.length) {
      return;
    }

    await this.pool.query(`
      TRUNCATE TABLE ${existingTables.join(', ')}
      RESTART IDENTITY
      CASCADE
    `);
  }

  async cleanSurveyTestData(schemaNames: string[] | undefined) {
    const publicTables = ['surveyData', 'organizationSettings', 'chat', 'endUser'];
    const tenantTables = ['surveyData', 'organizationSettings', 'chat', 'endUser'];
    const tables: string[] = [];

    publicTables.forEach((table) => tables.push(`"public"."${table}"`));

    (schemaNames || []).forEach((schemaName) => {
      tenantTables.forEach((table) => tables.push(`"${schemaName}"."${table}"`));
    });

    if (!tables.length) {
      return;
    }

    const schemas = ['public', ...(schemaNames || [])];
    const existing = await this.pool.query<{ schemaname: string; tablename: string }>(
      `
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname = ANY ($1)
    `,
      [schemas],
    );

    const existingSet = new Set(existing.rows.map((row) => `${row.schemaname}.${row.tablename}`));
    const existingTables = tables.filter((table) => {
      const normalized = table.replace(/"/g, '').replace('.', '.');
      const [schema, name] = normalized.split('.');
      return existingSet.has(`${schema}.${name}`);
    });

    if (!existingTables.length) {
      return;
    }

    await this.pool.query(`
      TRUNCATE TABLE ${existingTables.join(', ')}
      RESTART IDENTITY
      CASCADE
    `);
  }

  async cleanStoreTestData(schemaNames: string[] | undefined) {
    const publicTables = ['store', 'storeTeam'];
    const tenantTables = ['store', 'storeTeam'];
    const tables: string[] = [];

    publicTables.forEach((table) => tables.push(`"public"."${table}"`));

    (schemaNames || []).forEach((schemaName) => {
      tenantTables.forEach((table) => tables.push(`"${schemaName}"."${table}"`));
    });

    if (!tables.length) {
      return;
    }

    const schemas = ['public', ...(schemaNames || [])];
    const existing = await this.pool.query<{ schemaname: string; tablename: string }>(
      `
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname = ANY ($1)
    `,
      [schemas],
    );

    const existingSet = new Set(existing.rows.map((row) => `${row.schemaname}.${row.tablename}`));
    const existingTables = tables.filter((table) => {
      const normalized = table.replace(/"/g, '').replace('.', '.');
      const [schema, name] = normalized.split('.');
      return existingSet.has(`${schema}.${name}`);
    });

    if (!existingTables.length) {
      return;
    }

    await this.pool.query(`
      TRUNCATE TABLE ${existingTables.join(', ')}
      RESTART IDENTITY
      CASCADE
    `);
  }

  async getTenantSchemas() {
    const result = await this.pool.query<{ schema_name: string }>(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'org_%'`,
    );
    return result.rows.map((row) => row.schema_name);
  }

  async cleanOrganizationTestData(
    preserveUsers: { id: string; roleType?: string; displayName?: string }[],
  ) {
    const schemas = await this.getTenantSchemas();
    await this.cleanUserTestData(schemas, preserveUsers);
  }

  async cleanOrganizationsExcept(namesToKeep: string[]) {
    const keep = namesToKeep.length ? namesToKeep : [''];
    const organizations = await this.pool.query<{ id: string; name: string }>(
      'SELECT id, name FROM organization WHERE name != ALL ($1::varchar[])',
      [keep],
    );

    for (const organization of organizations.rows) {
      const schemaName = `org_${organization.id.replace(/-/g, '').toLowerCase()}`;
      await this.pool.query('DROP SCHEMA IF EXISTS "' + schemaName + '" CASCADE');
    }

    await this.pool.query('DELETE FROM organization WHERE name != ALL ($1::varchar[])', [keep]);
  }

  async cleanNotificationsTestData(
    schemaNames: string[] | undefined,
    preserveUsers: { id: string; roleType?: string; displayName?: string }[],
  ) {
    await this.cleanUserTestData(schemaNames, preserveUsers);

    const tables: string[] = [];
    (schemaNames || []).forEach((schemaName) => {
      tables.push(`"${schemaName}"."pushSubscription"`);
    });

    if (!tables.length) {
      return;
    }

    const schemas = schemaNames || [];
    const existing = await this.pool.query<{ schemaname: string; tablename: string }>(
      `
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname = ANY ($1)
    `,
      [schemas],
    );

    const existingSet = new Set(existing.rows.map((row) => `${row.schemaname}.${row.tablename}`));
    const existingTables = tables.filter((table) => {
      const normalized = table.replace(/"/g, '').replace('.', '.');
      const [schema, name] = normalized.split('.');
      return existingSet.has(`${schema}.${name}`);
    });

    if (!existingTables.length) {
      return;
    }

    await this.pool.query(`
      TRUNCATE TABLE ${existingTables.join(', ')}
      RESTART IDENTITY
      CASCADE
    `);
  }

  async cleanOrganizationGuardTestData(
    schemaNames: string[] | undefined,
    preserveUsers: { id: string; roleType?: string; displayName?: string }[],
  ) {
    await this.cleanUserTestData(schemaNames, preserveUsers);

    const tenantTables = [
      'attribute',
      'selectOption',
      'chatAttributeValue',
      'chatAttributeValueSelectOption',
      'tags',
      'chatTags',
      'team',
      'userTeam',
      'teamSetting',
      'teamChatSetting',
      'store',
      'storeTeam',
      'chatTeamAssignment',
      'chatActivity',
      'chat',
      'endUser',
    ];

    const tables: string[] = [];
    (schemaNames || []).forEach((schemaName) => {
      tenantTables.forEach((table) => tables.push(`"${schemaName}"."${table}"`));
    });

    if (!tables.length) {
      return;
    }

    const schemas = schemaNames || [];
    const existing = await this.pool.query<{ schemaname: string; tablename: string }>(
      `
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname = ANY ($1)
    `,
      [schemas],
    );

    const existingSet = new Set(existing.rows.map((row) => `${row.schemaname}.${row.tablename}`));
    const existingTables = tables.filter((table) => {
      const normalized = table.replace(/"/g, '').replace('.', '.');
      const [schema, name] = normalized.split('.');
      return existingSet.has(`${schema}.${name}`);
    });

    if (!existingTables.length) {
      return;
    }

    await this.pool.query(`
      TRUNCATE TABLE ${existingTables.join(', ')}
      RESTART IDENTITY
      CASCADE
    `);
  }

  async cleanChatTestData(schemaNames: string[] | undefined) {
    // Chat-related tables in tenant schemas
    const tenantTables = [
      'chatMessage',
      'chatActivity',
      'chatTags',
      'chatAttributeValue',
      'chatAttributeValueSelectOption',
      'chatTeamAssignment',
      'chat',
      'endUser',
    ];

    const tables: string[] = [];
    (schemaNames || []).forEach((schemaName) => {
      tenantTables.forEach((table) => tables.push(`"${schemaName}"."${table}"`));
    });

    if (!tables.length) {
      return;
    }

    // Filter to only existing tables
    const existingTables: string[] = [];
    for (const table of tables) {
      const [schemaName, tableName] = table.replace(/"/g, '').split('.');
      if (await this.tableExists(schemaName, tableName)) {
        existingTables.push(table);
      }
    }

    if (!existingTables.length) {
      return;
    }

    await this.pool.query(`
      TRUNCATE TABLE ${existingTables.join(', ')}
      RESTART IDENTITY
      CASCADE
    `);
  }

  async cleanFileTestData(schemaNames: string[] | undefined, userIds: string[]) {
    if (!userIds.length) {
      return;
    }

    const hasPublicUser = await this.tableExists('public', 'user');
    if (hasPublicUser) {
      await this.pool.query(
        'UPDATE "public"."user" SET "pictureUrl" = NULL WHERE id = ANY ($1::uuid[])',
        [userIds],
      );
    }

    for (const schemaName of schemaNames || []) {
      const hasTenantUser = await this.tableExists(schemaName, 'user');
      if (!hasTenantUser) {
        continue;
      }

      await this.pool.query(
        `UPDATE "${schemaName}"."user" SET "pictureUrl" = NULL WHERE id = ANY ($1::uuid[])`,
        [userIds],
      );
    }
  }

  async cleanTagTestData(schemaNames: string[] | undefined) {
    const publicTables = ['tags', 'chatTags', 'chat', 'endUser'];
    const tenantTables = ['tags', 'chatTags', 'chat', 'endUser'];

    const tables: string[] = [];
    publicTables.forEach((table) => tables.push(`"public"."${table}"`));

    schemaNames?.forEach((schemaName) => {
      tenantTables.forEach((table) => tables.push(`"${schemaName}"."${table}"`));
    });

    if (!tables.length) {
      return;
    }

    const schemas = ['public', ...(schemaNames || [])];
    const existing = await this.pool.query<{ schemaname: string; tablename: string }>(
      `
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname = ANY ($1)
    `,
      [schemas],
    );

    const existingSet = new Set(existing.rows.map((row) => `${row.schemaname}.${row.tablename}`));
    const existingTables = tables.filter((table) => {
      const normalized = table.replace(/"/g, '').replace('.', '.');
      const [schema, name] = normalized.split('.');
      return existingSet.has(`${schema}.${name}`);
    });

    if (!existingTables.length) {
      return;
    }

    await this.pool.query(`
      TRUNCATE TABLE ${existingTables.join(', ')}
      RESTART IDENTITY
      CASCADE
    `);
  }

  async cleanUserTestData(
    schemaNames: string[] | undefined,
    preserveUsers?: { id: string; roleType?: string; displayName?: string }[],
  ) {
    if (preserveUsers?.length) {
      const preserveUserIds = preserveUsers.map((user) => user.id);

      const hasPasswordResetToken = await this.tableExists('public', 'userPasswordResetToken');
      if (hasPasswordResetToken) {
        await this.pool.query('TRUNCATE TABLE "userPasswordResetToken" RESTART IDENTITY CASCADE');
      }

      const hasPublicUser = await this.tableExists('public', 'user');
      if (hasPublicUser) {
        await this.pool.query('DELETE FROM "user" WHERE id != ALL ($1::uuid[])', [preserveUserIds]);
      }

      await this.pool.query('DELETE FROM "auth" WHERE id != ALL ($1::uuid[])', [preserveUserIds]);

      await this.pool.query(
        'UPDATE "auth" SET status = $1::"userstatus", "loginAttempts" = 0 WHERE id = ANY ($2::uuid[])',
        ['ACTIVE', preserveUserIds],
      );

      const roleCases = preserveUsers
        .filter((user) => user.roleType)
        .map((user) => `WHEN '${user.id}' THEN '${user.roleType}'`)
        .join(' ');
      const nameCases = preserveUsers
        .filter((user) => user.displayName)
        .map((user) => `WHEN '${user.id}' THEN '${user.displayName}'`)
        .join(' ');

      for (const schemaName of schemaNames || []) {
        const hasTenantUser = await this.tableExists(schemaName, 'user');
        if (hasTenantUser) {
          await this.pool.query(`DELETE FROM "${schemaName}"."user" WHERE id != ALL ($1::uuid[])`, [
            preserveUserIds,
          ]);

          if (roleCases) {
            await this.pool.query(
              `UPDATE "${schemaName}"."user"
               SET "roleType" = CASE id ${roleCases} ELSE "roleType" END
               WHERE id = ANY ($1::uuid[])`,
              [preserveUserIds],
            );
          }

          if (nameCases) {
            await this.pool.query(
              `UPDATE "${schemaName}"."user"
               SET "displayName" = CASE id ${nameCases} ELSE "displayName" END
               WHERE id = ANY ($1::uuid[])`,
              [preserveUserIds],
            );
          }
        }

        const hasTenantUserTeam = await this.tableExists(schemaName, 'userTeam');
        if (hasTenantUserTeam) {
          await this.pool.query(
            `DELETE FROM "${schemaName}"."userTeam" WHERE "userId" != ALL ($1::uuid[])`,
            [preserveUserIds],
          );
        }

        const chatTables = [
          'chat',
          'chatActivity',
          'chatMessage',
          'chatTags',
          'chatTeamAssignment',
          'endUser',
        ];
        const existing = await this.pool.query<{ tablename: string }>(
          `
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = $1
        `,
          [schemaName],
        );
        const existingSet = new Set(existing.rows.map((row) => row.tablename));
        const existingTables = chatTables
          .filter((table) => existingSet.has(table))
          .map((table) => `"${schemaName}"."${table}"`);

        if (existingTables.length) {
          await this.pool.query(`
            TRUNCATE TABLE ${existingTables.join(', ')}
            RESTART IDENTITY
            CASCADE
          `);
        }
      }

      return;
    }
    const publicTables = ['auth', 'user', 'passwordResetToken'];
    const tenantTables = [
      'user',
      'userTeam',
      'team',
      'teamSetting',
      'teamChatSetting',
      'chat',
      'chatTeamAssignment',
      'chatActivity',
      'endUser',
      'store',
      'storeTeam',
    ];
    const tables: string[] = [];

    publicTables.forEach((table) => tables.push(`"public"."${table}"`));

    (schemaNames || []).forEach((schemaName) => {
      tenantTables.forEach((table) => tables.push(`"${schemaName}"."${table}"`));
    });

    if (!tables.length) {
      return;
    }

    const schemas = ['public', ...(schemaNames || [])];
    const existing = await this.pool.query<{ schemaname: string; tablename: string }>(
      `
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname = ANY ($1)
    `,
      [schemas],
    );

    const existingSet = new Set(existing.rows.map((row) => `${row.schemaname}.${row.tablename}`));
    const existingTables = tables.filter((table) => {
      const normalized = table.replace(/"/g, '').replace('.', '.');
      const [schema, name] = normalized.split('.');
      return existingSet.has(`${schema}.${name}`);
    });

    if (!existingTables.length) {
      return;
    }

    await this.pool.query(`
      TRUNCATE TABLE ${existingTables.join(', ')}
      RESTART IDENTITY
      CASCADE
    `);
  }

  async cleanup() {
    await this.pool.end();
  }
}
