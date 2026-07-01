folder=$(shell basename $(CURDIR))

# Variables for common commands
DC = docker compose -f docker-compose.yml --env-file ./secret/.env
DC_STG = docker compose -f docker-compose.stg.yml --env-file ./secret/.env.stg
DC_PRD = docker compose -f docker-compose.prd.yml --env-file ./secret/.env.prd

RUN_CORE = $(DC) run --rm backend-core
EXEC_PG = $(DC) exec -T postgres psql -U ligla_user -d ligla_local
SCHEMA_PREFIX = org_
WORKERS ?= 2

GET_TENANT_SCHEMAS = $(EXEC_PG) -Atc "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE '$(SCHEMA_PREFIX)%' OR schema_name = 'tenant_template' ORDER BY schema_name"

# Cleanup
clear-dist:
	rm -rf backend-bff/dist
	rm -rf frontend/build

clear-db:
	docker volume rm -f ligla_chat_db_data
	docker volume rm -f ligla_chat_dev_db_data

clear-front:
	@echo "Cleaning frontend node_modules volumes..."
	@for env in "" "_stg" "_prd"; do \
		docker volume rm -f ligla_chat_bff_node_modules$$env ligla_chat_front_node_modules$$env; \
		docker volume rm -f ligla_chat_dev_bff_node_modules$$env ligla_chat_dev_front_node_modules$$env; \
	done

clear-pycache:
	@echo "Cleaning Python __pycache__ directories..."
	@find . -type d -name "__pycache__" -prune -exec rm -rf {} +

clear: clear-dist clear-db clear-front


######################## LOCAL ENVIRONMENT #############################

build:
	$(DC) build

build-core:
	$(DC) build backend-core

up:
	$(DC) up

up-core:
	$(DC) up backend-core

up-back:
	$(DC) up -d

up-front:
	$(DC) up frontend

down:
	$(DC) down

bash-back-core:
	$(RUN_CORE) bash

migrate-reset:
	$(DC) up -d postgres
	@until $(DC) exec -T postgres pg_isready -U ligla_user -d ligla_local > /dev/null 2>&1; do sleep 1; done
	$(EXEC_PG) -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO ligla_user;"

migrate:
	$(RUN_CORE) sh -c 'alembic -x tenant=public upgrade head'

# Auto-generate migration for schema-per-tenant architecture
# Usage: make autogenerate-migration m="add senderName to chat"
# Options: OPTS="--table chatBookmark" or OPTS="--tenant-only" or OPTS="--public-only" or OPTS="--dry-run"
autogenerate-migration:
ifndef m
	$(error m is required. Usage: make autogenerate-migration m="describe change")
endif
	$(RUN_CORE) sh -c 'uv run python scripts/autogenerate_migration.py -m "$(m)" $(OPTS)'

upgrade:
	$(RUN_CORE) alembic upgrade $(if $(ARGS),$(ARGS),head)

downgrade:
	$(RUN_CORE) sh -c 'alembic -x target_rev=$(if $(ARGS),$(ARGS),-1) downgrade $(if $(ARGS),$(ARGS),-1)'

# Tenant DDL (per-schema alembic)
# Usage: make tenant-upgrade-all REV=head
tenant-upgrade-all:
	@schemas=$$($(GET_TENANT_SCHEMAS)); \
	if [ -z "$$schemas" ]; then echo "ERROR: No tenant schemas found"; exit 1; fi; \
	for schema in $$schemas; do \
	  echo "Upgrading $$schema to $(REV)"; \
	  $(RUN_CORE) sh -c "alembic -x tenant=$$schema upgrade $(REV)" || exit 1; \
	done

# Usage: make tenant-downgrade-all REV=<revision>
# Examples: make tenant-downgrade-all REV=-1  (back 1 step)
#           make tenant-downgrade-all REV=bed1606bcfa9  (specific revision)
tenant-downgrade-all:
	@schemas=$$($(GET_TENANT_SCHEMAS)); \
	if [ -z "$$schemas" ]; then echo "ERROR: No tenant schemas found"; exit 1; fi; \
	for schema in $$schemas; do \
	  echo "Downgrading $$schema to $(REV)"; \
	  $(RUN_CORE) sh -c "alembic -x tenant=$$schema -x skip_public_migration=true -x force=true downgrade $(REV)" || exit 1; \
	done

tenant-validate:
	$(RUN_CORE) uv run --group db-jobs python -m jobs.tenant_manager.validate --deep

