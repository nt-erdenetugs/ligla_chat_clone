import { DrizzleDB } from '@/drizzle';
import { TenantTables } from '@@/drizzle/tenant/schema';

import { OrgSeedData } from './data';
import { COLUMNS } from './surveyColumn.seed';

export const createChatSurveys = async (
  db: DrizzleDB,
  tenantTables: TenantTables,
  orgData: OrgSeedData,
) => {
  console.debug(`Seeding surveyData for ${orgData.orgName}...`);

  for (const chat of orgData.chats) {
    await db
      .insert(tenantTables.surveyData)
      .values({
        userSurvey: JSON.parse(JSON.stringify(COLUMNS)),
        createdAt: new Date(),
        clientUserId: chat.clientUserId,
        endUserId: chat.endUserId,
      } as any)
      .onConflictDoNothing();
  }
};
