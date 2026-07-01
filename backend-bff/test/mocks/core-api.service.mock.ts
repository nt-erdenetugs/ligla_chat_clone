import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { Pool } from 'pg';

@Injectable()
export class MockCoreApiService implements OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  private buildSchemaName(organizationId: string): string {
    const normalized = organizationId.replace(/-/g, '').toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(normalized)) {
      throw new Error(`Invalid organization id for schema provisioning: ${organizationId}`);
    }

    return `org_${normalized}`;
  }

  async provisionSchema(
    organizationId: string,
    _hypervisorUserId: string,
    _organizationApiKey: string,
  ): Promise<{
    success: boolean;
    tableCount: number;
    alreadyExisted: boolean;
  }> {
    const schemaName = this.buildSchemaName(organizationId);

    const schemaExistsResult = await this.pool.query(
      'SELECT 1 FROM information_schema.schemata WHERE schema_name = $1 LIMIT 1',
      [schemaName],
    );
    const alreadyExisted = schemaExistsResult.rowCount > 0;

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

    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS "${schemaName}".alembic_version (version_num varchar(32) PRIMARY KEY)`,
    );
    await this.pool.query(
      `INSERT INTO "${schemaName}".alembic_version (version_num)
       VALUES ('test_head')
       ON CONFLICT (version_num) DO NOTHING`,
    );

    const tableCountResult = await this.pool.query(
      'SELECT COUNT(*)::int AS table_count FROM information_schema.tables WHERE table_schema = $1',
      [schemaName],
    );

    return {
      success: true,
      tableCount: tableCountResult.rows[0]?.table_count ?? 0,
      alreadyExisted,
    };
  }

  async deprovisionSchema(
    organizationId: string,
    _hypervisorUserId: string,
    _organizationApiKey: string,
  ): Promise<void> {
    const schemaName = this.buildSchemaName(organizationId);
    await this.pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
