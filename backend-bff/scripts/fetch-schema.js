/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const GCS_BUCKET = process.env.GCS_SCHEMA_BUCKET;
const GCS_PATH = process.env.GCS_SCHEMA_PATH || 'drizzle-schema/raw/schema.ts';
const RAW_DIR = path.join(__dirname, '../drizzle/raw');
const OUTPUT_PATH = path.join(RAW_DIR, 'schema.ts');

console.log('Environment variables:');
console.log(`  GCS_SCHEMA_BUCKET: ${process.env.GCS_SCHEMA_BUCKET || '(not set)'}`);
console.log(`  GCS_SCHEMA_PATH: ${process.env.GCS_SCHEMA_PATH || '(using default)'}`);

function validateSchemaFile(schemaPath) {
  if (!fs.existsSync(schemaPath)) return false;

  const content = fs.readFileSync(schemaPath, 'utf8');
  // Validate it's a Drizzle schema file
  return content.includes('pgTable') && content.includes('drizzle-orm');
}

async function fetchSchema() {
  // Ensure raw directory exists
  if (!fs.existsSync(RAW_DIR)) {
    fs.mkdirSync(RAW_DIR, { recursive: true });
  }

  if (!GCS_BUCKET) {
    throw new Error('GCS_SCHEMA_BUCKET must be set in the environment');
  }

  console.log(`Fetching schema from gs://${GCS_BUCKET}/${GCS_PATH}...`);

  const gcloudCmd = `gcloud storage cp gs://${GCS_BUCKET}/${GCS_PATH} ${OUTPUT_PATH}`;
  execSync(gcloudCmd, { stdio: 'inherit' });

  if (!validateSchemaFile(OUTPUT_PATH)) {
    throw new Error('Downloaded schema file failed validation - not a valid Drizzle schema');
  }

  console.log('Schema downloaded successfully');

  // Run post-introspect to generate public/tenant schemas and enums
  console.log('Running post-introspect processing...');
  execSync('npm run drizzle:post-introspect', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });

  console.log('Post-introspect processing completed');

  return 0;
}

console.log('Starting Drizzle schema fetch process...');
console.log(`Current directory: ${__dirname}`);
console.log(`Node.js version: ${process.version}`);

fetchSchema()
  .then(() => console.log('Schema fetch and processing completed successfully'))
  .catch((error) => {
    console.error('Schema fetch failed:', error.message);
    process.exit(1);
  });
