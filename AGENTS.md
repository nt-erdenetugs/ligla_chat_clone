# AGENTS.md

This file provides guidance to AI coding assistants when working with code in this repository.

## IMPORTANT: Critical Development Commands

**ALWAYS run these commands before committing changes:**
```bash
make lint                   # Runs black, isort, flake8, front-eslint, bff-eslint
make generate              # Introspect database schema with Drizzle after schema changes
make generate-types        # Generate GraphQL types after schema updates
```

**YOU MUST follow this workflow:**
1. Database changes → `make migrate` → `make generate` → `make generate-types`
2. GraphQL schema changes → `make generate-types`
3. Code changes → `make lint` AND `make test` before committing
4. **After `make db-reset`**: Tenant schemas are automatically created and migrated

## Project Overview

Ligla Chat is a multi-tenant chat management system with **strict three-tier architecture**:

- **frontend** (port 8001): React SPA with Material-UI for operator interface. React 18 + TypeScript + Material-UI + Apollo Client
- **backend-bff** (port 3000): NestJS GraphQL API serving as backend-for-frontend. NestJS + GraphQL + Drizzle ORM (database-first introspection)
- **backend-core** (port 8000): FastAPI service handling message processing and external integrations. FastAPI + SQLAlchemy + Alembic (owns database schema)
- **functions**: Google Cloud Functions for data synchronization

**CRITICAL: Layer Communication Rules**
- Frontend ↔ BFF: GraphQL only
- BFF ↔ Core: REST/HTTP API only

## Essential Commands

**Daily Development:**
```bash
# Install all dependencies and start services
make install
# Start all services (after initial setup)
make up
# Stop all services
make down
# Database operations
make db-reset          # Reset DB, run migrations, and seed data (tenant-aware)
make migrate           # Run public schema migrations only
make seed-shared       # Seed shared tables (organizations, hypervisors, auth)
make seed-tenant       # Seed tenant tables (into org_* schemas)
```

**Code Quality (run before every commit):**
```bash
make lint                  # Format and lint all services
make black                 # Python: format (120 char limit)
make isort                 # Python: sort imports
make flake8               # Python: lint
make front-eslint         # Frontend: ESLint + auto-fix
make bff-eslint           # BFF: ESLint + auto-fix
```

**Code Generation (after schema changes):**
```bash
make generate             # BFF: Introspect database schema with Drizzle (runs drizzle:introspect + post-processing)
make generate-types       # Frontend: Generate GraphQL types from BFF GraphQL schema
```

**Database Operations:**
```bash
make migrate              # Apply Alembic migrations to public schema
make autogenerate-migration m="msg" # Auto-generate migration for schema-per-tenant (replaces manual alembic revision)
make bash-back-core       # Access backend-core shell for manual operations
```

**Seed Operations:**
```bash
make seed                 # Re-seed all data (runs seed-shared + seed-tenant sequentially)
make seed-shared          # Seed shared tables only (organizations, hypervisors, auth)
make seed-tenant          # Seed tenant tables only (into org_* schemas)
make seed-core            # Python seed alternative (lightweight CLI seeder)
```

**Tenant Schema Operations:**
```bash
make create-tenant-schemas     # Create org_* schemas via alembic upgrade head
make tenant-upgrade-all        # Upgrade all tenant schemas to specific revision
make tenant-downgrade-all      # Downgrade all tenant schemas to specific revision
make tenant-validate           # Deep validation of all tenant schemas

# Legacy (one-time production migration from public_old → org_*, not for local dev)
make tenant-split              # Combined: upgrade + migrate from public_old + validate
make tenant-migrate            # Migrate data from public_old (DRY RUN)
make tenant-migrate-commit     # Migrate data from public_old (COMMIT mode)
```

**Testing:**
```bash
# Infrastructure management
make test-setup            # Start test infrastructure (postgres-test, storage-emulator)
make test-teardown         # Stop test infrastructure
make test-clear            # Full cleanup (remove containers and volumes)
make test-db-reset         # Reset test database (truncate all tables and re-migrate)

# Running tests
make test-unit             # Run unit tests (no database required)
make test-e2e              # Run all E2E tests (fast mode, reuses infrastructure)
make test-e2e-%            # Run specific E2E test module (e.g., make test-e2e-chat)
make test                  # Run all tests (unit + e2e)

# Clean mode (for CI or troubleshooting)
make test-e2e-clean        # Run all E2E tests with full rebuild
make test-e2e-clean-%      # Run specific E2E test with full rebuild
make test-clean            # Run all tests (unit + e2e) with full rebuild
```

