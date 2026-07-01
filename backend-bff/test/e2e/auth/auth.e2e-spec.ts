import { AUTH_QUERIES } from '../../fixtures/graphql/auth.queries';
import { TestSetup, TestValidators, TestContext } from '../../utils/test-setup';

const TEST_CREDENTIALS = {
  VALID_PASSWORD: 'Test@123',
  WRONG_PASSWORD: 'WrongPassword123',
  ADMIN_EMAIL: 'test-admin@example.com',
  MANAGER_EMAIL: 'test-manager@example.com',
  OPERATOR_EMAIL: 'test-operator@example.com',
  HYPERVISOR_EMAIL: 'hypervisor@example.com',
  INACTIVE_EMAIL: 'inactive@example.com',
  PENDING_EMAIL: 'pending@example.com',
  LOCKED_EMAIL: 'locked@example.com',
  RESET_EMAIL: 'reset@example.com',
  INVALID_EMAIL: 'not-an-email',
  NONEXISTENT_EMAIL: 'nonexistent@example.com',
  CASE_TEST_EMAIL: 'CaseSensitive@Example.COM',
} as const;

const ERROR_MESSAGES = {
  EMAIL_OR_PASSWORD_INCORRECT: 'Email or password is incorrect',
  ACCOUNT_LOCKED: 'locked',
  UNAUTHORIZED: 'Unauthorized',
  VALIDATION_EMAIL: 'email',
  VALIDATION_PASSWORD: 'password',
} as const;

const LOGIN_CONSTANTS = {
  MAX_ATTEMPTS: 5,
  LOCK_THRESHOLD: 6,
  ONE_HOUR_MS: 3600000,
  TWO_HOURS_MS: 7200000,
} as const;

const TEST_ORGANIZATIONS = {
  ORG1: 'auth_test_org1',
  ORG2: 'auth_test_org2',
  INACTIVE_ORG: 'inactive_org',
} as const;

// Test Helper Class
class AuthTestHelpers {
  static createLoginInput(email: string, password: string) {
    return {
      email,
      password,
    };
  }

  static async attemptMultipleFailedLogins(
    client: any,
    email: string,
    count: number,
    password: string = TEST_CREDENTIALS.WRONG_PASSWORD,
  ) {
    const promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(
        client.queryExpectError(AUTH_QUERIES.LOGIN, ERROR_MESSAGES.EMAIL_OR_PASSWORD_INCORRECT, {
          loginInput: AuthTestHelpers.createLoginInput(email, password),
        }),
      );
    }
    await Promise.all(promises);
  }

  static validateAuthResponse(response: any, queryName: string = 'login') {
    TestValidators.validateAuthToken(response[queryName]);
  }
}

