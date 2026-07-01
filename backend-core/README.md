# `backend-core`

`backend-core` is the main backend service for our system, built with **FastAPI**. It’s organized to make each part (like user management or chat) easy to manage and maintain, while everything works together in one app.

## Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Pre-Setup](#pre-setup)
- [Running the App](#run-the-application)
- [Database Migrations](#database-migration-on-local)

## Overview

`backend-core` is structured to separate each service's code (like chat and user management) into modular pieces. This makes it easy to add new features or update existing ones without touching the whole system.

## Project Structure

```plaintext
   backend-core/
   ├── alembic/
   ├── app/
   │   ├── common/
   │   ├── config/
   │   ├── db/
   │   ├── libs/
   │   ├── services/
   │   └── main.py
   ├── secret/
   ├── Dockerfile
   ├── Makefile
   ├── README.md
   └── pyproject.toml
```

## Getting Started

### Prerequisites

- [Install `Python 3.13+`](https://www.python.org/)
- [Install `uv`](https://docs.astral.sh/uv/)
- [Install `Docker`, `docker-compose`](https://docs.docker.com/get-docker/)
- Install `make` command. [Windows](https://stackoverflow.com/questions/32127524/how-to-install-and-use-make-in-windows), [Linux](https://askubuntu.com/questions/161104/how-do-i-install-make) and [Mac](https://stackoverflow.com/questions/10265742/how-to-install-make-and-gcc-on-a-mac)

### Installation on Local Environment

1. Make sure the `.env` file is [configured](../README.md#setup).

2. Install dependencies:

   ```sh
   cd backend-core
   uv sync
   ```

3. pre-commit:

   ```sh
   pre-commit install
   ```

### Run the Application

[Follow the setup section in the main README.](../README.md#setup)

## **Database migration on local**

- If you add a new model in `app/db/models.py` or in `services` folder, register it in `app/db/base.py`.

- Auto-generate migration for schema-per-tenant architecture:

```sh
# From project root — generates migration with proper public/tenant schema guards
make autogenerate-migration m="your migration message"

# Options:
make autogenerate-migration m="msg" OPTS="--dry-run"      # Preview without generating
make autogenerate-migration m="msg" OPTS="--tenant-only"   # Only tenant table changes
make autogenerate-migration m="msg" OPTS="--public-only"   # Only shared table changes
```

- Review the generated file in `backend-core/alembic/versions/`, then apply:

```sh
make migrate                        # Apply to public schema
make tenant-upgrade-all REV=head    # Apply to all tenant schemas
make generate                       # Re-introspect Drizzle schema
make generate-types                 # Regenerate GraphQL types
```

## Tenant Schema Operations

Schema-per-tenant architecture isolates each organization's data in `org_<uuid>` schemas.

### Upgrade / Downgrade (DDL)

```sh
make tenant-upgrade-all REV=head        # Upgrade all tenant schemas to HEAD (or specific REV)
make tenant-downgrade-all REV=<rev>     # Downgrade all tenant schemas to specific revision
```

### Data Migration (legacy: public_old → org_*)

```sh
make tenant-migrate                     # Dry-run migration from public_old
make tenant-migrate-commit              # Commit migration
make tenant-rollback                    # Dry-run rollback
make tenant-rollback-commit             # Commit rollback
```

### Validate

```sh
make tenant-validate                    # Deep validation of all tenant schemas
```

### Other

```sh
make create-tenant-schemas              # Create org_* schemas via alembic upgrade head
make db-reset                           # Full reset: migrate + create tenant schemas + seed
```

## Adding a New Table

Before generating migrations, every new table must be registered in two places:
1. **`app/db/models.py`** — Define the SQLAlchemy model
2. **`app/db/migration_constants.py`** — Add table name to the correct set

`autogenerate_migration.py` will raise an error if the table is missing from both sets — this is the safety gate.

`alembic/env.py` reads from `migration_constants.py` dynamically — no manual env.py edits needed for new tables.

### Tenant Table (lives in each `org_*` schema)

Use when the table holds organization-specific data (chats, users, teams, stores, etc.).

1. Define model inheriting **`TenantBase`** in `app/db/models.py`
2. Add table name to **`TENANT_TABLES`** set in `app/db/migration_constants.py`
3. Generate and apply:

```sh
make autogenerate-migration m="add tableName"
# Review migration in alembic/versions/
make migrate                        # public schema
make tenant-upgrade-all REV=head    # all org_* schemas
make generate                       # Drizzle introspection
make generate-types                 # GraphQL types
```

### Shared Table (lives in `public` schema only)

Use when the table is global across all organizations (auth, hypervisorUser, organization, etc.).

1. Define model inheriting **`SharedBase`** in `app/db/models.py`
2. Add table name to **`SHARED_TABLES`** set in `app/db/migration_constants.py`
3. Generate and apply:

```sh
make autogenerate-migration m="add tableName"
# Review migration in alembic/versions/
make migrate                        # public schema only
make generate
make generate-types
```

No `tenant-upgrade-all` needed — shared tables exist only in `public`.

### Two `TENANT_TABLES` in the codebase

- **`migration_constants.py:TENANT_TABLES`** (set) — used by `env.py` and `autogenerate_migration.py` for DDL filtering. **Always update this.**
- **`tenant_migration_config.py:TENANT_TABLES`** (list[TableSpec]) — used only for legacy data migration ordering from `public_old`. Only update if you need to migrate existing data from the old schema.
