import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

import { DrizzleDB } from '@/drizzle';
import { SALT_OR_ROUNDS } from '@/modules/auth/constants';
import { auth } from '@@/drizzle/schema';
import { TenantTables } from '@@/drizzle/tenant/schema';

import {
  OrgSeedData,
  ORGANIZATION_2_USERS_EMAILS,
  SAMPLE,
  TEAM_1_USERS_EMAILS,
  TEAM_2_USERS_EMAILS,
} from './data';

const createUser = async (
  db: DrizzleDB,
  tenantTables: TenantTables,
  userData: OrgSeedData['users'][number],
) => {
  const existingAuth = await db.query.auth.findFirst({
    where: eq(auth.email, userData.email),
  });

  if (existingAuth) {
    await db
      .insert(tenantTables.user)
      .values({
        id: existingAuth.id,
        displayName: userData.displayName,
        pictureUrl: userData.pictureUrl,
        roleType: userData.roleType,
      })
      .onConflictDoNothing();
    return existingAuth;
  }

  const hashedPassword = await bcrypt.hash(userData.password, SALT_OR_ROUNDS);
  return db.transaction(async (tx) => {
    const [a] = await tx
      .insert(auth)
      .values({
        id: userData.userId,
        email: userData.email,
        hashedPassword,
        organizationName: userData.organizationName,
      })
      .onConflictDoNothing()
      .returning();

    if (!a) return;

    await tx.insert(tenantTables.user).values({
      id: a.id,
      displayName: userData.displayName,
      pictureUrl: userData.pictureUrl,
      roleType: userData.roleType,
    });

    return a;
  });
};

export const createUsers = async (
  db: DrizzleDB,
  tenantTables: TenantTables,
  orgData: OrgSeedData,
) => {
  console.debug(`Creating users for ${orgData.orgName}...`);

  for (const user of orgData.users) {
    await createUser(db, tenantTables, user);
  }

  return await db.query.auth.findMany({
    where: eq(auth.organizationName, orgData.orgName),
  });
};

export const createUserTeams = async (
  db: DrizzleDB,
  tenantTables: TenantTables,
  orgData: OrgSeedData,
  users: (typeof auth.$inferSelect)[],
  teams: { id: string; name: string; isDefault: boolean }[],
) => {
  console.debug(`Creating userTeams for ${orgData.orgName}...`);

  const userTeamPairs: { teamId: string; userId: string }[] = [];
  teams
    .filter((team) => !team.isDefault)
    .forEach((team, index) => {
      if (orgData.orgName === SAMPLE.ORGANIZATION_1.name) {
        const allTeamUserEmails = [TEAM_1_USERS_EMAILS, TEAM_2_USERS_EMAILS];
        const teamUsersIds = (allTeamUserEmails[index] || []).map((email) => {
          const user = users.find((u) => u.email === email);
          return user ? user.id : '';
        });
        teamUsersIds.forEach((userId) => userTeamPairs.push({ teamId: team.id, userId }));
      } else if (orgData.orgName === SAMPLE.ORGANIZATION_2.name) {
        const usersIds = ORGANIZATION_2_USERS_EMAILS.map((email) => {
          const user = users.find((u) => u.email === email);
          return user ? user.id : '';
        });
        usersIds.forEach((userId) => userTeamPairs.push({ teamId: team.id, userId }));
      }
    });

  for (const pair of userTeamPairs) {
    if (!pair.teamId || !pair.userId) continue;
    await db
      .insert(tenantTables.userTeam)
      .values({ teamId: pair.teamId, userId: pair.userId, createdAt: new Date() })
      .onConflictDoNothing();
  }
};

export const createEndUsers = async (
  db: DrizzleDB,
  tenantTables: TenantTables,
  orgData: OrgSeedData,
) => {
  console.debug(`Creating end users for ${orgData.orgName}...`);

  for (const endUser of orgData.endUsers) {
    await db
      .insert(tenantTables.endUser)
      .values({
        userId: endUser.userId,
        pictureUrl: endUser.pictureUrl,
        displayName: endUser.displayName,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  }
};
