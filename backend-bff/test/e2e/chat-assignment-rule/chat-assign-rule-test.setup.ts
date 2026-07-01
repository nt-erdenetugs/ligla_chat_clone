import { TestContext, TestSetup } from '../../utils/test-setup';

let sharedTestAppPromise: Promise<TestContext> | null = null;
let sharedTestAppCleanupPromise: Promise<void> | null = null;

export interface ChatAssignRuleTestContext extends TestContext {
  org1: any;
  org2: any;
  adminToken: string;
  managerToken: string;
  operatorToken: string;
  org2AdminToken: string;
  tenantSchemaNames: string[];
}

/**
 * Get or create shared test app for chat assignment rule tests.
 */
export async function getSharedChatAssignRuleTestApp(): Promise<TestContext> {
  if (!sharedTestAppPromise) {
    sharedTestAppPromise = TestSetup.createTestApp();
  }

  return sharedTestAppPromise;
}

/**
 * Cleanup shared test app and data.
 */
export async function cleanupSharedChatAssignRuleTestApp(): Promise<void> {
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

export async function setupChatAssignRuleTests(
  context: TestContext,
  suitePrefix: string = 'chat_assignment_rule_test',
): Promise<ChatAssignRuleTestContext> {
  const org1Name = `${suitePrefix}_org1`;
  const org2Name = `${suitePrefix}_org2`;

  const { organizations, tokens } = await TestSetup.createStandardTestData(
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
    tenantSchemaNames,
  };
}
