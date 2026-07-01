/**
 * Build database URL with Cloud SQL Proxy support
 * When USE_CLOUD_SQL_PROXY=true, connects via Unix socket
 */
function getDatabaseUrl(): string {
  const useCloudSqlProxy = process.env.USE_CLOUD_SQL_PROXY === 'true';

  if (useCloudSqlProxy) {
    const { DB_USER, DB_PASS, DB_NAME, CLOUD_SQL_CONNECTION_NAME } = process.env;
    if (!DB_USER || !DB_PASS || !DB_NAME || !CLOUD_SQL_CONNECTION_NAME) {
      throw new Error(
        'Missing required env vars for Cloud SQL Proxy: DB_USER, DB_PASS, DB_NAME, CLOUD_SQL_CONNECTION_NAME',
      );
    }
    return `postgresql://${DB_USER}:${DB_PASS}@localhost/${DB_NAME}?host=/cloudsql/${CLOUD_SQL_CONNECTION_NAME}`;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  return url;
}

export default {
  out: './drizzle/raw',
  schema: './drizzle/raw/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: getDatabaseUrl(),
  },
  introspect: {
    casing: 'preserve',
  },
  schemaFilter: ['public', 'tenant_template'],
  breakpoints: true,
};
