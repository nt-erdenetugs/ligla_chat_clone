import { Pool } from 'pg';

import { uuidToSchemaName } from '@/common/utils/tenant';

export type OrgSchema = {
  orgName: string;
  orgId: string;
  schemaName: string;
};

export async function getOrgSchemas(pool: Pool): Promise<OrgSchema[]> {
  const result = await pool.query<{ name: string; id: string }>(
    'SELECT name, id FROM public.organization ORDER BY name',
  );

  return result.rows.map((row) => ({
    orgName: row.name,
    orgId: row.id,
    schemaName: uuidToSchemaName(row.id),
  }));
}
