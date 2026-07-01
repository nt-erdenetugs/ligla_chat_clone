import { randomBytes } from 'crypto';

// Set NODE_ENV to test before any modules are loaded
process.env.NODE_ENV = 'test';

// Generate an ephemeral 32-byte encryption master key per test process.
// Never hard-coded and never committed — re-derived on each test run.
if (!process.env.ENCRYPTION_MASTER_KEY) {
  process.env.ENCRYPTION_MASTER_KEY = randomBytes(32).toString('base64');
}

// Default JWT_SECRET for tests must match the value test specs/AuthHelper use.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_key_for_e2e_testing_only';
}