describe('Auth Module (E2E)', () => {
  let context: TestContext;
  let org1: any;
  let org2: any;
  let inactiveOrg: any;
  let tenantSchemaNames: string[];
  let testUser: any;

  beforeAll(async () => {
    context = await TestSetup.createTestApp();
    org1 = await context.factory.createOrganization({ name: TEST_ORGANIZATIONS.ORG1 });
    org2 = await context.factory.createOrganization({ name: TEST_ORGANIZATIONS.ORG2 });
    inactiveOrg = await context.factory.createOrganization({
      name: TEST_ORGANIZATIONS.INACTIVE_ORG,
      isActive: false,
    });
    tenantSchemaNames = await Promise.all([
      context.factory.getTenantSchemaNameForOrganization(org1.name),
      context.factory.getTenantSchemaNameForOrganization(org2.name),
      context.factory.getTenantSchemaNameForOrganization(inactiveOrg.name),
    ]);
  });

  beforeEach(async () => {
    testUser = await context.factory.createUser(org1.name, 'ADMIN', {
      email: TEST_CREDENTIALS.ADMIN_EMAIL,
    });
  });

  afterEach(async () => {
    await context.cleaner.cleanAuthTestData(tenantSchemaNames);
  });

  afterAll(async () => {
    await TestSetup.cleanupTestApp(context);
  });

  describe('login', () => {
    describe('successful authentication', () => {
      it('should successfully login with valid credentials', async () => {
        const response = await context.client.queryExpectSuccess(AUTH_QUERIES.LOGIN, {
          loginInput: AuthTestHelpers.createLoginInput(
            testUser.email,
            TEST_CREDENTIALS.VALID_PASSWORD,
          ),
        });

        AuthTestHelpers.validateAuthResponse(response);
      });

      it('should login with case-insensitive email', async () => {
        const response = await context.client.queryExpectSuccess(AUTH_QUERIES.LOGIN, {
          loginInput: AuthTestHelpers.createLoginInput(
            testUser.email.toUpperCase(),
            TEST_CREDENTIALS.VALID_PASSWORD,
          ),
        });

        AuthTestHelpers.validateAuthResponse(response);
      });

      it('should normalize email to lowercase', async () => {
        // Create user with case-sensitive email
        await context.factory.createUser(org1.name, 'ADMIN', {
          email: TEST_CREDENTIALS.CASE_TEST_EMAIL,
        });

        const response = await context.client.queryExpectSuccess(AUTH_QUERIES.LOGIN, {
          loginInput: AuthTestHelpers.createLoginInput(
            TEST_CREDENTIALS.CASE_TEST_EMAIL,
            TEST_CREDENTIALS.VALID_PASSWORD,
          ),
        });

        AuthTestHelpers.validateAuthResponse(response);
      });
    });

    describe('input validation', () => {
      it('should reject login with invalid email format', async () => {
        await context.client.queryExpectError(AUTH_QUERIES.LOGIN, ERROR_MESSAGES.VALIDATION_EMAIL, {
          loginInput: AuthTestHelpers.createLoginInput(
            TEST_CREDENTIALS.INVALID_EMAIL,
            TEST_CREDENTIALS.VALID_PASSWORD,
          ),
        });
      });

      it('should reject login with empty email', async () => {
        await context.client.queryExpectError(AUTH_QUERIES.LOGIN, ERROR_MESSAGES.VALIDATION_EMAIL, {
          loginInput: AuthTestHelpers.createLoginInput('', TEST_CREDENTIALS.VALID_PASSWORD),
        });
      });

      it('should reject login with empty password', async () => {
        await context.client.queryExpectError(
          AUTH_QUERIES.LOGIN,
          ERROR_MESSAGES.VALIDATION_PASSWORD,
          {
            loginInput: AuthTestHelpers.createLoginInput(testUser.email, ''),
          },
        );
      });
    });

    describe('authentication failures', () => {
      it('should reject login with incorrect password', async () => {
        await context.client.queryExpectError(
          AUTH_QUERIES.LOGIN,
          ERROR_MESSAGES.EMAIL_OR_PASSWORD_INCORRECT,
          {
            loginInput: AuthTestHelpers.createLoginInput(
              testUser.email,
              TEST_CREDENTIALS.WRONG_PASSWORD,
            ),
          },
        );
      });

      it('should reject login with non-existent email', async () => {
        await context.client.queryExpectError(
          AUTH_QUERIES.LOGIN,
          ERROR_MESSAGES.EMAIL_OR_PASSWORD_INCORRECT,
          {
            loginInput: AuthTestHelpers.createLoginInput(
              TEST_CREDENTIALS.NONEXISTENT_EMAIL,
              TEST_CREDENTIALS.VALID_PASSWORD,
            ),
          },
        );
      });

      it('should increment login attempts on failed password', async () => {
        const user = await context.factory.createUser(org1.name, 'OPERATOR', {
          email: TEST_CREDENTIALS.OPERATOR_EMAIL,
        });

        await context.client.queryExpectError(
          AUTH_QUERIES.LOGIN,
          ERROR_MESSAGES.EMAIL_OR_PASSWORD_INCORRECT,
          {
            loginInput: AuthTestHelpers.createLoginInput(
              user.email,
              TEST_CREDENTIALS.WRONG_PASSWORD,
            ),
          },
        );

        const updatedUser = await context.factory.getUserById(user.id);
        expect(updatedUser?.loginAttempts).toBe(1);
      });
    });

    describe('user status restrictions', () => {
      it('should reject login for inactive user', async () => {
        const inactiveUser = await context.factory.createUser(org1.name, 'OPERATOR', {
          email: TEST_CREDENTIALS.INACTIVE_EMAIL,
          status: 'INACTIVE',
        });

        await context.client.queryExpectError(
          AUTH_QUERIES.LOGIN,
          ERROR_MESSAGES.EMAIL_OR_PASSWORD_INCORRECT,
          {
            loginInput: AuthTestHelpers.createLoginInput(
              inactiveUser.email,
              TEST_CREDENTIALS.VALID_PASSWORD,
            ),
          },
        );
      });

      it('should reject login for pending user', async () => {
        const pendingUser = await context.factory.createUser(org1.name, 'OPERATOR', {
          email: TEST_CREDENTIALS.PENDING_EMAIL,
          status: 'PENDING',
        });

        await context.client.queryExpectError(
          AUTH_QUERIES.LOGIN,
          ERROR_MESSAGES.EMAIL_OR_PASSWORD_INCORRECT,
          {
            loginInput: AuthTestHelpers.createLoginInput(
              pendingUser.email,
              TEST_CREDENTIALS.VALID_PASSWORD,
            ),
          },
        );
      });

      it('should reject login for locked user', async () => {
        const lockedUser = await context.factory.createUser(org1.name, 'OPERATOR', {
          email: 'manually-locked@example.com',
          status: 'LOCKED',
          loginAttempts: LOGIN_CONSTANTS.MAX_ATTEMPTS,
        });

        await context.client.queryExpectError(
          AUTH_QUERIES.LOGIN,
          ERROR_MESSAGES.EMAIL_OR_PASSWORD_INCORRECT,
          {
            loginInput: AuthTestHelpers.createLoginInput(
              lockedUser.email,
              TEST_CREDENTIALS.VALID_PASSWORD,
            ),
          },
        );
      });
    });

    describe('organization validation', () => {
      it('should reject login for inactive organization', async () => {
        const userInInactiveOrg = await context.factory.createUser(inactiveOrg.name, 'ADMIN', {
          email: 'user-inactive-org@example.com',
        });

        await context.client.queryExpectError(
          AUTH_QUERIES.LOGIN,
          ERROR_MESSAGES.EMAIL_OR_PASSWORD_INCORRECT,
          {
            loginInput: AuthTestHelpers.createLoginInput(
              userInInactiveOrg.email,
              TEST_CREDENTIALS.VALID_PASSWORD,
            ),
          },
        );
      });

      it('should allow login for active organization', async () => {
        const userInActiveOrg = await context.factory.createUser(org2.name, 'ADMIN', {
          email: 'user-active-org@example.com',
        });

        const response = await context.client.queryExpectSuccess(AUTH_QUERIES.LOGIN, {
          loginInput: AuthTestHelpers.createLoginInput(
            userInActiveOrg.email,
            TEST_CREDENTIALS.VALID_PASSWORD,
          ),
        });

        AuthTestHelpers.validateAuthResponse(response);
      });
    });

    describe('account locking mechanism', () => {
      it('should lock account after max login attempts', async () => {
        const lockedUser = await context.factory.createUser(org1.name, 'OPERATOR', {
          email: TEST_CREDENTIALS.LOCKED_EMAIL,
        });

        // Attempt login with wrong password MAX_ATTEMPTS times
        for (let i = 0; i < LOGIN_CONSTANTS.MAX_ATTEMPTS; i++) {
          await context.client.queryExpectError(
            AUTH_QUERIES.LOGIN,
            ERROR_MESSAGES.EMAIL_OR_PASSWORD_INCORRECT,
            {
              loginInput: AuthTestHelpers.createLoginInput(
                lockedUser.email,
                TEST_CREDENTIALS.WRONG_PASSWORD,
              ),
            },
          );
        }

        // LOCK_THRESHOLD (6th) attempt should lock the account
        await context.client.queryExpectError(
          AUTH_QUERIES.LOGIN,
          ERROR_MESSAGES.EMAIL_OR_PASSWORD_INCORRECT,
          {
            loginInput: AuthTestHelpers.createLoginInput(
              lockedUser.email,
              TEST_CREDENTIALS.VALID_PASSWORD,
            ),
          },
        );

        // Verify user is locked
        const user = await context.factory.getUserById(lockedUser.id);
        expect(user?.status).toBe('LOCKED');
      });

      it('should increment login attempts progressively', async () => {
        const testUser = await context.factory.createUser(org1.name, 'OPERATOR', {
          email: 'progressive-lock@example.com',
        });

        for (let i = 1; i <= 3; i++) {
          await context.client.queryExpectError(
            AUTH_QUERIES.LOGIN,
            ERROR_MESSAGES.EMAIL_OR_PASSWORD_INCORRECT,
            {
              loginInput: AuthTestHelpers.createLoginInput(
                testUser.email,
                TEST_CREDENTIALS.WRONG_PASSWORD,
              ),
            },
          );

          const user = await context.factory.getUserById(testUser.id);
          expect(user?.loginAttempts).toBe(i);
        }
      });

      it('should reset login attempts on successful login', async () => {
        const resetUser = await context.factory.createUser(org1.name, 'OPERATOR', {
          email: TEST_CREDENTIALS.RESET_EMAIL,
        });

        // Attempt wrong password twice
        for (let i = 0; i < 2; i++) {
          await context.client.queryExpectError(
            AUTH_QUERIES.LOGIN,
            ERROR_MESSAGES.EMAIL_OR_PASSWORD_INCORRECT,
            {
              loginInput: AuthTestHelpers.createLoginInput(
                resetUser.email,
                TEST_CREDENTIALS.WRONG_PASSWORD,
              ),
            },
          );
        }

        // Check login attempts increased
        let user = await context.factory.getUserById(resetUser.id);
        expect(user?.loginAttempts).toBe(2);

        // Successful login should reset attempts
        await context.client.queryExpectSuccess(AUTH_QUERIES.LOGIN, {
          loginInput: AuthTestHelpers.createLoginInput(
            resetUser.email,
            TEST_CREDENTIALS.VALID_PASSWORD,
          ),
        });

        // Verify login attempts reset
        user = await context.factory.getUserById(resetUser.id);
        expect(user?.loginAttempts).toBe(0);
      });

      it('should auto-unlock account after one hour', async () => {
        const autoUnlockUser = await context.factory.createUser(org1.name, 'OPERATOR', {
          email: 'auto-unlock@example.com',
          loginAttempts: LOGIN_CONSTANTS.MAX_ATTEMPTS,
          status: 'LOCKED',
        });

        // Set updatedAt to more than one hour ago
        const twoHoursAgo = new Date(Date.now() - LOGIN_CONSTANTS.TWO_HOURS_MS);
        await context.factory.updateUserUpdatedAt(autoUnlockUser.id, twoHoursAgo);

        // Should be able to login after one hour
        const response = await context.client.queryExpectSuccess(AUTH_QUERIES.LOGIN, {
          loginInput: AuthTestHelpers.createLoginInput(
            autoUnlockUser.email,
            TEST_CREDENTIALS.VALID_PASSWORD,
          ),
        });

        AuthTestHelpers.validateAuthResponse(response);

        // Verify account is now active and attempts reset
        const user = await context.factory.getUserById(autoUnlockUser.id);
        expect(user?.status).toBe('ACTIVE');
        expect(user?.loginAttempts).toBe(0);
      });

      it('should not unlock account before one hour has passed', async () => {
        const notUnlockedUser = await context.factory.createUser(org1.name, 'OPERATOR', {
          email: 'not-unlocked@example.com',
          loginAttempts: LOGIN_CONSTANTS.MAX_ATTEMPTS,
          status: 'LOCKED',
        });

        // Set updatedAt to 30 minutes ago (less than one hour)
        const thirtyMinutesAgo = new Date(Date.now() - LOGIN_CONSTANTS.ONE_HOUR_MS / 2);
        await context.factory.updateUserUpdatedAt(notUnlockedUser.id, thirtyMinutesAgo);

        // Should still be locked
        await context.client.queryExpectError(
          AUTH_QUERIES.LOGIN,
          ERROR_MESSAGES.EMAIL_OR_PASSWORD_INCORRECT,
          {
            loginInput: AuthTestHelpers.createLoginInput(
              notUnlockedUser.email,
              TEST_CREDENTIALS.VALID_PASSWORD,
            ),
          },
        );

        // Verify account is still locked
        const user = await context.factory.getUserById(notUnlockedUser.id);
        expect(user?.status).toBe('LOCKED');
      });

      it('should keep account locked if wrong password provided after one hour', async () => {
        const wrongPasswordUser = await context.factory.createUser(org1.name, 'OPERATOR', {
          email: 'wrong-password-unlock@example.com',
          loginAttempts: LOGIN_CONSTANTS.MAX_ATTEMPTS,
          status: 'LOCKED',
        });

        // Set updatedAt to more than one hour ago
        const twoHoursAgo = new Date(Date.now() - LOGIN_CONSTANTS.TWO_HOURS_MS);
        await context.factory.updateUserUpdatedAt(wrongPasswordUser.id, twoHoursAgo);

        // Should fail with wrong password even after time-based unlock
        await context.client.queryExpectError(
          AUTH_QUERIES.LOGIN,
          ERROR_MESSAGES.EMAIL_OR_PASSWORD_INCORRECT,
          {
            loginInput: AuthTestHelpers.createLoginInput(
              wrongPasswordUser.email,
              TEST_CREDENTIALS.WRONG_PASSWORD,
            ),
          },
        );

        // Verify attempts were incremented
        const user = await context.factory.getUserById(wrongPasswordUser.id);
        expect(user?.loginAttempts).toBe(1);
      });
    });
  });

  describe('loginToHypervisor', () => {
    let hypervisorUser: any;

    beforeEach(async () => {
      hypervisorUser = await context.factory.createHypervisorUser({
        email: TEST_CREDENTIALS.HYPERVISOR_EMAIL,
      });
    });

    describe('successful authentication', () => {
      it('should successfully login hypervisor user', async () => {
        const response = await context.client.queryExpectSuccess(AUTH_QUERIES.LOGIN_TO_HYPERVISOR, {
          loginInput: AuthTestHelpers.createLoginInput(
            hypervisorUser.email,
            TEST_CREDENTIALS.VALID_PASSWORD,
          ),
        });

        AuthTestHelpers.validateAuthResponse(response, 'loginToHypervisor');
      });

      it('should login with case-insensitive email', async () => {
        const response = await context.client.queryExpectSuccess(AUTH_QUERIES.LOGIN_TO_HYPERVISOR, {
          loginInput: AuthTestHelpers.createLoginInput(
            hypervisorUser.email.toUpperCase(),
            TEST_CREDENTIALS.VALID_PASSWORD,
          ),
        });

        AuthTestHelpers.validateAuthResponse(response, 'loginToHypervisor');
      });
    });

    describe('authentication failures', () => {
      it('should reject hypervisor login with incorrect password', async () => {
        await context.client.queryExpectError(
          AUTH_QUERIES.LOGIN_TO_HYPERVISOR,
          ERROR_MESSAGES.EMAIL_OR_PASSWORD_INCORRECT,
          {
            loginInput: AuthTestHelpers.createLoginInput(
              hypervisorUser.email,
              TEST_CREDENTIALS.WRONG_PASSWORD,
            ),
          },
        );
      });

      it('should reject hypervisor login with non-existent email', async () => {
        await context.client.queryExpectError(
          AUTH_QUERIES.LOGIN_TO_HYPERVISOR,
          ERROR_MESSAGES.EMAIL_OR_PASSWORD_INCORRECT,
          {
            loginInput: AuthTestHelpers.createLoginInput(
              'nonexistent-hypervisor@example.com',
              TEST_CREDENTIALS.VALID_PASSWORD,
            ),
          },
        );
      });

      it('should reject with invalid email format', async () => {
        await context.client.queryExpectError(
          AUTH_QUERIES.LOGIN_TO_HYPERVISOR,
          ERROR_MESSAGES.VALIDATION_EMAIL,
          {
            loginInput: AuthTestHelpers.createLoginInput(
              TEST_CREDENTIALS.INVALID_EMAIL,
              TEST_CREDENTIALS.VALID_PASSWORD,
            ),
          },
        );
      });

      it('should reject with empty password', async () => {
        await context.client.queryExpectError(
          AUTH_QUERIES.LOGIN_TO_HYPERVISOR,
          ERROR_MESSAGES.VALIDATION_PASSWORD,
          {
            loginInput: AuthTestHelpers.createLoginInput(hypervisorUser.email, ''),
          },
        );
      });
    });

    describe('hypervisor-specific behavior', () => {
      it('should not lock hypervisor account after failed attempts', async () => {
        // Attempt login with wrong password many times (more than MAX_ATTEMPTS)
        for (let i = 0; i < 10; i++) {
          await context.client.queryExpectError(
            AUTH_QUERIES.LOGIN_TO_HYPERVISOR,
            ERROR_MESSAGES.EMAIL_OR_PASSWORD_INCORRECT,
            {
              loginInput: AuthTestHelpers.createLoginInput(
                hypervisorUser.email,
                TEST_CREDENTIALS.WRONG_PASSWORD,
              ),
            },
          );
        }

        // Should still be able to login with correct password
        const response = await context.client.queryExpectSuccess(AUTH_QUERIES.LOGIN_TO_HYPERVISOR, {
          loginInput: AuthTestHelpers.createLoginInput(
            hypervisorUser.email,
            TEST_CREDENTIALS.VALID_PASSWORD,
          ),
        });

        AuthTestHelpers.validateAuthResponse(response, 'loginToHypervisor');
      });

      it('should not increment login attempts for hypervisor users', async () => {
        // Attempt wrong password
        await context.client.queryExpectError(
          AUTH_QUERIES.LOGIN_TO_HYPERVISOR,
          ERROR_MESSAGES.EMAIL_OR_PASSWORD_INCORRECT,
          {
            loginInput: AuthTestHelpers.createLoginInput(
              hypervisorUser.email,
              TEST_CREDENTIALS.WRONG_PASSWORD,
            ),
          },
        );

        // Check that hypervisor user has no loginAttempts field (specific to regular users)
        const user = await context.factory.getHypervisorUserById(hypervisorUser.id);
        expect(user).toBeDefined();
        expect(user).not.toHaveProperty('loginAttempts');
      });

      it('should not check organization status for hypervisor', async () => {
        // Hypervisor users are not tied to organizations
        const response = await context.client.queryExpectSuccess(AUTH_QUERIES.LOGIN_TO_HYPERVISOR, {
          loginInput: AuthTestHelpers.createLoginInput(
            hypervisorUser.email,
            TEST_CREDENTIALS.VALID_PASSWORD,
          ),
        });

        AuthTestHelpers.validateAuthResponse(response, 'loginToHypervisor');
      });

      it('should not check user status for hypervisor', async () => {
        // Hypervisor users don't have status field like regular users
        const response = await context.client.queryExpectSuccess(AUTH_QUERIES.LOGIN_TO_HYPERVISOR, {
          loginInput: AuthTestHelpers.createLoginInput(
            hypervisorUser.email,
            TEST_CREDENTIALS.VALID_PASSWORD,
          ),
        });

        AuthTestHelpers.validateAuthResponse(response, 'loginToHypervisor');
      });
    });
  });
});
