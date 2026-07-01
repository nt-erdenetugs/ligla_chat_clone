# Tenant Manager Job

Tenant schema management job for the Ligla Chat database. Located in `backend-core/jobs/tenant_manager/`, this job handles data migration between `public_old` schema and tenant-specific schemas (`org_*`).

## Overview

This job provides centralized operations for:
- **Data Migration**: Copy data from `public_old` to all tenant schemas
- **Data Rollback**: Copy data from tenant schemas back to `public_old`
- **Validation**: Verify data integrity across all tenants

**Important**: This job does **NOT** run Alembic migrations. It only migrates DATA between schemas. Schema provisioning is handled by the main migration job (`Dockerfile.migrations`).

## Architecture

### Data Flow

```
public_old (source)  →  org_<uuid> (tenant schemas)  →  public_old (rollback)
```

- **public_old**: Contains historical data for all organizations mixed together
- **org_<uuid>**: Individual tenant schemas with organization-specific data
- Tenant schema names are computed from organization UUID: `org_{uuid_hex}`

### Commands

All commands operate on **ALL organizations** in the database:

```bash
# Validate all tenant schemas (includes environment + migration head checks)
uv run --group db-jobs python -m jobs.tenant_manager.validate

# Migrate data from public_old to all tenant schemas
uv run --group db-jobs python -m jobs.tenant_manager.migrate_data --commit

# Rollback: migrate data from all tenant schemas back to public_old
uv run --group db-jobs python -m jobs.tenant_manager.migrate_data_back --commit

# Validate tenant template schema
uv run --group db-jobs python -m jobs.tenant_manager.validate --template

# Validate cross-schema foreign keys
uv run --group db-jobs python -m jobs.tenant_manager.validate --cross-schema-fks

# Compare tenant schemas against template
uv run --group db-jobs python -m jobs.tenant_manager.sync_template
```

## Parallel Execution (New Feature)

The tenant manager now supports **parallel data migration** across organizations for significantly faster execution.

### Benefits
- **3-4x faster** with 4 workers for 4+ organizations
- **6-7x faster** with 8 workers for 8+ organizations
- Automatic connection pool optimization for parallel operations
- Thread-safe logging and error handling
- Backwards compatible (default: sequential execution)

### Usage Examples

```bash
# Sequential execution (original behavior, default)
uv run --group db-jobs python -m jobs.tenant_manager.migrate_data --source public_old --commit

# Parallel migration with 4 workers (recommended for 4+ orgs)
uv run --group db-jobs python -m jobs.tenant_manager.migrate_data --source public_old --commit --workers 4

# Parallel rollback with error tolerance
uv run --group db-jobs python -m jobs.tenant_manager.migrate_data_back --commit --workers 4 --continue-on-error

# Maximum performance (8 workers)
uv run --group db-jobs python -m jobs.tenant_manager.migrate_data --source public_old --commit --workers 8
```

### Performance Guidelines

| Organizations | Recommended Workers | Expected Speedup |
|---------------|-------------------|------------------|
| 1-3           | 1 (sequential)    | 1x               |
| 4-6           | 4                 | 3-4x             |
| 7-12          | 6                 | 5-6x             |
| 13+           | 8                 | 6-7x             |

### Options

```bash
--workers N           # Number of parallel workers (default: 1, max: 10)
--continue-on-error   # Continue processing if one organization fails
```

### Technical Details

- **Architecture**: ThreadPoolExecutor with database connection pooling
- **Connection Pool**: Auto-expanded to 15 connections (10 pool, 5 overflow) for parallel operations
- **Error Handling**: Fail-fast by default, optional continue-on-error mode
- **Logging**: Thread-safe with organization-specific prefixes
- **Resource Safety**: Automatic worker count adjustment based on connection pool limits

## Local Development

### Setup

```bash
cd backend-core

# Install dependencies with db-jobs group
uv sync --group db-jobs

# Set environment variables (if not already set)
# Environment variables are read from app.db.session and app.config
```

### Running Commands

```bash
# From backend-core directory

# Dry-run (default - no changes made)
uv run --group db-jobs python -m jobs.tenant_manager.validate
uv run --group db-jobs python -m jobs.tenant_manager.migrate_data

# Commit changes
uv run --group db-jobs python -m jobs.tenant_manager.migrate_data --commit
uv run --group db-jobs python -m jobs.tenant_manager.migrate_data_back --commit
```

### Environment Variables