**Individual Services:**
```bash
make up-core              # Start backend-core only
make up-front             # Start frontend only
make bff-install          # Install BFF dependencies
make front-install        # Install frontend dependencies
```

## Architecture & Core Patterns

**Service Responsibilities:**
- **backend-core**: Database schema owner, message processing, Pub/Sub, GCP integrations
- **backend-bff**: GraphQL API, authentication, authorization, real-time SSE
- **frontend**: React SPA, user interface, Apollo Client GraphQL consumer

**CRITICAL Architectural Rules:**
1. **Database Schema**: Only backend-core modifies database schema via Alembic
2. **BFF Database Access**: BFF uses Drizzle ORM introspection (read-only schema, database-first approach)
3. **Data Flow**: Frontend → BFF (GraphQL) → Core (REST) → Database
4. **Real-time**: BFF provides SSE for chat updates to frontend
5. **Authentication**: JWT-based with role-based access control (ADMIN, MANAGER, OPERATOR)

## Code Style & Standards

**IMPORTANT: Follow these patterns religiously:**

**Backend-Core (FastAPI/Python):**
- Line length: 120 characters (Black formatter)
- Type hints required for all functions
- Async-first design (migrate from current sync)
- Repository pattern with CRUD base classes
- Domain-driven service structure: `services/[domain]/router.py|service.py|repository/|schemas/`
- Column naming: `camelCase` (createdAt, organizationName)

**Backend-BFF (NestJS/TypeScript):**
- Modular architecture with strict module boundaries
- Code-first GraphQL with NestJS decorators
- Drizzle ORM database-first approach (introspection with post-processing)
- Dependency injection: `@InjectDrizzle() private readonly db: DrizzleDB`
- Query patterns: Relational queries with `.query` API and SQL builder with drizzle-orm operators
- Role-based guards: `@UseGuards(AuthGuard, OrganizationGuard, RoleGuard)`
- Multi-tenancy: Always include `organizationName` filtering
- File naming: `kebab-case` (user.service.ts, create-user.input.ts)

**Frontend (React/TypeScript):**
- Functional components with React.memo and displayName
- Domain-driven modules: `modules/[Domain]/components|hooks|graphql|types`
- Material-UI with sx prop and styled components
- React Hook Form + Zod validation
- Apollo Client with type-safe generated hooks
- Path aliases: `~/` for clean imports

## File Organization Patterns

**Backend-Core Service Structure:**
```
services/[domain]/
├── router.py                   # FastAPI routes with dependency injection
├── service.py                  # Business logic, orchestrates repository calls
├── dependencies.py             # Domain-specific dependency injection
├── repository/[entity].py      # CRUD operations, extends CRUDBase
├── schemas/[entity].py         # Pydantic models for validation
└── errors.py                   # Custom domain exceptions
```

**Backend-BFF Module Structure:**
```
modules/[domain]/
├── [domain].module.ts          # NestJS module with providers
├── [domain].resolver.ts        # GraphQL resolvers with guards
├── [domain].service.ts         # Business logic with Drizzle ORM
├── dto/create-[domain].input.ts # GraphQL input types
├── entities/[domain].entity.ts  # GraphQL object types
```

**Frontend Module Structure:**
```
modules/[Domain]/
├── components/                 # Feature-specific UI components
├── configs/formSchema.ts       # Zod validation schemas
├── graphql/[domain].graphql    # GraphQL operations
├── hooks/use[Domain]Actions.tsx # Custom business logic hooks
├── page/index.tsx              # Route component
├── types/[domain].ts           # TypeScript types
```

## Development Workflow & Best Practices

**CRITICAL Workflow Steps:**
1. **Database Schema Change** (existing table): Edit backend-core models → `make autogenerate-migration m="message"` → review generated migration → `make migrate` → `make tenant-upgrade-all REV=head` → `make generate` → `make generate-types`
2. **Adding a New Table**: Before generating migrations, register in two places:
   - Define model in `backend-core/app/db/models.py`
   - Add table name to correct set in `backend-core/app/db/migration_constants.py`
   - `autogenerate_migration.py` raises an error if the table is missing from both sets — safety gate by design
   - `alembic/env.py` reads from `migration_constants.py` dynamically — no manual env.py edits needed
   - **Tenant table** (org-specific data): inherit `TenantBase`, add to `TENANT_TABLES` → then `make migrate` + `make tenant-upgrade-all REV=head`
   - **Shared table** (global data): inherit `SharedBase`, add to `SHARED_TABLES` → then `make migrate` only (no tenant-upgrade needed)
   - **Two `TENANT_TABLES`**: `migration_constants.py` (set, for DDL filtering — always update) vs `tenant_migration_config.py` (list[TableSpec], only for legacy data migration from public_old)
