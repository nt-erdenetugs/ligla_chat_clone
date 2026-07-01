import * as bcrypt from 'bcrypt';

import {
  ERROR_MESSAGES,
  setupUserTests,
  getSharedTestApp,
  cleanupSharedTestApp,
  USER_QUERIES,
  UserTestContext,
} from '../user-test.setup';

describe('User Module - Password Management (E2E)', () => {
  let context: UserTestContext;

  beforeAll(async () => {
    const baseContext = await getSharedTestApp();
    context = await setupUserTests(baseContext, 'password');
  });

  beforeEach(async () => {
    const updated = await setupUserTests(context, 'password');
    Object.assign(context, updated);
  });

  afterEach(async () => {
    await context.cleaner.cleanUserTestData(context.tenantSchemaNames, context.baselineUsers);
  });

  afterAll(async () => {
    await cleanupSharedTestApp();
  });

  describe('requestPasswordReset', () => {
    it('should send password reset email for existing user', async () => {
      const response = await context.client.queryExpectSuccess(
        USER_QUERIES.REQUEST_PASSWORD_RESET,
        { email: context.adminUser.email },
      );

      expect(response.requestPasswordReset).toBe(true);
    });

    it('should return success for non-existent email', async () => {
      const response = await context.client.queryExpectSuccess(
        USER_QUERIES.REQUEST_PASSWORD_RESET,
        { email: 'nonexistent@example.com' },
      );

      expect(response.requestPasswordReset).toBe(true);
    });

    it('should accept case-mismatched email', async () => {
      const response = await context.client.queryExpectSuccess(
        USER_QUERIES.REQUEST_PASSWORD_RESET,
        { email: context.adminUser.email.toUpperCase() },
      );

      expect(response.requestPasswordReset).toBe(true);
    });

    it('should handle requesting password reset when unexpired token exists', async () => {
      const testUser = await context.factory.createUser(context.org1.name, 'OPERATOR', {
        email: 'token-exists@example.com',
        status: 'ACTIVE',
      });

      // Request password reset first time
      await context.client.queryExpectSuccess(USER_QUERIES.REQUEST_PASSWORD_RESET, {
        email: testUser.email,
      });

      const firstToken = await context.factory.getPasswordResetToken(testUser.id);
      expect(firstToken).not.toBeNull();

      // Request password reset second time (token still valid)
      // This should succeed but not create a new token
      const response = await context.client.queryExpectSuccess(
        USER_QUERIES.REQUEST_PASSWORD_RESET,
        {
          email: testUser.email,
        },
      );

      const secondToken = await context.factory.getPasswordResetToken(testUser.id);

      expect(response.requestPasswordReset).toBe(true);
      expect(secondToken).not.toBeNull();
      expect(secondToken?.token).toBe(firstToken?.token);
    });
  });

  describe('requestReInvite', () => {
    it('should send re-invite email for existing user', async () => {
      const response = await context.client.queryExpectSuccess(USER_QUERIES.REQUEST_RE_INVITE, {
        email: context.adminUser.email,
      });

      expect(response.requestReInvite).toBe(true);
    });

    it('should return success for non-existent email', async () => {
      const response = await context.client.queryExpectSuccess(USER_QUERIES.REQUEST_RE_INVITE, {
        email: 'nonexistent@example.com',
      });

      expect(response.requestReInvite).toBe(true);
    });

    it('should handle requesting re-invite when unexpired token exists', async () => {
      const testUser = await context.factory.createUser(context.org1.name, 'OPERATOR', {
        email: 're-invite-exists@example.com',
        status: 'PENDING',
      });

      // Request re-invite first time
      await context.client.queryExpectSuccess(USER_QUERIES.REQUEST_RE_INVITE, {
        email: testUser.email,
      });

      const firstToken = await context.factory.getPasswordResetToken(testUser.id);
      expect(firstToken).not.toBeNull();

      // Request re-invite second time (token still valid)
      const response = await context.client.queryExpectSuccess(USER_QUERIES.REQUEST_RE_INVITE, {
        email: testUser.email,
      });

      const secondToken = await context.factory.getPasswordResetToken(testUser.id);

      expect(response.requestReInvite).toBe(true);
      expect(secondToken).not.toBeNull();
      expect(secondToken?.token).toBe(firstToken?.token);
    });

    it('should regenerate token and refresh expiry when existing token is expired', async () => {
      const testUser = await context.factory.createUser(context.org1.name, 'OPERATOR', {
        email: 'reinvite-expired@example.com',
        status: 'PENDING',
      });

      await context.client.queryExpectSuccess(USER_QUERIES.REQUEST_RE_INVITE, {
        email: testUser.email,
      });

      const firstToken = await context.factory.getPasswordResetToken(testUser.id);
      expect(firstToken).not.toBeNull();

      await context.factory.expirePasswordResetToken(testUser.id);

      const response = await context.client.queryExpectSuccess(USER_QUERIES.REQUEST_RE_INVITE, {
        email: testUser.email,
      });

      const refreshedToken = await context.factory.getPasswordResetToken(testUser.id);

      expect(response.requestReInvite).toBe(true);
      expect(refreshedToken).not.toBeNull();
      expect(refreshedToken?.token).not.toBe(firstToken?.token);
      expect(new Date(refreshedToken!.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('updatePassword', () => {
    let testUser: any;
    const currentPassword = 'CurrentPass123!';
    const newPassword = 'NewPass456!';

    beforeEach(async () => {
      // Create active user with known password
      testUser = await context.factory.createUser(context.org1.name, 'OPERATOR', {
        email: 'password-test@example.com',
        displayName: 'Password Test User',
        status: 'ACTIVE',
      });

      // Set a known password for the user
      const hashedPassword = await bcrypt.hash(currentPassword, 10);
      await context.factory.updateUserPassword(testUser.id, hashedPassword);
    });

    it('should update password with correct current password', async () => {
      const token = await context.authHelper.getToken(testUser.email);

      const response = await context.client.queryExpectSuccess(
        USER_QUERIES.RESET_PASSWORD,
        {
          resetPasswordInput: {
            currentPassword,
            newPassword,
          },
        },
        token,
      );

      expect(response.resetPassword.id).toBe(testUser.id);

      // Verify new password works by attempting to authenticate
      const updatedUser = await context.factory.getUserById(testUser.id);
      const isPasswordValid = await bcrypt.compare(newPassword, updatedUser?.hashedPassword);
      expect(isPasswordValid).toBe(true);
    });

    it('should reject incorrect current password', async () => {
      const token = await context.authHelper.getToken(testUser.email);

      await context.client.queryExpectError(
        USER_QUERIES.RESET_PASSWORD,
        ERROR_MESSAGES.PASSWORD_IS_INCORRECT,
        {
          resetPasswordInput: {
            currentPassword: 'WrongPassword123!',
            newPassword,
          },
        },
        token,
      );
    });

    it('should reject for non-existent user', async () => {
      // Use a manually created JWT token for a non-existent user ID
      const fakeUserId = 'non-existent-user-id';
      const fakeToken = context.authHelper.generateToken(fakeUserId);

      // Auth guard will fail first with Unauthorized when user doesn't exist
      await context.client.queryExpectError(
        USER_QUERIES.RESET_PASSWORD,
        ERROR_MESSAGES.UNAUTHORIZED,
        {
          resetPasswordInput: {
            currentPassword,
            newPassword,
          },
        },
        fakeToken,
      );
    });
  });

  describe('resetPasswordByToken', () => {
    let testUser: any;
    const newPassword = 'NewSecurePass123!';

    beforeEach(async () => {
      testUser = await context.factory.createUser(context.org1.name, 'OPERATOR', {
        email: 'token-reset@example.com',
        displayName: 'Token Reset User',
        status: 'ACTIVE',
      });
    });

    it('should reset password with valid token', async () => {
      // Request password reset to get token
      await context.client.queryExpectSuccess(USER_QUERIES.REQUEST_PASSWORD_RESET, {
        email: testUser.email,
      });

      // Get the token from database
      const resetToken = await context.factory.getPasswordResetToken(testUser.id);

      expect(resetToken).not.toBeNull();

      const response = await context.client.queryExpectSuccess(
        USER_QUERIES.RESET_PASSWORD_BY_TOKEN,
        {
          resetPasswordByTokenInput: {
            token: resetToken!.token,
            newPassword,
          },
        },
      );

      expect(response.resetPasswordByToken.success).toBe(true);
      expect(response.resetPasswordByToken.warning).toBeNull();

      // Verify password was changed
      const updatedUser = await context.factory.getUserById(testUser.id);
      const isPasswordValid = await bcrypt.compare(newPassword, updatedUser?.hashedPassword);
      expect(isPasswordValid).toBe(true);

      // Verify token was deleted
      const deletedToken = await context.factory.getPasswordResetToken(testUser.id);
      expect(deletedToken).toBeNull();
    });

    it('should activate PENDING user when resetting password', async () => {
      const pendingUser = await context.factory.createUser(context.org1.name, 'OPERATOR', {
        email: 'pending-reset@example.com',
        status: 'PENDING',
      });

      await context.client.queryExpectSuccess(USER_QUERIES.REQUEST_PASSWORD_RESET, {
        email: pendingUser.email,
      });

      const resetToken = await context.factory.getPasswordResetToken(pendingUser.id);

      await context.client.queryExpectSuccess(USER_QUERIES.RESET_PASSWORD_BY_TOKEN, {
        resetPasswordByTokenInput: {
          token: resetToken!.token,
          newPassword,
        },
      });

      const updatedUser = await context.factory.getUserById(pendingUser.id);
      expect(updatedUser?.status).toBe('ACTIVE');
    });

    it('should reject PENDING operator verification when organization exceeds limit', async () => {
      const limitedOrg = await context.factory.createOrganization({
        name: 'verify_limit_org',
        maxOperator: 1,
      });

      await context.factory.createUser(limitedOrg.name, 'OPERATOR', {
        email: 'verify-limit-active@example.com',
        status: 'ACTIVE',
      });

      const pendingUser = await context.factory.createUser(limitedOrg.name, 'OPERATOR', {
        email: 'verify-limit-pending@example.com',
        status: 'PENDING',
      });

      await context.client.queryExpectSuccess(USER_QUERIES.REQUEST_PASSWORD_RESET, {
        email: pendingUser.email,
      });

      const resetToken = await context.factory.getPasswordResetToken(pendingUser.id);

      const response = await context.client.queryExpectSuccess(
        USER_QUERIES.RESET_PASSWORD_BY_TOKEN,
        {
          resetPasswordByTokenInput: {
            token: resetToken!.token,
            newPassword,
          },
        },
      );

      expect(response.resetPasswordByToken.success).toBe(true);
      expect(response.resetPasswordByToken.warning).toBe(
        ERROR_MESSAGES.VERIFY_OPERATOR_LIMIT_EXCEEDED,
      );

      const updatedUser = await context.factory.getUserById(pendingUser.id);
      const isPasswordValid = await bcrypt.compare(newPassword, updatedUser?.hashedPassword);
      const deletedToken = await context.factory.getPasswordResetToken(pendingUser.id);

      expect(updatedUser?.status).toBe('INACTIVE');
      expect(isPasswordValid).toBe(true);
      expect(deletedToken).toBeNull();
    });

    it('should activate LOCKED user when resetting password', async () => {
      const lockedUser = await context.factory.createUser(context.org1.name, 'OPERATOR', {
        email: 'locked-reset@example.com',
        status: 'LOCKED',
      });

      await context.client.queryExpectSuccess(USER_QUERIES.REQUEST_PASSWORD_RESET, {
        email: lockedUser.email,
      });

      const resetToken = await context.factory.getPasswordResetToken(lockedUser.id);

      await context.client.queryExpectSuccess(USER_QUERIES.RESET_PASSWORD_BY_TOKEN, {
        resetPasswordByTokenInput: {
          token: resetToken!.token,
          newPassword,
        },
      });

      const updatedUser = await context.factory.getUserById(lockedUser.id);
      expect(updatedUser?.status).toBe('ACTIVE');
    });

    it('should return success for INACTIVE user password reset request', async () => {
      const inactiveUser = await context.factory.createUser(context.org1.name, 'OPERATOR', {
        email: 'inactive-reset@example.com',
        status: 'INACTIVE',
      });

      const response = await context.client.queryExpectSuccess(
        USER_QUERIES.REQUEST_PASSWORD_RESET,
        {
          email: inactiveUser.email,
        },
      );

      expect(response.requestPasswordReset).toBe(true);
    });

    it('should reject INACTIVE user from completing password reset by token', async () => {
      // Create an ACTIVE user first
      const activeUser = await context.factory.createUser(context.org1.name, 'OPERATOR', {
        email: 'active-to-inactive@example.com',
        status: 'ACTIVE',
      });

      // Request password reset while ACTIVE
      await context.client.queryExpectSuccess(USER_QUERIES.REQUEST_PASSWORD_RESET, {
        email: activeUser.email,
      });

      const resetToken = await context.factory.getPasswordResetToken(activeUser.id);
      expect(resetToken).not.toBeNull();

      // Change user to INACTIVE in database (simulating admin deactivation)
      await context.factory.updateUserStatus(activeUser.id, 'INACTIVE');

      // Attempt to reset password with token should fail
      await context.client.queryExpectError(
        USER_QUERIES.RESET_PASSWORD_BY_TOKEN,
        'Cannot reset password for inactive user account',
        {
          resetPasswordByTokenInput: {
            token: resetToken!.token,
            newPassword: 'NewPassword123!',
          },
        },
      );
    });

    it('should reject expired token', async () => {
      await context.client.queryExpectSuccess(USER_QUERIES.REQUEST_PASSWORD_RESET, {
        email: testUser.email,
      });

      const resetToken = await context.factory.getPasswordResetToken(testUser.id);

      // Expire the token
      await context.factory.expirePasswordResetToken(testUser.id);

      await context.client.queryExpectError(
        USER_QUERIES.RESET_PASSWORD_BY_TOKEN,
        ERROR_MESSAGES.INVALID_TOKEN,
        {
          resetPasswordByTokenInput: {
            token: resetToken!.token,
            newPassword,
          },
        },
      );
    });

    it('should reject invalid token', async () => {
      await context.client.queryExpectError(
        USER_QUERIES.RESET_PASSWORD_BY_TOKEN,
        ERROR_MESSAGES.INVALID_TOKEN,
        {
          resetPasswordByTokenInput: {
            token: 'invalid-token-12345',
            newPassword,
          },
        },
      );
    });
  });

  describe('verifyPasswordResetToken', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await context.factory.createUser(context.org1.name, 'OPERATOR', {
        email: 'verify-token@example.com',
        status: 'ACTIVE',
      });
    });

    it('should verify valid token', async () => {
      await context.client.queryExpectSuccess(USER_QUERIES.REQUEST_PASSWORD_RESET, {
        email: testUser.email,
      });

      const resetToken = await context.factory.getPasswordResetToken(testUser.id);

      const response = await context.client.queryExpectSuccess(
        USER_QUERIES.VERIFY_PASSWORD_RESET_TOKEN,
        {
          token: resetToken!.token,
        },
      );

      expect(response.verifyPasswordResetToken).toBe(true);
    });

    it('should reject expired token', async () => {
      await context.client.queryExpectSuccess(USER_QUERIES.REQUEST_PASSWORD_RESET, {
        email: testUser.email,
      });

      const resetToken = await context.factory.getPasswordResetToken(testUser.id);

      // Expire the token
      await context.factory.expirePasswordResetToken(testUser.id);

      await context.client.queryExpectError(
        USER_QUERIES.VERIFY_PASSWORD_RESET_TOKEN,
        ERROR_MESSAGES.INVALID_TOKEN,
        {
          token: resetToken!.token,
        },
      );
    });

    it('should reject invalid token', async () => {
      await context.client.queryExpectError(
        USER_QUERIES.VERIFY_PASSWORD_RESET_TOKEN,
        ERROR_MESSAGES.INVALID_TOKEN,
        {
          token: 'invalid-token-xyz',
        },
      );
    });
  });
});