```env
# Database connection
DB_HOST=postgres
DB_PORT=5432
DB_USER=ligla_user
DB_PASS=ligla_password
DB_NAME=ligla_db

# For Cloud SQL (staging/production)
CLOUD_SQL_CONNECTION_NAME=project:region:instance

# Environment
ENV=local  # local | dev | staging | production

# Logging
LOG_LEVEL=INFO
```

## Cloud Run Deployment

### Build and Deploy

```bash
# From project root

# Build Docker image for staging
docker build -f backend-core/Dockerfile.migrations \
  --build-arg ENV=stg \
  -t gcr.io/PROJECT_ID/tenant-manager-stg:latest .

# Build for production
docker build -f backend-core/Dockerfile.migrations \
  --build-arg ENV=prd \
  -t gcr.io/PROJECT_ID/tenant-manager-prd:latest .

# Push and deploy (use Makefile targets if available)
make deploy-tenant-manager-stg
```

### Execute Jobs

```bash
# Run validation
gcloud run jobs execute tenant-manager-stg \
  --region=asia-northeast1 \
  --args="python,-m,jobs.tenant_manager.validate"

# Run data migration
gcloud run jobs execute tenant-manager-stg \
  --region=asia-northeast1 \
  --args="python,-m,jobs.tenant_manager.migrate_data,--commit"

# Run rollback
gcloud run jobs execute tenant-manager-stg \
  --region=asia-northeast1 \
  --args="python,-m,jobs.tenant_manager.migrate_data_back,--commit"
```

## Operations

### 1. Validate All Tenants

Validates data integrity for all tenant schemas by comparing row counts.
This command also validates the environment and checks that tenant schemas are at the Alembic head revision.

```bash
# Validate all tenant schemas (row counts only)
uv run --group db-jobs python -m jobs.tenant_manager.validate

# Validate with deep checksum comparison (slower but thorough)
uv run --group db-jobs python -m jobs.tenant_manager.validate --deep

# Validate single organization
uv run --group db-jobs python -m jobs.tenant_manager.validate --org "Organization Name"
uv run --group db-jobs python -m jobs.tenant_manager.validate --org "Organization Name" --deep
```

**What it does:**
- Compares row counts between `public` source and each tenant schema
- For tables with `organizationName` column: filters source by organization
- For tables with join relationships: uses JOIN to filter source data
- Deep mode: calculates MD5 checksums of all row data for exact comparison
- Reports mismatches and errors

**Options:**
```bash
--org <name>  # Validate single organization only
--deep        # Perform checksum validation (slower but more thorough)
```

**Output:**
```
Validating org_abc123...
  ✓ chat: 1250 rows match
  ✓ user: 45 rows match
  ✗ chatMessage: source=3200, tenant=3150 (MISMATCH)
...
✓ All tenant schemas validated successfully
```

### 2. Migrate Data to Tenant Schemas

Copies data from `public_old` to all tenant schemas.

```bash
# Dry-run (shows what would be copied)
uv run --group db-jobs python -m jobs.tenant_manager.migrate_data

# Actually copy data
uv run --group db-jobs python -m jobs.tenant_manager.migrate_data --commit

# Parallel migration (faster for multiple organizations)
uv run --group db-jobs python -m jobs.tenant_manager.migrate_data --commit --workers 4
```

**What it does:**
- For each organization:
  - Finds all rows in `public_old` WHERE `organizationName = org.name`
  - Copies data to `org_<uuid>` tenant schema
  - Handles child tables (join-based filtering)
  - Syncs database sequences
- Updates migration status to `DATA_COPIED`

**Options:**
```bash
--source <schema>     # Source schema (default: public_old)
--commit              # Actually copy data (default is dry-run)
--workers <n>         # Number of parallel workers (default: 1)
--continue-on-error   # Continue if one organization fails
```

### 3. Rollback Data to public_old

Copies data from tenant schemas back to `public_old`.

```bash
# Dry-run
uv run --group db-jobs python -m jobs.tenant_manager.migrate_data_back

# Actually copy data back
uv run --group db-jobs python -m jobs.tenant_manager.migrate_data_back --commit

# Parallel rollback (faster for multiple organizations)
uv run --group db-jobs python -m jobs.tenant_manager.migrate_data_back --commit --workers 4

# Commit with strict count validation
uv run --group db-jobs python -m jobs.tenant_manager.migrate_data_back --commit --strict-counts
```

**What it does:**
- For each tenant schema:
  - Copies ALL rows from `org_<uuid>` back to `public_old`
  - Uses `INSERT ... ON CONFLICT` for safe upserts
  - Handles column type mismatches (enum casting)
  - Injects `organizationName` where needed