3. **GraphQL Schema Change**: Edit BFF resolvers/entities → `make generate-types`
4. **Before Every Commit**: `make lint` AND `make test` (formats, lints, and tests all services)

**Environment Setup:**
- Required: Python 3.13+, Node 20+ LTS, Docker, make command
- Config: `cp secret/.env.example secret/.env` + GCP credentials
- Dependencies: uv (backend-core), npm (frontend/BFF)

**Testing Approach:**
- **Backend-Core**: pytest (installed but not implemented yet)
- **Backend-BFF**: Comprehensive Jest + supertest implementation
  - **Unit Tests**: Service-level tests with mocks (config: `test/jest-unit.json`)
  - **E2E Tests**: 29 test suites covering all major modules (config: `test/jest-e2e.json`)
  - **Test Utilities**: TestSetup, GraphQLClient, AuthHelper, TestDataFactory, DatabaseCleaner
  - **Coverage**: HTML, LCOV, JSON reports to `test/coverage-e2e/` and `test/coverage-unit/`
  - **Infrastructure**: Docker Compose (`docker-compose.test.yml`) with postgres-test and storage-emulator
- **Frontend**: React Testing Library (configured, needs implementation)
- **Integration**: Isolated test database with automated setup/teardown via make commands

**Key File Locations:**
- Database models: `backend-core/app/db/models.py` (source of truth)
- Drizzle schema: `backend-bff/drizzle/schema.ts` (auto-generated via introspection)
- Drizzle relations: `backend-bff/drizzle/relations.ts` (auto-generated, post-processed)
- Drizzle partitioned tables: `backend-bff/drizzle/tables/partitioned.ts` (manually maintained)
- Drizzle config: `backend-bff/drizzle.config.ts`
- Post-introspection script: `backend-bff/scripts/post-introspect.ts` (fixes relations, adds partitioned tables)
- GraphQL schema: `backend-bff/src/schema.gql` (auto-generated)
- Frontend types: `frontend/src/generated/graphql/types.ts` (auto-generated)
- Migrations: `backend-core/alembic/versions/`
- Migration autogenerate: `backend-core/scripts/autogenerate_migration.py` (schema-per-tenant aware)
- Seed data (TypeScript): `backend-bff/seeds/sample.seed.ts` (two-phase: shared + per-tenant)
- Seed data (Python): `backend-core/scripts/seed_tenant_data.py` (lightweight CLI alternative)
- Tenant schema utils: `backend-bff/seeds/schema-utils.ts` (org schema derivation)
- Test configs: `backend-bff/test/jest-unit.json`, `backend-bff/test/jest-e2e.json`
- Test utilities: `backend-bff/test/utils/` (test-setup.ts, auth-helper.ts, graphql-client.ts, test-data-factory.ts, database-cleaner.ts)

## Domain & Business Context

**Multi-tenant Architecture:**
- Schema-per-tenant: each organization gets its own PostgreSQL schema (`org_<uuid>`)
- Shared tables in `public` schema: organization, auth, hypervisorUser, organizationMigration
- Tenant tables in `org_*` schemas: user, team, store, chat, chatMessage, etc. (no `organizationName` column)
- Role-based access: ADMIN, MANAGER, OPERATOR with team assignments
- Soft deletion pattern: `isActive` boolean flags
- Audit trails: `createdAt`, `updatedAt`, `archivedBy` fields

**Core Entities:**
- **Organization**: Multi-tenant root with LIFF integration
- **User**: Role-based with team assignments and authentication
- **Team**: Organizational units with store and chat assignments
- **Store**: Physical/logical entities integrated with Ligla platform
- **Chat**: Central entity with status flow (PENDING → ADDRESSING → DONE)
- **ChatMessage**: Messages with content types and activity tracking

**Chat Status Flow:**
- PENDING: New unassigned chats
- ADDRESSING: Assigned to operator/team
- DONE: Completed conversations

