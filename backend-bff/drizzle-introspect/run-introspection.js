/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { Storage } = require('@google-cloud/storage');

const isDryRun = process.argv.includes('--dry-run');
const PACKAGE_ROOT = __dirname;
const PROJECT_ROOT = path.join(PACKAGE_ROOT, '..');
const REPO_ROOT = path.join(PROJECT_ROOT, '..');
const RAW_SCHEMA_PATH = path.join(PROJECT_ROOT, 'drizzle/raw/schema.ts');
const RAW_DIR = path.join(PROJECT_ROOT, 'drizzle/raw');
const DRIZZLE_CONFIG_PATH = path.join(PROJECT_ROOT, 'drizzle.config.ts');
const TEMP_ENV_PATH = path.join(PACKAGE_ROOT, '.env.from_secret');
const FALLBACK_ENV_PATHS = [
  path.join(REPO_ROOT, 'secret/.env.stg'),
  path.join(PROJECT_ROOT, '.env.stg'),
  path.join(process.cwd(), '.env.stg'),
];

/**
 * Graceful dependency loading for optional dry-run mode
 */
let dotenv, SecretManagerServiceClient;
try {
  dotenv = require('dotenv');
  SecretManagerServiceClient = require('@google-cloud/secret-manager').SecretManagerServiceClient;
} catch (err) {
  if (!isDryRun) {
    console.error('Missing required dependencies');
    process.exit(1);
  }
}

const storage = new Storage();

function ensureDirectoriesExist() {
  if (!fs.existsSync(RAW_DIR)) {
    fs.mkdirSync(RAW_DIR, { recursive: true });
  }
}

/**
 * Load environment variables from GCP Secret Manager with local fallback
 */
async function loadEnvFromSecretManager() {
  if (isDryRun) return true;

  try {
    const client = new SecretManagerServiceClient();
    const projectId = process.env.GCP_PROJECT_ID;

    const [response] = await client.accessSecretVersion({
      name: `projects/${projectId}/secrets/CHAT_ENV/versions/latest`,
    });

    const envContent = response.payload.data.toString('utf8');
    fs.writeFileSync(TEMP_ENV_PATH, envContent);
    dotenv.config({ path: TEMP_ENV_PATH });

    return true;
  } catch (error) {
    const fallbackEnvPath = FALLBACK_ENV_PATHS.find((candidatePath) => fs.existsSync(candidatePath));
    if (fallbackEnvPath) {
      dotenv.config({ path: fallbackEnvPath });
      return true;
    }
    throw error;
  }
}

/**
 * Upload raw schema file to GCS
 */
async function saveSchemaToGCS(schemaPath) {
  if (isDryRun || !fs.existsSync(schemaPath)) return;

  const gcsBucket = process.env.GCS_SCHEMA_BUCKET || `${process.env.GCP_PROJECT_ID}-drizzle-schema`;
  const gcsPath = process.env.GCS_SCHEMA_PATH || 'drizzle-schema/raw/schema.ts';

  console.log(`Uploading schema to gs://${gcsBucket}/${gcsPath}`);

  await storage.bucket(gcsBucket).upload(schemaPath, {
    destination: gcsPath,
    metadata: { contentType: 'text/plain' },
    resumable: false,
  });

  console.log('Schema uploaded successfully');
}

/**
 * Run drizzle-kit pull to introspect database schema
 */
async function runDrizzleIntrospection() {
  console.log('Running drizzle-kit pull...');

  execSync(`npx --prefix "${PACKAGE_ROOT}" drizzle-kit pull --config "${DRIZZLE_CONFIG_PATH}"`, {
    stdio: 'inherit',
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      USE_CLOUD_SQL_PROXY: process.env.USE_CLOUD_SQL_PROXY || 'false',
    },
  });

  if (!fs.existsSync(RAW_SCHEMA_PATH)) {
    throw new Error('Drizzle schema file was not created by introspection');
  }

  console.log('Drizzle introspection completed');
}

async function runIntrospection() {
  try {
    ensureDirectoriesExist();
    await loadEnvFromSecretManager();

    if (isDryRun) {
      console.log('[DRY RUN] Would perform database introspection');
      return 0;
    }

    await runDrizzleIntrospection();
    await saveSchemaToGCS(RAW_SCHEMA_PATH);

    if (fs.existsSync(TEMP_ENV_PATH)) {
      fs.unlinkSync(TEMP_ENV_PATH);
    }

    console.log('Drizzle schema introspection completed successfully');
    return 0;
  } catch (error) {
    console.error('Drizzle schema introspection failed:', error.message);
    return 1;
  }
}

runIntrospection()
  .then((exitCode) => process.exit(exitCode))
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