# ---- LEGACY: Production data migration (public_old → org_*) ----
# These commands are for one-time production cutover only. Not used in local dev.
# For local dev, use: make db-reset
tenant-split:
	$(RUN_CORE) uv run alembic upgrade bed1606bcfa9
	$(RUN_CORE) uv run --group db-jobs python -m jobs.tenant_manager.migrate_data --source public_old --commit
	$(RUN_CORE) uv run --group db-jobs python -m jobs.tenant_manager.validate --deep

tenant-migrate:
	$(RUN_CORE) uv run --group db-jobs python -m jobs.tenant_manager.migrate_data --source public_old

# Usage: make tenant-migrate-commit WORKERS=4
tenant-migrate-commit:
	$(RUN_CORE) uv run --group db-jobs python -m jobs.tenant_manager.migrate_data --source public_old --commit --workers $(WORKERS)

tenant-rollback:
	$(RUN_CORE) uv run --group db-jobs python -m jobs.tenant_manager.migrate_data_back

tenant-rollback-commit:
	$(RUN_CORE) uv run --group db-jobs python -m jobs.tenant_manager.migrate_data_back --commit
# ---- END LEGACY ----

tenant-encrypt:
	$(RUN_CORE) uv run --group db-jobs python -m jobs.tenant_manager.encrypt_data

# Usage: make tenant-encrypt-commit WORKERS=4
tenant-encrypt-commit:
	$(RUN_CORE) uv run --group db-jobs python -m jobs.tenant_manager.encrypt_data --commit --workers $(WORKERS)

tenant-decrypt:
	$(RUN_CORE) uv run --group db-jobs python -m jobs.tenant_manager.decrypt_data

# Usage: make tenant-decrypt-commit WORKERS=4
tenant-decrypt-commit:
	$(RUN_CORE) uv run --group db-jobs python -m jobs.tenant_manager.decrypt_data --commit --workers $(WORKERS)

tenant-chat-search-indexes:
	$(RUN_CORE) uv run --group db-jobs python -m jobs.tenant_manager.create_chat_search_indexes

# Usage: make tenant-chat-search-indexes-commit WORKERS=4
tenant-chat-search-indexes-commit:
	$(RUN_CORE) uv run --group db-jobs python -m jobs.tenant_manager.create_chat_search_indexes --commit --workers $(WORKERS)

# Schema cleanup (used by db-reset)
clean-schemas:
	-$(EXEC_PG) -c "DROP SCHEMA IF EXISTS public_old CASCADE"
	-$(EXEC_PG) -c "DROP SCHEMA IF EXISTS tenant_template CASCADE"
	@schemas=$$($(GET_TENANT_SCHEMAS)); \
	if [ -n "$$schemas" ]; then \
		for schema in $$schemas; do \
			$(EXEC_PG) -c "DROP SCHEMA IF EXISTS \"$$schema\" CASCADE"; \
		done; \
	fi

generate:
	$(DC) run --rm backend-bff npm run drizzle:introspect

# Seed all (two-phase: shared tables first, then tenant tables)
seed: seed-shared seed-tenant

# Seed shared tables only (organizations, hypervisors, auth)
seed-shared:
	$(DC) run --rm -e SEED_PHASE=shared backend-bff npm run seed:sample

# Seed tenant tables only (into org_* schemas)
seed-tenant:
	$(DC) run --rm -e SEED_PHASE=tenant backend-bff npm run seed:sample

# Create tenant schemas for all known organizations (also upgrades public if needed)
create-tenant-schemas:
	$(RUN_CORE) sh -c 'alembic upgrade head'

# Python seed alternative (lightweight CLI seeder)
seed-core:
	$(RUN_CORE) uv run python scripts/seed_tenant_data.py

generate-types:
	$(DC) run --rm frontend npm run generate

# Reset workflows
# Seeds directly into org_* schemas (no tenant-split needed)
db-reset: down migrate-reset clean-schemas migrate seed-shared create-tenant-schemas seed-tenant down up

# Code quality
back-lint:
	$(DC) run --rm -T backend-core black --extend-exclude alembic --line-length 120 app
	$(DC) run --rm -T backend-core isort --skip alembic --profile black app
	$(DC) run --rm -T backend-core flake8 app
	$(DC) run --rm -T backend-core ruff check --fix app

front-eslint:
	$(DC) run --rm -T frontend npm run lint:fix

bff-eslint:
	$(DC) run --rm -T backend-bff npm run lint

lint: back-lint front-eslint bff-eslint

######################## TESTING #############################

# Infrastructure management
test-setup:
	@echo "Starting test infrastructure..."
	docker compose -f docker-compose.test.yml up -d postgres-test storage-emulator-test
	@echo "Waiting for services to be healthy..."
	docker compose -f docker-compose.test.yml run --rm storage-init-test
	docker compose -f docker-compose.test.yml run --rm test-migrate
	@echo "Test infrastructure ready!"

