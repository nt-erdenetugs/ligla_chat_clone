import { DrizzleDB } from '@/drizzle';
import { TenantTables } from '@@/drizzle/tenant/schema';

import { OrgSeedData } from './data';

export const createTags = async (
  db: DrizzleDB,
  tenantTables: TenantTables,
  orgData: OrgSeedData,
) => {
  console.debug(`Creating tags for ${orgData.orgName}...`);

  for (const tagData of orgData.tags) {
    await db
      .insert(tenantTables.tags)
      .values({
        id: tagData.id,
        name: tagData.name,
        isActive: tagData.isActive,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  }
};

export const createChatTags = async (
  db: DrizzleDB,
  tenantTables: TenantTables,
  orgData: OrgSeedData,
) => {
  console.debug(`Creating chatTags for ${orgData.orgName}...`);

  for (const ctData of orgData.chatTags) {
    await db
      .insert(tenantTables.chatTags)
      .values({
        id: ctData.id,
        chatId: ctData.chatId,
        tagId: ctData.tagId,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  }
};
