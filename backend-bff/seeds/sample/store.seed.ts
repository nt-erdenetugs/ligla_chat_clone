import { eq, and } from 'drizzle-orm';
import { v4 as generateUuid } from 'uuid';

import { DrizzleDB } from '@/drizzle';
import { TenantTables } from '@@/drizzle/tenant/schema';

import { OrgSeedData, TEAM_NAMES } from './data';

export const createStores = async (
  db: DrizzleDB,
  tenantTables: TenantTables,
  orgData: OrgSeedData,
) => {
  console.debug(`Creating stores for ${orgData.orgName}...`);

  for (const storeData of orgData.stores) {
    const [existing] = await db
      .select({ id: tenantTables.store.id })
      .from(tenantTables.store)
      .where(eq(tenantTables.store.liglaStoreId, storeData.liglaStoreId))
      .limit(1);

    if (existing) continue;

    await db.insert(tenantTables.store).values({
      id: storeData.id,
      name: storeData.name,
      liglaStoreId: storeData.liglaStoreId,
      typeName: storeData.typeName,
      areaName: storeData.areaName,
      createdAt: new Date(),
    });
  }

  return await db.select().from(tenantTables.store);
};

export const createStoreTeams = async (
  db: DrizzleDB,
  tenantTables: TenantTables,
  orgName: string,
  stores: { id: string }[],
  teams: { id: string; name: string }[],
) => {
  console.debug(`Creating storeTeams for ${orgName}...`);

  const teamMap = teams.reduce(
    (acc, t) => {
      acc[t.name] = t.id;
      return acc;
    },
    {} as Record<string, string>,
  );

  for (let i = 0; i < stores.length; i++) {
    const store = stores[i];
    const teamName = TEAM_NAMES[i + 1]?.name;
    const teamId = teamName ? teamMap[teamName] : undefined;
    if (!teamId) continue;

    const [existing] = await db
      .select({ id: tenantTables.storeTeam.id })
      .from(tenantTables.storeTeam)
      .where(
        and(
          eq(tenantTables.storeTeam.storeId, store.id),
          eq(tenantTables.storeTeam.teamId, teamId),
        ),
      )
      .limit(1);

    if (existing) continue;

    await db.insert(tenantTables.storeTeam).values({
      id: generateUuid(),
      storeId: store.id,
      teamId,
      createdAt: new Date(),
    });
  }
};