test-teardown:
	@echo "Stopping test infrastructure..."
	docker compose -f docker-compose.test.yml down

test-clear:
	@echo "Full cleanup: removing containers and volumes..."
	docker compose -f docker-compose.test.yml down -v
	docker volume rm -f ligla_chat_test_db_data 2>/dev/null || true
	docker volume rm -f ligla_chat_bff_test_node_modules 2>/dev/null || true

test-db-reset:
	@echo "Resetting test database..."
	docker compose -f docker-compose.test.yml exec -T postgres-test psql -U test_user -d ligla_chat_test -c "\
		DO \$$\$$ \
		DECLARE r RECORD; \
		BEGIN \
			FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP \
				EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE'; \
			END LOOP; \
		END \$$\$$;" 2>/dev/null || true
	docker compose -f docker-compose.test.yml run --rm test-migrate

# Unit tests (no database required)
test-unit:
	@echo "Running unit tests..."
	docker compose -f docker-compose.test.yml run --rm -e TEST_TYPE=unit test-runner
	docker compose -f docker-compose.test.yml down

# E2E tests - Fast mode (default, reuses infrastructure)
test-e2e:
	@echo "Running all E2E tests..."
	@if ! docker compose -f docker-compose.test.yml ps postgres-test | grep -q "Up"; then \
		echo "Test infrastructure not running. Starting it..."; \
		make test-setup; \
	fi
	docker compose -f docker-compose.test.yml run --rm -e TEST_TYPE=e2e test-runner

test-e2e-%:
	@echo "Running E2E test for module: $*"
	@if ! docker compose -f docker-compose.test.yml ps postgres-test | grep -q "Up"; then \
		echo "Test infrastructure not running. Starting it..."; \
		make test-setup; \
	fi
	docker compose -f docker-compose.test.yml run --rm -e TEST_TYPE=e2e -e TEST_FILE=$* test-runner

# E2E tests - Clean mode (full rebuild, for CI or troubleshooting)
test-e2e-clean: test-clear
	@echo "Running all E2E tests (clean mode)..."
	docker compose -f docker-compose.test.yml up -d postgres-test storage-emulator-test
	docker compose -f docker-compose.test.yml run --rm storage-init-test
	docker compose -f docker-compose.test.yml run --rm test-migrate
	docker compose -f docker-compose.test.yml run --rm -e TEST_TYPE=e2e test-runner
	docker compose -f docker-compose.test.yml down

test-e2e-clean-%: test-clear
	@echo "Running E2E test for module: $* (clean mode)"
	docker compose -f docker-compose.test.yml up -d postgres-test storage-emulator-test
	docker compose -f docker-compose.test.yml run --rm storage-init-test
	docker compose -f docker-compose.test.yml run --rm test-migrate
	docker compose -f docker-compose.test.yml run --rm -e TEST_TYPE=e2e -e TEST_FILE=$* test-runner
	docker compose -f docker-compose.test.yml down

# Run all tests (unit + e2e) - Fast mode
test:
	@echo "Running all tests (unit + e2e)..."
	@echo "\n==> Running unit tests..."
	docker compose -f docker-compose.test.yml run --rm -e TEST_TYPE=unit test-runner
	@echo "\n==> Running E2E tests..."
	@if ! docker compose -f docker-compose.test.yml ps postgres-test | grep -q "Up"; then \
		echo "Test infrastructure not running. Starting it..."; \
		make test-setup; \
	fi
	docker compose -f docker-compose.test.yml run --rm -e TEST_TYPE=e2e test-runner

# Run all tests (unit + e2e) - Clean mode
test-clean: test-clear
	@echo "Running all tests (unit + e2e) in clean mode..."
	@echo "\n==> Running unit tests..."
	docker compose -f docker-compose.test.yml run --rm -e TEST_TYPE=unit test-runner
	@echo "\n==> Running E2E tests..."
	docker compose -f docker-compose.test.yml up -d postgres-test storage-emulator-test
	docker compose -f docker-compose.test.yml run --rm storage-init-test
	docker compose -f docker-compose.test.yml run --rm test-migrate
	docker compose -f docker-compose.test.yml run --rm -e TEST_TYPE=e2e test-runner
	docker compose -f docker-compose.test.yml down

# Backend-core tests
test-back-core:
	@echo "Running backend-core tests..."
	cd backend-core && uv run pytest tests/ -v

# Pre-commit hook management
# Requires pre-commit to be installed: pip install pre-commit
# Note: Requires Python with SQLite support

