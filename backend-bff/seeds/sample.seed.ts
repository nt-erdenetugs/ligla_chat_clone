import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as relations from '@@/drizzle/relations';
import * as schema from '@@/drizzle/schema';
import { createTenantTables } from '@@/drizzle/tenant/schema';

import { createChats, createChatMessages, createChatTeamAssignments } from './sample/chat.seed';
import { getOrgData } from './sample/data';
import { createHypervisorUsers } from './sample/hypervisor.seed';
import { createMemberFeeds } from './sample/memberFeed.seed';
import { createMemberFeedColumns } from './sample/memberFeedColumn.seed';
import { createOrganizations } from './sample/organization.seed';
import { createStores, createStoreTeams } from './sample/store.seed';
import { createChatSurveys } from './sample/survey.seed';
import { createSurveyColumns } from './sample/surveyColumn.seed';
import { createChatTags, createTags } from './sample/tag.seed';
import { createTeams } from './sample/team.seed';
import { createEndUsers, createUsers, createUserTeams } from './sample/user.seed';
import { getOrgSchemas, OrgSchema } from './schema-utils';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema: { ...schema, ...relations } });

const phase = process.env.SEED_PHASE || 'all';

async function seedShared() {
  console.debug('=== Seeding shared tables (public schema) ===');

  await createHypervisorUsers(db);

  if (process.env.ENV === 'local') {
    await createOrganizations(db);

    // Re-query orgs after creating organizations so newly created orgs get migration records
    const orgs = await getOrgSchemas(pool);
    for (const org of orgs) {
      await pool.query(
        `INSERT INTO public."organizationMigration" ("organizationName", "schemaName", "currentPhase", "lastRevision", "lastStatus", "startedAt", "finishedAt")
         VALUES ($1, $2, 'COMPLETED', 'seed', 'SUCCESS', NOW(), NOW())
         ON CONFLICT ("schemaName") WHERE "schemaName" IS NOT NULL DO NOTHING`,
        [org.orgName, org.schemaName],
      );
    }
  }
}

async function seedTenant(orgs: OrgSchema[]) {
  if (process.env.ENV !== 'local') {
    console.debug('Skipping tenant seeding (ENV is not "local")');
    return;
  }

  console.debug('=== Seeding tenant tables (org_* schemas) ===');

  for (const org of orgs) {
    console.debug(`\n--- Seeding tenant: ${org.orgName} (${org.schemaName}) ---`);

    const tenantTables = createTenantTables(org.schemaName);
    const orgData = getOrgData(org.orgName);

    if (!orgData) {
      console.debug(`No seed data defined for org: ${org.orgName}, skipping`);
      continue;
    }

    await createMemberFeedColumns(db, tenantTables, org.orgName);
    await createSurveyColumns(db, tenantTables, org.orgName);
    await createMemberFeeds(db, tenantTables, orgData);

    const users = await createUsers(db, tenantTables, orgData);
    await createEndUsers(db, tenantTables, orgData);

    const stores = await createStores(db, tenantTables, orgData);
    const teams = await createTeams(db, tenantTables, orgData);

    await createUserTeams(db, tenantTables, orgData, users, teams);
    await createStoreTeams(db, tenantTables, orgData.orgName, stores, teams);

    await createChats(db, tenantTables, orgData);
    await createChatMessages(db, tenantTables, orgData);
    await createChatTeamAssignments(db, tenantTables, orgData, teams);

    await createChatSurveys(db, tenantTables, orgData);

    await createTags(db, tenantTables, orgData);
    await createChatTags(db, tenantTables, orgData);
  }
}

const main = async () => {
  console.debug('Seeding database...');

  try {
    if (phase === 'shared' || phase === 'all') {
      await seedShared();
    }

    if (phase === 'tenant' || phase === 'all') {
      const orgs = process.env.ENV === 'local' ? await getOrgSchemas(pool) : [];
      await seedTenant(orgs);
    }

    console.debug('\nSeeding complete!');
  } catch (error) {
    console.error('Error occurred during seeding:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

main();
