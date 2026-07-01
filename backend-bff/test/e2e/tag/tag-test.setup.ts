import { TestContext, TestSetup } from '../../utils/test-setup';

let sharedTestAppPromise: Promise<TestContext> | null = null;
let sharedTestAppCleanupPromise: Promise<void> | null = null;

export interface TagTestContext extends TestContext {
  org1: any;
  org2: any;
  adminToken: string;
  managerToken: string;
  operatorToken: string;
  org2AdminToken: string;
  tenantSchemaNames: string[];
}

export async function getSharedTagTestApp(): Promise<TestContext> {
  if (!sharedTestAppPromise) {
    sharedTestAppPromise = TestSetup.createTestApp();
  }

  return sharedTestAppPromise;
}

export async function cleanupSharedTagTestApp(): Promise<void> {
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

export async function setupTagTests(
  context: TestContext,
  suitePrefix: string = 'tag_test',
): Promise<TagTestContext> {
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