# Install pre-commit hooks for team-wide development
setup-precommit:
	@echo "🔧 Setting up pre-commit hooks..."
	@if ! python3 -c "import sqlite3" 2>/dev/null; then \
		echo "❌ Python does not have SQLite support."; \
		echo ""; \
		echo "To fix this:"; \
		echo "  1. Install SQLite development libraries:"; \
		echo "     sudo apt-get install libsqlite3-dev"; \
		echo ""; \
		echo "  2. Rebuild Python with SQLite support:"; \
		echo "     pyenv install 3.13.3 --force"; \
		echo ""; \
		echo "  3. Recreate virtual environment:"; \
		echo "     # If using poetry:"; \
		echo "     poetry install"; \
		echo ""; \
		echo "     # If using venv:"; \
		echo "     rm -rf .venv && python3 -m venv .venv"; \
		echo "     source .venv/bin/activate && pip install pre-commit"; \
		echo ""; \
		exit 1; \
	fi; \
	if ! pip show pre-commit >/dev/null 2>&1; then \
		echo "📦 Installing pre-commit..."; \
		pip install pre-commit; \
	fi; \
	pre-commit install --install-hooks; \
	echo "✅ Pre-commit hooks installed successfully!"; \
	echo ""; \
	echo "Usage:"; \
	echo "  git commit              # Hooks run automatically"; \
	echo "  git commit --no-verify  # Skip hooks (emergency only)"; \
	echo "  make precommit-run      # Run hooks manually on all files"

# Run pre-commit hooks manually on all files
precommit-run:
	@echo "🔍 Running pre-commit hooks on all files..."
	@pre-commit run --all-files

# Run pre-commit hooks on staged files only
precommit-check:
	@echo "🔍 Running pre-commit hooks on staged files..."
	@pre-commit run

# Update pre-commit hook versions
precommit-update:
	@echo "📦 Updating pre-commit hook versions..."
	@pre-commit autoupdate
	@echo "✅ Pre-commit hooks updated. Review changes in .pre-commit-config.yaml"

# Uninstall pre-commit hooks
precommit-uninstall:
	@echo "🗑️  Uninstalling pre-commit hooks..."
	@pre-commit uninstall
	@echo "✅ Pre-commit hooks removed"

# Clean pre-commit cache
precommit-clean:
	@echo "🧹 Cleaning pre-commit cache..."
	@pre-commit clean
	@echo "✅ Pre-commit cache cleaned"


tenant-encrypt-if-configured:
	@if grep -q '^ENCRYPTION_MASTER_KEY=' ./secret/.env 2>/dev/null; then \
		echo "🔐 ENCRYPTION_MASTER_KEY configured in ./secret/.env, running tenant-encrypt..."; \
		$(MAKE) tenant-encrypt; \
	else \
		echo "⚠️  ENCRYPTION_MASTER_KEY not set in ./secret/.env; skipping tenant-encrypt. This is expected in fresh local setups."; \
	fi

install: clear-pycache down clear build migrate seed-shared create-tenant-schemas seed-tenant tenant-encrypt-if-configured generate down up setup-precommit

front-install:
	$(DC) run --rm frontend npm install

bff-install:
	$(DC) run --rm backend-bff npm install

define stop_old_gae_versions
	@echo "Stopping old GAE versions for $(2)..."
	@old_versions=$$(gcloud app versions list --project=$(1) --service=$(2) --filter="traffic_split=0" --format="value(id)" 2>/dev/null) && \
		[ -n "$$old_versions" ] && gcloud app versions stop $$old_versions --project=$(1) --service=$(2) --quiet 2>/dev/null || true
endef

# TODO: Refactor staging environment variables and commands to use development environment instead [phase 2][task 107265434]
##########################################################################
GCP_PROJECT_STG=tt-ligla-stg
GCP_REGION_STG=asia-northeast1
GCP_ARTIFACT_STG=chat-stg
GCP_ARTIFACT_VERSION_STG=latest
GCP_DB_INSTANCE_STG=tt-ligla-stg:asia-northeast1:chat-db-stg-instance
GCP_SECRET_NAME_STG=CHAT_ENV
GCP_SECRET_VERSION_STG=latest
GCP_CLOUD_RUN_NAME_STG=chat-core
GCP_DOCKER_IMAGE_TAG_STG=chat_core
SERVICE_ACCOUNT_STG=chat-staging@tt-ligla-stg.iam.gserviceaccount.com

######################## STAGING ENVIRONMENT #############################

stg-build: stg-down clear
	$(DC_STG) build

stg-up:
	$(DC_STG) up