- Strict counts mode: fails if tenant count ≠ public count after migration

**Options:**
```bash
--target <schema>     # Target schema (default: public_old)
--commit              # Actually copy data (default is dry-run)
--strict-counts       # Fail if count mismatches detected
--workers <n>         # Number of parallel workers (default: 1)
--continue-on-error   # Continue if one organization fails
```

### 4. Template Schema Validation

Validate the tenant template schema structure:

```bash
uv run --group db-jobs python -m jobs.tenant_manager.validate --template
```

### 5. Cross-Schema FK Validation

Validate that required foreign keys exist in tenant schemas:

```bash
uv run --group db-jobs python -m jobs.tenant_manager.validate --cross-schema-fks
```

### 6. Sync Template to Tenants

Compares all tenant schemas against the template schema.

```bash
uv run --group db-jobs python -m jobs.tenant_manager.sync_template
```



## Safety Features

- **Dry-run by default**: All commands require `--commit` to make changes
- **Validation before migration**: Checks schema existence and structure
- **Transaction-based**: All operations use database transactions
- **Detailed logging**: Every operation is logged with timestamps
- **Error isolation**: Failures in one organization don't stop others

## Troubleshooting

### Data Mismatch After Migration

```bash
# Run validation to identify which tables have mismatches
uv run --group db-jobs python -m jobs.tenant_manager.validate

# Check logs for specific organization
docker logs <container-id> | grep "org_abc123"
```

### Schema Structure Differences

Use the template sync command to compare tenant schemas against the template:

```bash
uv run --group db-jobs python -m jobs.tenant_manager.sync_template
```

### Rollback Failed Migration

```bash
# Copy data back to public_old
uv run --group db-jobs python -m jobs.tenant_manager.migrate_data_back --commit

# Optional: drop tenant schemas after rollback
# (manually via SQL or separate script)
```

## Monitoring

### Cloud Run Job Logs

```bash
# View execution logs
gcloud logging read \
  "resource.type=cloud_run_job AND resource.labels.job_name=tenant-manager-stg" \
  --limit 50 \
  --format json
```

### Metrics

- **Execution time**: Tracked in Cloud Run metrics
- **Success rate**: Check job execution history
- **Data volume**: Logged in output (rows copied per table)

## Development Notes

### Project Structure

```
backend-core/
├── jobs/
│   └── tenant_manager/      # Tenant manager job
│       ├── operations/      # Business logic
│       │   ├── introspection.py # DB introspection queries
│       │   ├── migration.py # Data migration operations
│       │   ├── rollback.py  # Data rollback operations
│       │   ├── validation.py # Validation logic
│       │   ├── where_builder.py # WHERE clause construction
│       │   └── table_order_validator.py # FK dependency ordering
│       ├── manager.py       # TenantManager orchestration class
│       ├── validate.py      # Command: validate (--template, --cross-schema-fks)
│       ├── migrate_data.py  # Command: migrate data
│       ├── migrate_data_back.py # Command: rollback data
│       ├── sync_template.py # Command: compare template and tenant schemas
│       └── README.md        # This file
├── app/
│   └── db/                  # Shared database modules
│       ├── models.py        # SQLAlchemy models (includes MigrationPhase)
│       ├── session.py       # DB session management
│       └── tenant_migration_config.py # Table specifications (TENANT_TABLES)
└── Dockerfile.migrations    # Docker build for Cloud Run Job
```

### Adding New Commands

1. Create entry point script (e.g., `my_command.py`)
2. Import `TenantManager` and call appropriate method
3. Add to Dockerfile CMD options
4. Update this README

### Testing

```bash
# From backend-core directory

# Run against test database (if available)
docker compose -f docker-compose.test.yml up -d

# Set test DB env vars (override app.config)
export DB_HOST=localhost
export DB_PORT=5433
export DB_NAME=ligla_chat_test

# Run commands
uv run --group db-jobs python -m jobs.tenant_manager.validate
```

## Security

- **SQL Injection**: All schema names are validated against strict regex patterns
- **Credentials**: Stored in GCP Secret Manager for cloud deployments
- **Least Privilege**: Database user should have only necessary permissions
- **Audit Logging**: All operations logged with timestamps

## Support

For issues or questions:
1. Check Cloud Run job logs
2. Review validation output
3. Inspect database state directly
4. Contact the backend team

---

**Version**: 0.1.0  
**Last Updated**: 2025-01-20
