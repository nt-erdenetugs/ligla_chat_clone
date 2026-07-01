import { DrizzleDB } from '@/drizzle';
import { TenantTables } from '@@/drizzle/tenant/schema';

import { OrgSeedData } from './data';

export const createTeams = async (
  db: DrizzleDB,
  tenantTables: TenantTables,
  orgData: OrgSeedData,
) => {
  console.debug(`Creating teams for ${orgData.orgName}...`);

  for (const teamData of orgData.teams) {
    await db
      .insert(tenantTables.team)
      .values({
        id: teamData.id,
        name: teamData.name,
        isDefault: teamData.isDefault,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  }

  return await db.select().from(tenantTables.team);
};
