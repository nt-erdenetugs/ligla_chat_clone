import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

import { DrizzleDB } from '@/drizzle';
import { SALT_OR_ROUNDS } from '@/modules/auth/constants';
import { hypervisorUser } from '@@/drizzle/schema';

import { SAMPLE_HYPERVISOR_USERS } from './data';

const createHypervisorUser = async (
  db: DrizzleDB,
  userId: string,
  email: string,
  password: string,
): Promise<typeof hypervisorUser.$inferSelect> => {
  const existingUser = await db.query.hypervisorUser.findFirst({
    where: eq(hypervisorUser.email, email),
  });

  if (existingUser) {
    console.debug(`Hypervisor user with email ${email} already exists. Skipping creation.`);
    return existingUser;
  }

  const hashedPassword = await bcrypt.hash(password, SALT_OR_ROUNDS);

  const [newHypervisor] = await db
    .insert(hypervisorUser)
    .values({
      id: userId,
      email,
      hashedPassword,
      createdAt: new Date(),
    })
    .returning();

  return newHypervisor;
};

export const createHypervisorUsers = async (db: DrizzleDB) => {
  console.debug('Creating hypervisor users...');
  for (const { userId, email, password } of SAMPLE_HYPERVISOR_USERS) {
    await createHypervisorUser(db, userId, email, password);
  }
};