stg-down:
	$(DC_STG) down

stg-migrate:
	$(DC_STG) run --rm backend-core-stg alembic upgrade head

stg-seed:
	$(DC_STG) run --rm backend-bff-stg npm run seed:sample

stg-bash-back-core:
	$(DC_STG) run --rm backend-core-stg bash

deploy-stg-core:
	@if ! gcloud artifacts repositories describe ${GCP_ARTIFACT_STG} --location=${GCP_REGION_STG} --project=${GCP_PROJECT_STG} > /dev/null 2>&1; then \
		gcloud artifacts repositories create ${GCP_ARTIFACT_STG} --repository-format=docker --location=${GCP_REGION_STG} --project=${GCP_PROJECT_STG}; \
	fi
	docker tag ${GCP_DOCKER_IMAGE_TAG_STG}:stg ${GCP_REGION_STG}-docker.pkg.dev/${GCP_PROJECT_STG}/${GCP_ARTIFACT_STG}/${GCP_DOCKER_IMAGE_TAG_STG}:${GCP_ARTIFACT_VERSION_STG}
	docker push ${GCP_REGION_STG}-docker.pkg.dev/${GCP_PROJECT_STG}/${GCP_ARTIFACT_STG}/${GCP_DOCKER_IMAGE_TAG_STG}:${GCP_ARTIFACT_VERSION_STG}
	gcloud run deploy ${GCP_CLOUD_RUN_NAME_STG} \
					--memory=1G --timeout=300 \
					--image=${GCP_REGION_STG}-docker.pkg.dev/${GCP_PROJECT_STG}/${GCP_ARTIFACT_STG}/${GCP_DOCKER_IMAGE_TAG_STG}:${GCP_ARTIFACT_VERSION_STG} \
					--add-cloudsql-instances=${GCP_DB_INSTANCE_STG} \
					--network=projects/${GCP_PROJECT_STG}/global/networks/ligla-vpc-stg \
					--subnet=projects/${GCP_PROJECT_STG}/regions/${GCP_REGION_STG}/subnetworks/ligla-vpc-stg-chat-backend \
					--vpc-egress=private-ranges-only \
					--update-secrets=ENV_VAR_NAME=${GCP_SECRET_NAME_STG}:${GCP_SECRET_VERSION_STG} \
					--min-instances=0 \
					--max-instances=2 \
					--service-account=${SERVICE_ACCOUNT_STG} \
					--concurrency=500 \
					--cpu-throttling \
					--execution-environment=gen2 \
					--platform=managed --ingress=internal --allow-unauthenticated \
					--region=${GCP_REGION_STG} --project=${GCP_PROJECT_STG} \
					--verbosity=info
	gcloud run services update-traffic ${GCP_CLOUD_RUN_NAME_STG} --to-latest --region=${GCP_REGION_STG} --project=${GCP_PROJECT_STG}

deploy-stg-bff:
	cd backend-bff; gcloud app deploy app.stg.yaml --service-account=${SERVICE_ACCOUNT_STG} --verbosity=debug
	$(call stop_old_gae_versions,$(GCP_PROJECT_STG),chat-bff)

deploy-stg-front:
	cd frontend; gcloud app deploy app.stg.yaml --service-account=${SERVICE_ACCOUNT_STG} --verbosity=debug
	$(call stop_old_gae_versions,$(GCP_PROJECT_STG),chat-front)



# TODO: Refactor production environment variables and commands to use staging environment instead [phase 2][task 107265434]
##########################################################################
GCP_PROJECT_PRD=tt-ligla-prd
GCP_REGION_PRD=asia-northeast1
GCP_ARTIFACT_PRD=chat-prd
GCP_ARTIFACT_VERSION_PRD=latest
GCP_DB_INSTANCE_PRD=tt-ligla-prd:asia-northeast1:chat-db-prd
GCP_SECRET_NAME_PRD=CHAT_ENV
GCP_SECRET_VERSION_PRD=latest
GCP_CLOUD_RUN_NAME_PRD=chat-core
GCP_DOCKER_IMAGE_TAG_PRD=chat_core

######################## PRODUCTION ENVIRONMENT #############################

prd-build: clear
	$(DC_PRD) build

prd-up:
	$(DC_PRD) up

prd-down:
	$(DC_PRD) down

prd-migrate:
	$(DC_PRD) run --rm backend-core-prd alembic upgrade head

prd-seed:
	$(DC_PRD) run --rm backend-bff-prd npm run seed:sample

prd-bash-back-core:
	$(DC_PRD) run --rm backend-core-prd bash

