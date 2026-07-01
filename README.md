# Ligla chat

A monorepo powered by **FastAPI**, **NestJS**, **Vite + React**, and **Google Cloud Functions**.

**Tech Stack:**
- **Backend-Core**: FastAPI + SQLAlchemy + Alembic (owns database schema)
- **Backend-BFF**: NestJS + GraphQL + Drizzle ORM + Jest (E2E/Unit Testing)
- **Frontend**: React 18 + TypeScript + Material-UI + Apollo Client + Vite
- **Database**: PostgreSQL with multi-tenant isolation
- **Testing**: Jest (BFF E2E/Unit), pytest (Core - planned)

For a detailed overview of the project requirements, technical considerations, and high-level design, refer to the relevant sections hosted on Notion:

> [Chat System Integration with Ligla](https://www.notion.so/timetechnologies/WIP-Chat-System-Integration-with-Ligla-aa1c80b2c5f04c0a8b2873092235a2da)

## Project Structure

```plaintext

/ligla-chat
│
├── backend-core/     # FastAPI service for core logic (BE)
├── backend-bff/      # NestJS service as backend-for-frontend (BFF)
├── frontend/         # Vite + React app for operator interface (UI)
├── functions/        # Google Cloud Functions (e.g., store data sync)
├── secret/           # Project secrets and environment files
├── .dockerignore
├── .gitignore
├── makefile
├── docker-compose.yml            # Base Docker setup
├── docker-compose.test.yml       # Test environment config
├── docker-compose.stg.yml        # Staging Docker config
├── docker-compose.prd.yml        # Production Docker config
└── README.md                     # Project overview (this file)

```

## Getting Started

### Prerequisites

- [Install `Python 3.13`](https://www.python.org/),
- [Install `uv`](https://docs.astral.sh/uv/),
- [Install `node 22.11`](https://nodejs.org/en),
- [Install `Docker`, `docker-compose`](https://docs.docker.com/get-docker/)
- Install `make` command. [Windows](https://stackoverflow.com/questions/32127524/how-to-install-and-use-make-in-windows), [Linux](https://askubuntu.com/questions/161104/how-do-i-install-make) and [Mac](https://stackoverflow.com/questions/10265742/how-to-install-make-and-gcc-on-a-mac)

### Setup

1. Configure `.env` file.

   ```sh
   cp secret/.env.example secret/.env
   ```

   Note: Make sure to add the following VAPID keys in your .env file:
   - VAPID_PUBLIC_KEY
   - VITE_VAPID_PUBLIC_KEY
   - VAPID_PRIVATE_KEY

   To generate VAPID keys for local use, run

   ```sh
   npx web-push generate-vapid-keys --json
   ```

2. Configure Google Cloud credentials file:
   - Create credentials.json in the `secret/` folder for GCP authentication
   - This file is required for accessing GCP services like Secret Manager and Storage


3. Install dependencies & start services. See [Makefile](./Makefile) for more detailed commands.

   ```sh
   make install
   ```

4. Access your services:
   - backend-core: <http://localhost:8000/docs>
   - backend-bff: <http://localhost:3000/api>
   - frontend: <http://localhost:8001>

### Development Guidelines

#### Pre-commit Hooks

The project uses automated pre-commit hooks to ensure code quality before commits. Hooks run automatically on staged files and apply auto-fixes where possible.

**What's included:**
- **Backend-core**: Black (formatting) → isort (imports) → flake8 (linting)
- **Frontend**: ESLint with auto-fix
- **Backend-BFF**: ESLint
- **All files**: Syntax checks, trailing whitespace, line endings

**Quick Start:**
```sh
# Automatically installed during `make install`
# Or install manually:
make setup-precommit
```

**Common Commands:**
```sh
# Normal commit (hooks run automatically)
git commit -m "your message"

# Run hooks manually on all files
make precommit-run

# Run hooks on staged files only
make precommit-check

# Skip hooks (emergency only - use sparingly!)
git commit --no-verify -m "emergency fix"

# Update hook versions
make precommit-update

# Clean pre-commit cache
make precommit-clean
```

**How it works:**
1. Fast syntax checks run first (JSON, YAML, merge conflicts)
2. Docker-based linters run on each service independently
3. Auto-fixes are applied (Black, isort, ESLint --fix)
4. Commit proceeds only if all checks pass

**Troubleshooting:**

Common issues and solutions:

1. **Hook fails with code errors:**
   - Review the error output carefully
   - Fix the reported issues in your code
   - Stage the fixes: `git add .`
   - Try committing again

2. **`ModuleNotFoundError: No module named '_sqlite3'`:**
   - Your Python was built without SQLite support
   - **Fix**: Rebuild Python with SQLite
     ```sh
     sudo apt-get install libsqlite3-dev
     pyenv install 3.13.3 --force

     # Reinstall dependencies:
     uv sync
     ```

3. **Need to bypass hooks?**
   - Use `--no-verify` only for emergencies
   - Example: `git commit --no-verify -m "emergency fix"`
   - Note: This should be rare - fix the issues instead!

4. **Hooks not running automatically?**
   - Reinstall: `make setup-precommit`
   - Check git hooks: `ls -la .git/hooks/pre-commit`

5. **Docker containers not starting for linting:**
   - Ensure services are built: `make build`
   - Check Docker is running: `docker ps`

## Service instructions

Each part of project has its own README.md for independent setup and development instructions:

- [Core README](./backend-core/README.md)
- [BFF README](./backend-bff/README.md)
- [UI README](./frontend/README.md)
- [Cloud Functions README](./functions/datasync/README.md)

---

## Makefile commands

See the [Makefile](./Makefile) for more detailed commands.

1. install & start

```sh
make install
```

2. Db reset and seed (tenant-aware — seeds directly into org_* schemas)

```sh
make db-reset
```

3. Database migrations

```sh
make migrate                          # Apply public schema migrations
make autogenerate-migration m="add column foo"  # Auto-generate migration for schema-per-tenant
make tenant-upgrade-all REV=head      # Apply migrations to all tenant schemas
```

4. Build image

```sh
make build
```

5. Start container

```sh
make up
```

6. Stop container

```sh
make down
```

7. Introspects the database schema with Drizzle ORM and runs post-processing (generates backend-bff/drizzle/schema.ts and relations.ts).

```sh
make generate
```

8. Runs the graphql-codegen inside the frontend (based on frontend/codegen.yml file).

```sh
make generate-types
```

9. Set up pre-commit hooks for code quality

```sh
make setup-precommit
```

10. Run pre-commit hooks manually on all files

```sh
make precommit-run
```

11. Run pre-commit hooks on staged files only

```sh
make precommit-check
```

12. Update pre-commit hook versions

```sh
make precommit-update
```

13. Clean pre-commit cache

```sh
make precommit-clean
```

14. Uninstall pre-commit hooks

```sh
make precommit-uninstall
```

### Testing Commands

15. Set up test infrastructure (postgres-test, storage-emulator)

```sh
make test-setup
```

16. Run unit tests

```sh
make test-unit
```

17. Run all E2E tests

```sh
make test-e2e
```

18. Run specific E2E test module (e.g., chat, user, team)

```sh
make test-e2e-chat      # Run chat module tests
make test-e2e-user      # Run user module tests
make test-e2e-team      # Run team module tests
```

19. Run all tests (unit + e2e)

```sh
make test
```

20. Run all tests with full infrastructure rebuild (for CI or troubleshooting)

```sh
make test-clean
```

21. Reset test database (truncate all tables and re-migrate)

```sh
make test-db-reset
```

22. Stop and remove test infrastructure

```sh
make test-teardown
```

23. Full test cleanup (remove containers and volumes)

```sh
make test-clear
```
