import { TestContext, TestSetup } from '../../utils/test-setup';

let sharedTestAppPromise: Promise<TestContext> | null = null;
let sharedTestAppCleanupPromise: Promise<void> | null = null;

export interface ChatTestContext extends TestContext {
  org1: any;
  org2: any;
  adminToken: string;
  managerToken: string;
  operatorToken: string;
  org2AdminToken: string;
  adminUser: any;
  operatorUser: any;
  managerUser: any;
  org2AdminUser: any;
  tenantSchemaNames: string[];
}

/**
 * Get or create shared test app for chat tests.
 * This ensures all chat test files share the same NestJS app instance.
 */
export async function getSharedChatTestApp(): Promise<TestContext> {
  if (!sharedTestAppPromise) {
    sharedTestAppPromise = TestSetup.createTestApp();
  }

  return sharedTestAppPromise;
}

/**
 * Cleanup shared test app and data.
 * Should be called once after all chat tests complete.
 */
export async function cleanupSharedChatTestApp(): Promise<void> {
  if (!sharedTestAppPromise) {
    return;
  }

  if (!sharedTestAppCleanupPromise) {
    sharedTestAppCleanupPromise = sharedTestAppPromise.then((context) =>
      TestSetup.cleanupTestApp(context),
    );
  }

  await sharedTestAppCleanupPromise;
}

export async function setupChatTests(
  context: TestContext,
  suitePrefix: string = 'chat_test',
): Promise<ChatTestContext> {
  const org1Name = `${suitePrefix}_org1`;
  const org2Name = `${suitePrefix}_org2`;

  const { organizations, users, tokens } = await TestSetup.createStandardTestData(
    context.factory,
    context.authHelper,
    org1Name,
    org2Name,
  );

  const tenantSchemaNames = await Promise.all([
    context.factory.getTenantSchemaNameForOrganization(organizations.org1.name),
    context.factory.getTenantSchemaNameForOrganization(organizations.org2.name),
  ]);

  return {
    ...context,
    org1: organizations.org1,
    org2: organizations.org2,
    adminToken: tokens.adminToken,
    managerToken: tokens.managerToken,
    operatorToken: tokens.operatorToken,
    org2AdminToken: tokens.org2AdminToken,
    adminUser: users.adminUser,
    operatorUser: users.operatorUser,
    managerUser: users.managerUser,
    org2AdminUser: users.org2AdminUser,
    tenantSchemaNames,
  };
}