deploy-prd-core:
	@if ! gcloud artifacts repositories describe ${GCP_ARTIFACT_PRD} --location=${GCP_REGION_PRD} --project=${GCP_PROJECT_PRD} > /dev/null 2>&1; then \
		gcloud artifacts repositories create ${GCP_ARTIFACT_PRD} --repository-format=docker --location=${GCP_REGION_PRD} --project=${GCP_PROJECT_PRD}; \
	fi
	docker tag ${GCP_DOCKER_IMAGE_TAG_PRD}:prd ${GCP_REGION_PRD}-docker.pkg.dev/${GCP_PROJECT_PRD}/${GCP_ARTIFACT_PRD}/${GCP_DOCKER_IMAGE_TAG_PRD}:${GCP_ARTIFACT_VERSION_PRD}
	docker push ${GCP_REGION_PRD}-docker.pkg.dev/${GCP_PROJECT_PRD}/${GCP_ARTIFACT_PRD}/${GCP_DOCKER_IMAGE_TAG_PRD}:${GCP_ARTIFACT_VERSION_PRD}
	gcloud run deploy ${GCP_CLOUD_RUN_NAME_PRD} \
					--memory=1G --timeout=300 \
					--image=${GCP_REGION_PRD}-docker.pkg.dev/${GCP_PROJECT_PRD}/${GCP_ARTIFACT_PRD}/${GCP_DOCKER_IMAGE_TAG_PRD}:${GCP_ARTIFACT_VERSION_PRD} \
					--add-cloudsql-instances=${GCP_DB_INSTANCE_PRD} \
					--network=projects/${GCP_PROJECT_PRD}/global/networks/ligla-vpc-prd \
					--subnet=projects/${GCP_PROJECT_PRD}/regions/${GCP_REGION_PRD}/subnetworks/chat-vpc-prd-backend \
					--vpc-egress=private-ranges-only \
					--update-secrets=ENV_VAR_NAME=${GCP_SECRET_NAME_PRD}:${GCP_SECRET_VERSION_PRD} \
					--min-instances=1 \
					--max-instances=5 \
					--service-account=${GCP_SERVICE_ACCOUNT_PRD} \
					--concurrency=500 \
					--cpu-throttling \
					--execution-environment=gen2 \
					--platform=managed --ingress=internal --allow-unauthenticated \
					--region=${GCP_REGION_PRD} --project=${GCP_PROJECT_PRD} \
					--verbosity=info
	gcloud run services update-traffic ${GCP_CLOUD_RUN_NAME_PRD} --to-latest --region=${GCP_REGION_PRD} --project=${GCP_PROJECT_PRD}

deploy-prd-bff:
	cd backend-bff; gcloud app deploy app.prd.yaml --service-account=${GCP_SERVICE_ACCOUNT_PRD} --project=${GCP_PROJECT_PRD} --verbosity=debug
	$(call stop_old_gae_versions,$(GCP_PROJECT_PRD),chat-bff)

deploy-prd-front:
	cd frontend; gcloud app deploy app.prd.yaml --service-account=${GCP_SERVICE_ACCOUNT_PRD} --project=${GCP_PROJECT_PRD} --verbosity=debug


######################## FUNCTIONS STAGING #############################
# Project Configuration
GCP_PROJECT_STG=tt-ligla-stg
REGION=asia-northeast1
RUNTIME=python312

# Function Configuration
FUNCTION_NAME=chat-organization-data-sync
ENTRY_POINT=gcs_event_trigger
TRIGGER_BUCKET=ligla-chat-data-stg

# Resource Configuration
MEMORY=2G
TIMEOUT=540
OUTPUT_FORMAT=json

deploy-stg-func-datasync:
	cd functions/datasync; \
	gcloud functions deploy ${FUNCTION_NAME} \
	--gen2 \
	--runtime=${RUNTIME} \
	--region=${REGION} \
	--entry-point=${ENTRY_POINT} \
	--source=. \
	--trigger-event-filters="type=google.cloud.storage.object.v1.finalized" \
	--trigger-event-filters="bucket=${TRIGGER_BUCKET}" \
	--memory=${MEMORY} \
	--timeout=${TIMEOUT} \
	--project="${GCP_PROJECT_STG}" \
	--run-service-account="${SERVICE_ACCOUNT_STG}" \
	--format=${OUTPUT_FORMAT}

	@if gcloud run services describe ${FUNCTION_NAME} \
		--region=${REGION} --project=${GCP_PROJECT_STG} \
		--format=yaml 2>/dev/null | grep -q "${GCP_DB_INSTANCE_STG}"; then \
		echo "✅ Cloud SQL instance already attached, skipping update."; \
	else \
		echo "Attaching Cloud SQL to the function's service..."; \
		gcloud run services update ${FUNCTION_NAME} \
			--region=${REGION} --project=${GCP_PROJECT_STG} \
			--add-cloudsql-instances=${GCP_DB_INSTANCE_STG} \
			--network=projects/${GCP_PROJECT_STG}/global/networks/ligla-vpc-stg \
			--subnet=projects/${GCP_PROJECT_STG}/regions/${REGION}/subnetworks/ligla-vpc-stg-chat-backend \
			--direct-vpc-egress=all \
			--verbosity=info; \
		gcloud run services update-traffic ${FUNCTION_NAME} \
			--to-latest --region=${REGION} --project=${GCP_PROJECT_STG}; \
	fi


