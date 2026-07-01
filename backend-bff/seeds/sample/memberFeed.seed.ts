import { eq } from 'drizzle-orm';

import { DrizzleDB } from '@/drizzle';
import { TenantTables } from '@@/drizzle/tenant/schema';

import { OrgSeedData } from './data';

function generateColumns(
  prefix: string,
  count: number,
  type: 'string' | 'number' | 'datetime' = 'string',
): Record<string, string | number | Date> {
  const generators = {
    string: (i: number) => `${prefix}_${i}`,
    number: (i: number) => i,
    datetime: () => new Date(),
  };

  const getValue = generators[type];

  return Array.from({ length: count }, (_, idx) => {
    const i = idx + 1;
    return [`${prefix}${i}`, getValue(i)];
  }).reduce<Record<string, string | number | Date>>((acc, [key, value]) => {
    acc[String(key)] = value;
    return acc;
  }, {});
}

export const COLUMNS = {
  ...generateColumns('category', 25),
  ...generateColumns('number', 15, 'number'),
  ...generateColumns('datetime', 15, 'datetime'),
};

export const createMemberFeeds = async (
  db: DrizzleDB,
  tenantTables: TenantTables,
  orgData: OrgSeedData,
) => {
  console.debug(`Creating member feeds for ${orgData.orgName}...`);

  for (const chat of orgData.chats) {
    const [existing] = await db
      .select({ id: tenantTables.memberFeedData.id })
      .from(tenantTables.memberFeedData)
      .where(eq(tenantTables.memberFeedData.clientUserId, chat.clientUserId))
      .limit(1);

    if (existing) continue;

    await db.insert(tenantTables.memberFeedData).values({
      clientUserId: chat.clientUserId,
      createdAt: new Date(),
      ...COLUMNS,
    } as any);
  }
};
