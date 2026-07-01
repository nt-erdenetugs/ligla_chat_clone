import { USER_QUERIES } from '../../fixtures/graphql/user.queries';
import { TestSetup, TestValidators, TestContext } from '../../utils/test-setup';

let sharedTestAppPromise: Promise<TestContext> | null = null;
let sharedTestAppCleanupPromise: Promise<void> | null = null;

export const TEST_USERS = {
  BASIC: {
    email: 'newuser@example.com',
    displayName: 'New User',
    roleType: 'OPERATOR',
  },
  WITH_SPACES: {
    email: 'spaced@example.com',
    displayName: '  John   Doe  ',
    expectedDisplayName: 'John Doe',
  },
  DUPLICATE_EMAIL: { email: 'duplicate@example.com', displayName: 'Duplicate' },
  INVALID_EMAIL: { email: 'not-an-email', displayName: 'Invalid Email' },
  EMPTY_DISPLAY_NAME: { email: 'empty@example.com', displayName: '' },
  CROSS_ORG: { email: 'crossorg@example.com', displayName: 'Cross Org User' },
  FOR_UPDATE: { email: 'update-test@example.com', displayName: 'Original Name' },
} as const;

export const ERROR_MESSAGES = {
  FORBIDDEN: 'Forbidden',
  UNAUTHORIZED: 'Unauthorized',
  USER_ALREADY_EXISTS: 'already exists',
  INVALID_EMAIL: 'email',
  EMPTY_DISPLAY_NAME: 'displayName',
  USER_NOT_FOUND: 'User not found',
  ACCESS_DENIED: 'Access denied to user',
  NO_PERMISSION_TO_MODIFY: 'You do not have permission to modify this data',
  LAST_ADMIN: 'You cannot remove the last admin user',
  CANNOT_DEACTIVATE: 'You cannot deactivate yourself',
  NOT_ACCEPTED_INVITATION: "hasn't accepted the invitation",
  INVALID_FILTER_FIELD: 'invalidFilterField',
  MAX_OPERATOR_EXCEEDED: 'Reached the maximum number of operators!',
  VERIFY_OPERATOR_LIMIT_EXCEEDED:
    'Operator limit for organization has been exceeded. Please contact admin for support.',
  ADMIN_TO_NON_ADMIN_ERROR: 'Unable to change an admin user to a non-admin user',
  PASSWORD_IS_INCORRECT: 'Password is incorrect',
  INVALID_TOKEN: 'Invalid or expired token',
  HAS_ONGOING_CHAT: 'User has ongoing chats',
  CANNOT_DELETE_ASSIGNEE_USER: 'Unable to delete chat assignee user',
} as const;

export const TEST_VALUES = {
  ORIGINAL: 'Original Value',
  UPDATED: 'Updated Value',
  DISPLAY_NAME_NEW: 'New Display Name',
  SENDER_NAME_NEW: 'New Sender Name',
} as const;

// Test Helper Functions
export class UserTestHelpers {
  static createUserInput(overrides: any = {}) {
    return {
      email: 'test@example.com',
      displayName: 'Test User',
      roleType: 'OPERATOR',
      ...overrides,
    };
  }

  static updateUserInput(id: string, overrides: any = {}) {
    return {
      id,
      displayName: 'Updated Name',
      roleType: 'OPERATOR',
      status: 'ACTIVE',
      ...overrides,
    };
  }

  static updateDisplayNameInput(displayName: string) {
    return {
      displayName,
    };
  }

  static updateSenderNameInput(senderName: string) {
    return {
      senderName,
    };
  }

  static validateUserFields(user: any, expected: any) {
    TestValidators.validateUser(user, expected);
    if (expected.status !== undefined) {
      expect(user.status).toBe(expected.status);
    }
    if (expected.roleType !== undefined) {
      expect(user.roleType).toBe(expected.roleType);
    }
  }
}

export interface UserTestContext extends TestContext {
  org1: any;
  org2: any;
  adminToken: string;
  managerToken: string;
  operatorToken: string;
  org2AdminToken: string;
  adminUser: any;
  managerUser: any;
  operatorUser: any;
  tenantSchemaNames: string[];
  baselineUsers: { id: string; roleType: string; displayName: string }[];
}

export async function getSharedTestApp(): Promise<TestContext> {
  if (!sharedTestAppPromise) {
    sharedTestAppPromise = TestSetup.createTestApp();
  }

  return sharedTestAppPromise;
}

export async function cleanupSharedTestApp(): Promise<void> {
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

export async function setupUserTests(
  context: TestContext,
  suitePrefix: string = 'user_test',
): Promise<UserTestContext> {
  const org1Name = `${suitePrefix}_org1`;
  const org2Name = `${suitePrefix}_org2`;

  const { organizations, users, tokens } = await TestSetup.createStandardTestData(
    context.factory,
    context.authHelper,
    org1Name,
    org2Name,
  );

  // Create a default team and assign manager + operator to it.
  // This mirrors production behavior where UserService.create always assigns
  // users to at least a default team, which is required for OPERATOR team-based
  // user listing (findUserTeamsWhere checks shared team membership).
  const defaultTeam = await context.factory.createTeam(organizations.org1.name, {
    name: `${org1Name} Default Team`,
    isDefault: true,
  });
  await context.factory.addUserToTeam(defaultTeam.id, users.managerUser.id);
  await context.factory.addUserToTeam(defaultTeam.id, users.operatorUser.id);

  const tenantSchemaNames = await Promise.all([
    context.factory.getTenantSchemaNameForOrganization(organizations.org1.name),
    context.factory.getTenantSchemaNameForOrganization(organizations.org2.name),
  ]);

  return {
    ...context,
    org1: organizations.org1,
    org2: organizations.org2,
    adminUser: users.adminUser,
    managerUser: users.managerUser,
    operatorUser: users.operatorUser,
    adminToken: tokens.adminToken,
    managerToken: tokens.managerToken,
    operatorToken: tokens.operatorToken,
    org2AdminToken: tokens.org2AdminToken,
    tenantSchemaNames,
    baselineUsers: [
      {
        id: users.adminUser.id,
        roleType: 'ADMIN',
        displayName: users.adminUser.displayName,
      },
      {
        id: users.managerUser.id,
        roleType: 'MANAGER',
        displayName: users.managerUser.displayName,
      },
      {
        id: users.operatorUser.id,
        roleType: 'OPERATOR',
        displayName: users.operatorUser.displayName,
      },
      {
        id: users.org2AdminUser.id,
        roleType: 'ADMIN',
        displayName: users.org2AdminUser.displayName,
      },
    ],
  };
}

export { USER_QUERIES, TestSetup, TestValidators };