######################## FUNCTIONS PRODUCTION #############################
# Project Configuration
GCP_PROJECT_PRD=tt-ligla-prd
GCP_REGION_PRD=asia-northeast1
GCP_DB_INSTANCE_PRD=tt-ligla-prd:asia-northeast1:chat-db-prd
RUNTIME=python312

# Function Configuration
GCP_FUNCTION_NAME_PRD=chat-organization-data-sync
GCP_ENTRY_POINT_PRD=gcs_event_trigger
GCP_TRIGGER_BUCKET_PRD=ligla-chat-data-prd
GCP_SERVICE_ACCOUNT_PRD=chat-system@tt-ligla-prd.iam.gserviceaccount.com

# Resource Configuration
MEMORY=512M
TIMEOUT=540
OUTPUT_FORMAT=json

deploy-prd-func-datasync:
	cd functions/datasync; \
	gcloud functions deploy ${GCP_FUNCTION_NAME_PRD} \
	--gen2 \
	--runtime=${RUNTIME} \
	--region=${GCP_REGION_PRD} \
	--entry-point=${GCP_ENTRY_POINT_PRD} \
	--source=. \
	--trigger-event-filters="type=google.cloud.storage.object.v1.finalized" \
	--trigger-event-filters="bucket=${GCP_TRIGGER_BUCKET_PRD}" \
	--memory=${MEMORY} \
	--timeout=${TIMEOUT} \
	--project=${GCP_PROJECT_PRD} \
	--run-service-account="${GCP_SERVICE_ACCOUNT_PRD}" \
	--format=${OUTPUT_FORMAT}

	@if gcloud run services describe ${GCP_FUNCTION_NAME_PRD} \
		--region=${GCP_REGION_PRD} --project=${GCP_PROJECT_PRD} \
		--format=yaml 2>/dev/null | grep -q "${GCP_DB_INSTANCE_PRD}"; then \
		echo "✅ Cloud SQL instance already attached, skipping update."; \
	else \
		echo "Attaching Cloud SQL to the function's service..."; \
		gcloud run services update ${GCP_FUNCTION_NAME_PRD} \
			--region=${GCP_REGION_PRD} --project=${GCP_PROJECT_PRD} \
			--add-cloudsql-instances=${GCP_DB_INSTANCE_PRD} \
			--network=projects/${GCP_PROJECT_PRD}/global/networks/ligla-vpc-prd \
			--subnet=projects/${GCP_PROJECT_PRD}/regions/${GCP_REGION_PRD}/subnetworks/chat-vpc-prd-backend \
			--direct-vpc-egress=all \
			--verbosity=info; \
		gcloud run services update-traffic ${GCP_FUNCTION_NAME_PRD} \
			--to-latest --region=${GCP_REGION_PRD} --project=${GCP_PROJECT_PRD}; \
	fi


######################## MEMBER FEED DATA SYNC #############################
# Staging Configuration
MEMBER_SYNC_STG=chat-member-feed-sync
MEMBER_IMAGE_STG=${GCP_REGION_STG}-docker.pkg.dev/${GCP_PROJECT_STG}/${GCP_ARTIFACT_STG}/${MEMBER_SYNC_STG}
MEMBER_SA_STG=chat-staging@tt-ligla-stg.iam.gserviceaccount.com

