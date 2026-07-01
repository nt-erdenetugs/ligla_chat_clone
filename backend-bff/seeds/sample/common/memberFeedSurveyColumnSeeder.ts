import { eq } from 'drizzle-orm';

import { DrizzleDB } from '@/drizzle';
import { TenantTables } from '@@/drizzle/tenant/schema';

type SeedOptions = {
  type: 'memberFeed' | 'survey';
  orgName: string;
  columns: Record<string, string>;
  name: string;
  validColumnNames: Set<string>;
};

export const seedFeedOrSurveyColumns = async (
  db: DrizzleDB,
  tenantTables: TenantTables,
  { type, orgName, columns, name, validColumnNames }: SeedOptions,
) => {
  console.debug(`Seeding columns for ${name} (${orgName})...`);

  for (const columnName of Object.keys(columns)) {
    if (!validColumnNames.has(columnName)) {
      throw new Error(
        `Invalid column name '${columnName}' in ${name}. Must be one of: ${Array.from(validColumnNames).join(', ')}`,
      );
    }
  }

  const [existing] = await db
    .select()
    .from(tenantTables.organizationSettings)
    .where(eq(tenantTables.organizationSettings.type, type))
    .limit(1);

  if (existing) {
    console.debug(`${name} already exists for ${orgName}`);
    return;
  }

  const columnSettings: Record<string, { alias: string; isEnabled: boolean }> = {};
  Object.entries(columns).forEach(([columnName, alias]) => {
    columnSettings[columnName] = { alias, isEnabled: true };
  });

  await db.insert(tenantTables.organizationSettings).values({
    type,
    memberFeedSurveyColumnSettings: columnSettings,
    createdAt: new Date(),
  } as any);

  console.debug(`Created ${name} for ${orgName}`);
};