**Technology Stack Summary:**
- **Backend-Core**: FastAPI + SQLAlchemy + Alembic + GCP (Pub/Sub, Storage, Secret Manager)
- **Backend-BFF**: NestJS + GraphQL + Drizzle ORM + Apollo Server + SSE + Jest (E2E/Unit Testing)
- **Frontend**: React 18 + TypeScript + Material-UI + Apollo Client + Vite
- **Database**: PostgreSQL with multi-tenant isolation
- **Real-time**: Server-Sent Events (SSE) for chat updates
- **Deployment**: Docker + Google Cloud Run

## Common Issues & Solutions

**Database Schema Changes:**
- Always run: Database change → `make autogenerate-migration m="msg"` → review migration → `make migrate` → `make tenant-upgrade-all REV=head` → `make generate` → `make generate-types`
- If Drizzle introspection fails: Check backend-core database connection and `drizzle.config.ts`
- Post-introspection script: Automatically fixes 1-to-1 relations, adds partitioned tables, removes SQL/meta files
- Never manually edit: `drizzle/schema.ts` or `drizzle/relations.ts` (auto-generated)
- Manually maintain: `drizzle/tables/partitioned.ts` for partitioned tables
- Migration conflicts: Resolve in alembic versions, never edit generated migrations directly

**GraphQL Schema Sync Issues:**
- Frontend types out of sync: Run `make generate-types` after BFF resolver changes
- Schema generation fails: Check BFF GraphQL decorators and entity definitions
- Apollo cache issues: Clear cache in browser dev tools or restart frontend

**Common Development Errors:**
- "Drizzle schema not generated": Run `make generate` (includes introspection + post-processing)
- "Drizzle introspection errors": Check `drizzle.config.ts` and database connection
- "GraphQL types not found": Run `make generate-types`
- "Import errors after schema change": Restart TypeScript language server
- "Authentication errors": Check JWT token validity and role assignments
- "CORS errors": Verify backend-bff CORS configuration

**Tenant Schema Issues:**
- "No tenant schemas found": Run `make create-tenant-schemas` (or `make db-reset` for full reset)
- "Enum type does not exist": Run `make tenant-upgrade-all REV=head` to apply latest migrations
- "Type mismatch" errors: Check migration `a8c51c4f7c30_fix_tenant_schema_enum_types.py` was applied
- After `make db-reset`: Tenant schemas are automatically created and seeded directly (no tenant-split)
- Validation failures: Run `make tenant-validate` to check row counts and checksums
- Migration `a8c51c4f7c30` fixes enum issues:
  - Creates missing `contenttype` enum in tenant schemas
  - Fixes `chatMessage.type` and `chatReplyMessageTemplate.type` to use schema-specific enums
  - Fixes `chat.chatStatus` to use schema-specific `chatstatus` enum

**Testing Issues:**
- Test infrastructure not running: Run `make test-setup` before `make test-e2e`
- Tests failing randomly: Run `make test-db-reset` to clear test database state
- Port conflicts (5433): Stop existing postgres-test with `make test-teardown`
- Stale test data: Run `make test-clear` for full cleanup (removes volumes)
- Single test debugging: Use `make test-e2e-[module]` (e.g., `make test-e2e-chat`)
- Coverage not generating: Check `test/jest-e2e.json` and `test/jest-unit.json` coverage settings

**Testing & Debugging:**
- Backend-Core: Use `make bash-back-core` for shell access and debugging
- Backend-BFF Tests: Use `make test-e2e-[module]` for focused testing (e.g., `make test-e2e-chat`)
- Test Database: Access via `docker compose -f docker-compose.test.yml exec postgres-test psql -U test_user -d ligla_chat_test`
- Test Infrastructure Logs: `docker compose -f docker-compose.test.yml logs -f [service]`
- GraphQL Playground: Available at `http://localhost:3000/graphql`
- Database inspection: Direct PostgreSQL connection or Drizzle Studio
- Real-time debugging: Monitor SSE connections in browser Network tab
- Coverage reports: View HTML reports in `backend-bff/test/coverage-e2e/` or `backend-bff/test/coverage-unit/`

**Repository Etiquette:**
- Never commit without running `make lint` and `make test` (or at minimum relevant test suite)
- Always test changes across service boundaries
- Use descriptive commit messages with context
- Run `make db-reset` for clean testing environment
- Check all three services start correctly after changes
- For BFF changes: Run `make test-e2e` to verify GraphQL resolvers and services
- For schema changes: Always verify both `make generate` and `make generate-types` succeed
- Clean test runs: Use `make test-clean` before creating PRs to ensure reproducibility
