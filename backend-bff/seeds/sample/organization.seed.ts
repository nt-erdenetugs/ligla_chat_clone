import { randomBytes } from 'crypto';

import { eq } from 'drizzle-orm';

import { DrizzleDB } from '@/drizzle';
import { organization as orgDB } from '@@/drizzle/schema';

import { SAMPLE_ORGANIZATIONS } from './data';

const API_KEY_FIXED_LENGTH = 32;

const createOrganization = async (
  db: DrizzleDB,
  name: string,
  displayName: string,
  maxOperator: number,
  loginLiffId: string,
  fileUploadLiffId: string | null,
): Promise<typeof orgDB.$inferSelect> => {
  const existingOrganization = await db.query.organization.findFirst({
    where: eq(orgDB.name, name),
  });

  if (existingOrganization) {
    console.debug(`Organization with name ${name} already exists. Skipping creation.`);
    return existingOrganization;
  }

  const [organization] = await db
    .insert(orgDB)
    .values({
      name,
      displayName,
      maxOperator,
      apiKey: generateApiKey(),
      loginLiffId,
      fileUploadLiffId,
      createdAt: new Date(),
    })
    .returning();

  return organization;
};

// NOTE: Generates a N-character API key by creating N / 2 random bytes (each byte = 2 hex chars)
const generateApiKey = (): string => randomBytes(API_KEY_FIXED_LENGTH / 2).toString('hex');

export const createOrganizations = async (db: DrizzleDB) => {
  console.debug('Creating organizations...');
  for (const { name, displayName, maxOperator, loginLiffId, fileUploadLiffId } of SAMPLE_ORGANIZATIONS) {
    await createOrganization(db, name, displayName, maxOperator, loginLiffId, fileUploadLiffId);
  }
};