# Deploy staging member feed data sync using existing infrastructure
deploy-stg-member-sync:
	@echo "Building and deploying member-feed-data-sync to staging..."

	@if ! gcloud artifacts repositories describe ${GCP_ARTIFACT_STG} --location=${GCP_REGION_STG} --project=${GCP_PROJECT_STG} > /dev/null 2>&1; then \
		gcloud artifacts repositories create ${GCP_ARTIFACT_STG} --repository-format=docker --location=${GCP_REGION_STG} --project=${GCP_PROJECT_STG}; \
	fi

	cd worker/member-feed-data-sync && \
	docker build --platform linux/amd64 -f Dockerfile.stg -t ${MEMBER_IMAGE_STG}:${GCP_ARTIFACT_VERSION_STG} ../.. && \
	docker push ${MEMBER_IMAGE_STG}:${GCP_ARTIFACT_VERSION_STG}

	# Deploy to Cloud Run using same pattern as backend-core
	gcloud run deploy ${MEMBER_SYNC_STG} \
		--memory=2G --timeout=3600 \
		--image=${MEMBER_IMAGE_STG}:${GCP_ARTIFACT_VERSION_STG} \
		--add-cloudsql-instances=${GCP_DB_INSTANCE_STG} \
		--network=projects/${GCP_PROJECT_STG}/global/networks/ligla-vpc-stg \
		--subnet=projects/${GCP_PROJECT_STG}/regions/${GCP_REGION_STG}/subnetworks/ligla-vpc-stg-chat-backend \
		--vpc-egress=all-traffic \
		--update-secrets=ENV_VAR_NAME=${GCP_SECRET_NAME_STG}:${GCP_SECRET_VERSION_STG} \
		--min-instances=0 \
		--max-instances=10 \
		--service-account=${MEMBER_SA_STG} \
		--concurrency=500 \
		--cpu-throttling \
		--execution-environment=gen2 \
		--platform=managed --ingress=internal --allow-unauthenticated \
		--region=${GCP_REGION_STG} --project=${GCP_PROJECT_STG} \
		--verbosity=info
	gcloud run services update-traffic ${MEMBER_SYNC_STG} --to-latest --region=${GCP_REGION_STG} --project=${GCP_PROJECT_STG}

	@echo "Member feed data sync deployed to staging"

# Production Configuration
MEMBER_SYNC_PRD=chat-member-feed-sync
MEMBER_IMAGE_PRD=${GCP_REGION_PRD}-docker.pkg.dev/${GCP_PROJECT_PRD}/${GCP_ARTIFACT_PRD}/${MEMBER_SYNC_PRD}
MEMBER_SA_PRD=chat-system@tt-ligla-prd.iam.gserviceaccount.com

# Deploy production member feed data sync using existing infrastructure
deploy-prd-member-sync:
	@echo "Building and deploying member-feed-data-sync to production..."

	@if ! gcloud artifacts repositories describe ${GCP_ARTIFACT_PRD} --location=${GCP_REGION_PRD} --project=${GCP_PROJECT_PRD} > /dev/null 2>&1; then \
		gcloud artifacts repositories create ${GCP_ARTIFACT_PRD} --repository-format=docker --location=${GCP_REGION_PRD} --project=${GCP_PROJECT_PRD}; \
	fi

	cd worker/member-feed-data-sync && \
	docker build --platform linux/amd64 -f Dockerfile.prd -t ${MEMBER_IMAGE_PRD}:${GCP_ARTIFACT_VERSION_PRD} ../.. && \
	docker push ${MEMBER_IMAGE_PRD}:${GCP_ARTIFACT_VERSION_PRD}

	gcloud run deploy ${MEMBER_SYNC_PRD} \
		--memory=4G --timeout=3600 \
		--image=${MEMBER_IMAGE_PRD}:${GCP_ARTIFACT_VERSION_PRD} \
		--add-cloudsql-instances=${GCP_DB_INSTANCE_PRD} \
		--network=projects/${GCP_PROJECT_PRD}/global/networks/ligla-vpc-prd \
		--subnet=projects/${GCP_PROJECT_PRD}/regions/${GCP_REGION_PRD}/subnetworks/chat-vpc-prd-backend \
		--vpc-egress=all-traffic \
		--update-secrets=ENV_VAR_NAME=${GCP_SECRET_NAME_PRD}:${GCP_SECRET_VERSION_PRD} \
		--min-instances=1 \
		--max-instances=20 \
		--service-account=${MEMBER_SA_PRD} \
		--concurrency=500 \
		--cpu-throttling \
		--execution-environment=gen2 \
		--platform=managed --ingress=internal --allow-unauthenticated \
		--region=${GCP_REGION_PRD} --project=${GCP_PROJECT_PRD} \
		--verbosity=info
	gcloud run services update-traffic ${MEMBER_SYNC_PRD} --to-latest --region=${GCP_REGION_PRD} --project=${GCP_PROJECT_PRD}

	@echo "Member feed data sync deployed to production"


######################## MALWARE SCANNER #############################

# Deploy malware scanner using existing infrastructure
deploy-malware-scanner:
	./deploy-local.sh deploy-malware-scanner
