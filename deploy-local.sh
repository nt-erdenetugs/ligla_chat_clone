#!/bin/bash
set -e

echo "Checking environment versions..."
if [ -f "./.nvmrc" ]; then
    REQUIRED_NODE_VERSION=$(cat ./.nvmrc | tr -d 'v\n\r ')
else
    echo "❌ No .nvmrc file found in project root"
    exit 1
fi

ACTIVE_NODE_VERSION=$(node --version 2>/dev/null | tr -d 'v')
if [ -z "$ACTIVE_NODE_VERSION" ]; then
    echo "❌ Node.js not found. Please install Node.js version $REQUIRED_NODE_VERSION"
    exit 1
fi

if [ "$REQUIRED_NODE_VERSION" != "$ACTIVE_NODE_VERSION" ]; then
    echo "❌ Node.js version mismatch!"
    echo "   Required: $REQUIRED_NODE_VERSION"
    echo "   Found: $ACTIVE_NODE_VERSION"
    echo "   Please install Node.js $REQUIRED_NODE_VERSION"
    exit 1
fi

echo "✅ Node.js: $ACTIVE_NODE_VERSION"

if [ -f "./.python-version" ]; then
    REQUIRED_PYTHON_VERSION=$(cat ./.python-version | tr -d '\n\r ')
else
    echo "❌ No .python-version file found in project root"
    exit 1
fi

ACTIVE_PYTHON_VERSION=$(python3 --version 2>/dev/null | awk '{print $2}')
if [ -z "$ACTIVE_PYTHON_VERSION" ]; then
    echo "❌ Python not found. Please install Python version $REQUIRED_PYTHON_VERSION"
    exit 1
fi

if [ "$REQUIRED_PYTHON_VERSION" != "$ACTIVE_PYTHON_VERSION" ]; then
    echo "❌ Python version mismatch!"
    echo "   Required: $REQUIRED_PYTHON_VERSION"
    echo "   Found: $ACTIVE_PYTHON_VERSION"
    echo "   Please install Python $REQUIRED_PYTHON_VERSION"
    exit 1
fi

echo "✅ Python: $ACTIVE_PYTHON_VERSION"

export NODE_VERSION="${REQUIRED_NODE_VERSION}"
export PYTHON_VERSION="${REQUIRED_PYTHON_VERSION}"

print_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "  setup                    Setup configuration and authentication"
    echo ""
    echo "  db-job                   Build and deploy database job image"
    echo "  migrate                  Alembic upgrade to head"
    echo "  downgrade rev=<id>       Alembic downgrade to revision"
    echo ""
    echo ""
    echo "  deploy-encryption       Run bytea migration + deploy core/bff/frontend (flags: --maintenance, --backup)"
    echo "  encrypt                 Encrypt existing tenant data (online backfill; no search-index build)"
    echo "  encrypt-dry-run         Dry-run: encrypt existing tenant data"
    echo "  decrypt                 Decrypt tenant data (clears *Encrypted columns)"
    echo "  decrypt-dry-run         Dry-run: decrypt tenant data"
    echo "  tenant-chat-search-indexes        Build chat search GIN indexes (manual; run when ready)"
    echo "  tenant-chat-search-indexes-commit Build chat search GIN indexes (commit)"
    echo "  tenant-chat-search-indexes-drop        Drop chat search GIN indexes (dry-run)"
    echo "  tenant-chat-search-indexes-drop-commit Drop chat search GIN indexes (commit)"
    echo "  rollback-encryption      Decrypt all data + downgrade encryption migration"
    echo "  tenant-downgrade-all     Downgrade ALL tenant schemas to a revision (recovery use; --revision <id> or rev=<id>)"
    echo ""
    echo "  schema                   Run Drizzle schema introspection"
    echo "  fetch-schema             Fetch and validate schema from GCS"
    echo "  deploy-core              Deploy backend core"
    echo "  deploy-bff               Deploy BFF"
    echo "  deploy-front             Deploy frontend"
    echo "  deploy-front-maintenance Deploy frontend (maintenance mode)"
    echo "  deploy-functions         Deploy cloud functions"
    echo "  deploy-member-sync       Deploy member feed data sync"
    echo "  deploy-malware-scanner   Deploy malware scanner service (Cloud Run only)"
    echo "  deploy-all               Deploy everything"
    echo "  deploy-all-services      Deploy all services in parallel (no migration)"
    echo "  migrate-and-deploy       Backup + migrate + deploy all services (use --maintenance to lock UI)"
    echo ""
    echo "  run-job <command>        Execute DB job without rebuilding image"
    echo "  help                     Show this help"
}

select_account_and_project() {
    local isSkipAccountSelection=${1:-false}

    if [[ "${isSkipAccountSelection}" != "true" ]]; then
        CURRENT_ACCOUNT=$(gcloud config get-value account 2>/dev/null)
        read -p "Enter GCP account [${CURRENT_ACCOUNT}]: " GCP_ACCOUNT
        GCP_ACCOUNT=${GCP_ACCOUNT:-${CURRENT_ACCOUNT}}

        if ! gcloud auth list --format="value(account)" | grep -qx "${GCP_ACCOUNT}"; then
            echo "❗ Error: Account '${GCP_ACCOUNT}' not found in 'gcloud auth list'."
            echo "Please activate it using: gcloud auth login"
            exit 1
        fi

        if [[ "${GCP_ACCOUNT}" == *gserviceaccount.com ]]; then
            echo "❗ Error: '${GCP_ACCOUNT}' is a service account. Please use a worker account."
            return 1
        fi

        gcloud config set account "${GCP_ACCOUNT}" --quiet >/dev/null 2>&1
        echo "ℹ️  Active account: ${GCP_ACCOUNT}"
    fi

    CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
    read -p "Enter GCP project ID [${CURRENT_PROJECT}]: " GCP_PROJECT
    GCP_PROJECT=${GCP_PROJECT:-${CURRENT_PROJECT}}

    if ! gcloud projects list --format="value(projectId)" | grep -qx "${GCP_PROJECT}"; then
        echo "❗ Error: Project '${GCP_PROJECT}' is not accessible to this account."
        echo "Make sure you have access to it."
        select_account_and_project "true"
        return
    fi

    gcloud config set project "${GCP_PROJECT}" --quiet >/dev/null 2>&1
    echo "ℹ️  Active project: ${GCP_PROJECT}"

    echo "Validating account access to project..."
    if ! gcloud projects get-iam-policy "${GCP_PROJECT}" --quiet >/dev/null 2>&1; then
        echo -e "\n❗ Error: '${GCP_ACCOUNT}' has no access to project '${GCP_PROJECT}'."
        echo "Please ensure you're logged in with the correct account."
        return 1
    fi
}

fetch_and_export_secrets() {
    local secret_name="CHAT_ENV"
    echo "🔐 Fetching env vars from Secret Manager..."

    if ! SECRET_DATA=$(gcloud secrets versions access latest --secret="${secret_name}" 2>&1); then
        echo "⚠️ Warn: Failed to access secret [${secret_name}]."
        echo "🔎 Reason: ${SECRET_DATA}"

        echo "❓ Do you want to use the Service Account to access the secret instead? [Y/N]"
        read -r use_sa
        if [[ "$use_sa" =~ ^[Yy]$ ]]; then
            echo "ℹ️  Trying to fetch with service account instead..."
            try_fetch_with_service_account "${secret_name}" || exit 1
        else
            echo "❗ Please, grant 'Secret Manager Secret Accessor' role to the account: ${GCP_ACCOUNT}"
            exit 1
        fi
    elif [[ "${SECRET_DATA}" == *"NOT_FOUND"* ]]; then
        echo "❗ Error: Secret [${secret_name}] not found in Secret Manager."
        exit 1
    fi

    if [[ -z "${SECRET_DATA}" ]]; then
        echo "❗ Error: Secret [${secret_name}] is empty."
        exit 1
    fi

    export_clean_env_vars "${SECRET_DATA}"
    setup_env_defaults
}

try_fetch_with_service_account() {
    local secret_name="$1"

    local original_account
    original_account=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null)

    echo "🔑 Activating service account with: ${CREDENTIALS_FILE} ..."
    if ! gcloud auth activate-service-account --key-file="${CREDENTIALS_FILE}" &>/dev/null; then
        echo "❗ Error: Failed to activate service account."
        return 1
    fi

    echo "ℹ️  Service account active: $(gcloud auth list --filter=status:ACTIVE --format='value(account)')"

    if ! SECRET_DATA=$(gcloud secrets versions access latest --secret="${secret_name}" 2>&1); then
        echo "❗ Error: Still failed to access [${secret_name}] after using service account."
        echo "🔎 Reason: ${SECRET_DATA}"
        return 1
    fi

    echo "✅ Successfully fetched secret [${secret_name}] with service account."

    local env_file="secret/.env.${ENV}"
    if [[ ! -f "${env_file}" ]]; then
        echo "ℹ️  Creating ${env_file} from fetched secrets..."
        mkdir -p "$(dirname "${env_file}")"
        echo "$SECRET_DATA" >"${env_file}"
    fi

    if ! gcloud config set account "${original_account}" &>/dev/null; then
        echo "❗ Error: Failed to restore original account: ${original_account}"
        return 1
    fi

    echo "🔁 Restored original gcloud account: ${original_account}"
    return 0
}

export_clean_env_vars() {
    local data="$1"

    local temp_val

    temp_val=$(echo "$data" | grep "^GCP_PROJECT_ID=" | head -n1 | cut -d'=' -f2-)
    GCP_PROJECT_ID=$(clean_env_value "${temp_val}")

    temp_val=$(echo "$data" | grep "^GCP_REGION=" | head -n1 | cut -d'=' -f2-)
    GCP_REGION=$(clean_env_value "${temp_val}")

    temp_val=$(echo "$data" | grep "^GCP_ARTIFACT=" | head -n1 | cut -d'=' -f2-)
    GCP_ARTIFACT=$(clean_env_value "${temp_val}")

    temp_val=$(echo "$data" | grep "^CLOUD_SQL_CONNECTION_NAME=" | head -n1 | cut -d'=' -f2-)
    GCP_DB_INSTANCE=$(clean_env_value "${temp_val}")

    temp_val=$(echo "$data" | grep "^GCP_STORAGE_SCHEMA_BUCKET=" | head -n1 | cut -d'=' -f2-)
    GCP_STORAGE_SCHEMA_BUCKET=$(clean_env_value "${temp_val}")

    # Cloud Functions configuration
    temp_val=$(echo "$data" | grep "^GCP_FUNCTION_NAME=" | head -n1 | cut -d'=' -f2-)
    GCP_FUNCTION_NAME=$(clean_env_value "${temp_val}")

    temp_val=$(echo "$data" | grep "^GCP_TRIGGER_BUCKET=" | head -n1 | cut -d'=' -f2-)
    GCP_TRIGGER_BUCKET=$(clean_env_value "${temp_val}")

    # Malware scanner configuration

    temp_val=$(echo "$data" | grep "^GCP_VIRUS_SCAN_RESULT_TOPIC_NAME=" | head -n1 | cut -d'=' -f2-)
    GCP_VIRUS_SCAN_RESULT_TOPIC_NAME=$(clean_env_value "${temp_val}")
}

clean_env_value() {
    echo "$1" | sed -e 's/^["'\'']//;s/["'\'']$//' | xargs
}

setup_env_defaults() {
    GCP_PROJECT_ENV="${GCP_PROJECT_ID:-}"
    GCP_REGION_ENV="${GCP_REGION:-asia-northeast1}"
    GCP_ARTIFACT_ENV="${GCP_ARTIFACT:-chat-${ENV}}"
    GCP_DB_INSTANCE_ENV="${GCP_DB_INSTANCE:-tt-ligla-${ENV}:asia-northeast1:$DB_INSTANCE}"
    GCP_STORAGE_SCHEMA_BUCKET_ENV="${GCP_STORAGE_SCHEMA_BUCKET:-ligla-chat-bff-schema-${ENV}}"
    VPC_NETWORK_ENV="projects/${GCP_PROJECT_ENV:-${GCP_PROJECT}}/global/networks/${VPC_NETWORK}"
    VPC_SUBNET_ENV="projects/${GCP_PROJECT_ENV:-${GCP_PROJECT}}/regions/${GCP_REGION_ENV}/subnetworks/${VPC_SUBNET}"

    # Cloud Functions defaults
    GCP_FUNCTION_NAME_ENV="${GCP_FUNCTION_NAME:-chat-organization-data-sync}"
    GCP_TRIGGER_BUCKET_ENV="${GCP_TRIGGER_BUCKET:-ligla-chat-data-${ENV}}"

    GCP_VIRUS_SCAN_RESULT_TOPIC_NAME_ENV="${GCP_VIRUS_SCAN_RESULT_TOPIC_NAME}"
}

stop_old_gae_versions() {
    local service=$1
    echo "ℹ️  Stopping old GAE versions for ${service}..."
    local old_versions
    old_versions=$(gcloud app versions list \
        --project="${GCP_PROJECT_ENV}" \
        --service="${service}" \
        --filter="traffic_split=0" \
        --format="value(id)" 2>/dev/null) || true
    if [[ -n "${old_versions}" ]]; then
        # shellcheck disable=SC2086
        gcloud app versions stop ${old_versions} \
            --project="${GCP_PROJECT_ENV}" \
            --service="${service}" \
            --quiet 2>/dev/null || true
        echo "✅ Stopped old versions for ${service}"
    else
        echo "ℹ️  No old versions to stop for ${service}"
    fi
}

setup_config() {
    # Check if gcloud is installed
    if ! command -v gcloud &>/dev/null; then
        echo "❗ Error: 'gcloud' CLI is not installed or not in PATH."
        exit 1
    fi

    while true; do
        echo "Choose environment to deploy (press Enter for default 'stg'):"
        echo "  1) stg"
        echo "  2) prd"
        read -p "> " REPLY
        case "$REPLY" in
        1)
            ENV="stg"
            echo "ℹ️  Selected environment: ${ENV}"
            break
            ;;
        2)
            ENV="prd"
            echo "ℹ️  Selected environment: ${ENV}"
            break
            ;;
        "")
            ENV="stg"
            echo "ℹ️  No input provided. Defaulting to: ${ENV}"
            break
            ;;
        *)
            echo "❌ Invalid selection: '$REPLY'. Please choose 1 or 2, or press Enter for default."
            ;;
        esac
    done

    echo "Choose how to load env variables (press Enter for default: GCP Secret Manager):"
    echo "  1) Local .env file"
    echo "  2) GCP Secret Manager"
    read -p "> " REPLY

    case "$REPLY" in
    1)
        USE_SECRET_MANAGER=false
        echo "ℹ️  Selected to use local .env file"
        ;;
    2 | "")
        USE_SECRET_MANAGER=true
        echo "ℹ️  Selected to use GCP Secret Manager"
        ;;
    *)
        echo "❌ Invalid selection: '${REPLY}'. Defaulting to GCP Secret Manager."
        USE_SECRET_MANAGER=true
        ;;
    esac

    CURRENT_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
    if [[ -z "${CURRENT_ACCOUNT}" ]]; then
        echo "❗ Error: No active gcloud account found."
        echo "Please activate your worker account using: gcloud auth login"
        exit 1
    fi

    while ! select_account_and_project; do
        echo "🔁 Retrying account and project selection..."
    done

    echo "✅ Account and project setup complete."
    echo "Setting up other configurations..."

    readonly CREDENTIALS_FILE="secret/credentials.${ENV}.json"
    if [[ ! -f "${CREDENTIALS_FILE}" ]]; then
        echo "❗ Error: Credentials file '${CREDENTIALS_FILE}' not found!"
        exit 1
    fi
    echo "ℹ️  Using credentials: ${CREDENTIALS_FILE}"

    if [[ "${ENV}" = "stg" ]]; then
        VPC_NETWORK="ligla-vpc-stg"
        VPC_SUBNET="ligla-vpc-stg-chat-backend"
        DB_INSTANCE="chat-db-stg-instance"
        SERVICE_ACCOUNT="chat-staging@tt-ligla-stg.iam.gserviceaccount.com"
        MALWARE_SCANNER_BUCKET="ligla-chat-data-stg"
        MALWARE_SCANNER_SERVICE_NAME="chat-file-gcs-malware-scanner"
        MALWARE_SCANNER_MAX_INSTANCES=5
    else
        VPC_NETWORK="ligla-vpc-prd"
        VPC_SUBNET="chat-vpc-prd-backend"
        DB_INSTANCE="chat-db-prd"
        SERVICE_ACCOUNT="chat-system@tt-ligla-prd.iam.gserviceaccount.com"
        MALWARE_SCANNER_BUCKET="ligla-chat-data-prd"
        MALWARE_SCANNER_SERVICE_NAME="chat-file-gcs-malware-scanner"
        MALWARE_SCANNER_MAX_INSTANCES=10
    fi

    echo "ℹ️  Service account: ${SERVICE_ACCOUNT}"

    echo "Do you want to use a different service account for Cloud Functions runtime?"
    echo "  1) No - use ${SERVICE_ACCOUNT} for both deployment and runtime (default)"
    echo "  2) Yes - specify a different runtime service account"
    read -p "> " REPLY

    case "$REPLY" in
    2)
        read -p "Enter runtime service account email: " FUNCTIONS_RUN_SERVICE_ACCOUNT
        if [[ -z "${FUNCTIONS_RUN_SERVICE_ACCOUNT}" ]]; then
            echo "❌ Empty input. Using default: ${SERVICE_ACCOUNT}"
            FUNCTIONS_RUN_SERVICE_ACCOUNT="${SERVICE_ACCOUNT}"
        else
            echo "ℹ️  Cloud Functions will run as: ${FUNCTIONS_RUN_SERVICE_ACCOUNT}"
        fi
        ;;
    1 | "")
        FUNCTIONS_RUN_SERVICE_ACCOUNT="${SERVICE_ACCOUNT}"
        echo "ℹ️  Using same service account for Cloud Functions runtime"
        ;;
    *)
        echo "❌ Invalid selection. Using default: ${SERVICE_ACCOUNT}"
        FUNCTIONS_RUN_SERVICE_ACCOUNT="${SERVICE_ACCOUNT}"
        ;;
    esac

    if [[ "${USE_SECRET_MANAGER}" == "false" ]]; then
        ENV_FILE="secret/.env.${ENV}"
        if [[ ! -f "${ENV_FILE}" ]]; then
            echo "❗ Missing .env file: ${ENV_FILE}"
            exit 1
        fi
        echo "🔐 Using env file: ${ENV_FILE}"

        GCP_PROJECT_ENV=$(get_env_var "GCP_PROJECT_ID" "")
        GCP_REGION_ENV=$(get_env_var "GCP_REGION" "asia-northeast1")
        GCP_ARTIFACT_ENV=$(get_env_var "GCP_ARTIFACT" "chat-${ENV}")
        GCP_DB_INSTANCE_ENV=$(get_env_var "GCP_DB_INSTANCE" "tt-ligla-${ENV}:asia-northeast1:${DB_INSTANCE}")
        GCP_STORAGE_SCHEMA_BUCKET_ENV=$(get_env_var "GCP_STORAGE_SCHEMA_BUCKET" "ligla-chat-bff-schema-${ENV}")
        VPC_NETWORK_ENV=$(get_env_var "GCP_VPC_NETWORK" "projects/${GCP_PROJECT_ENV}/global/networks/${VPC_NETWORK}")
        VPC_SUBNET_ENV=$(get_env_var "GCP_VPC_SUBNET" "projects/${GCP_PROJECT_ENV}/regions/${GCP_REGION_ENV}/subnetworks/${VPC_SUBNET}")

        # Cloud Functions configuration
        GCP_FUNCTION_NAME_ENV=$(get_env_var "GCP_FUNCTION_NAME" "chat-organization-data-sync")
        GCP_TRIGGER_BUCKET_ENV=$(get_env_var "GCP_TRIGGER_BUCKET" "ligla-chat-data-${ENV}")

        GCP_VIRUS_SCAN_RESULT_TOPIC_NAME_ENV=$(get_env_var "GCP_VIRUS_SCAN_RESULT_TOPIC_NAME")
    else
        fetch_and_export_secrets
    fi

    echo "Using GCP_PROJECT_ENV: '$GCP_PROJECT_ENV'"

    if [[ "${GCP_PROJECT_ENV}" != "${GCP_PROJECT}" ]]; then
        echo "❗ Error: GCP_PROJECT_ID in ${ENV_FILE} ('${GCP_PROJECT_ENV}') does NOT match current gcloud project ('${GCP_PROJECT}')."
        echo "Please verify your environment file or current gcloud project."
        exit 1
    fi

    echo "Using GCP_REGION_ENV: '${GCP_REGION_ENV}'"
    echo "Using GCP_ARTIFACT_ENV: '${GCP_ARTIFACT_ENV}'"
    echo "Using GCP_DB_INSTANCE_ENV: '${GCP_DB_INSTANCE_ENV}'"
    echo "Using GCP_FUNCTION_NAME_ENV: '${GCP_FUNCTION_NAME_ENV}'"
    echo "Using GCP_TRIGGER_BUCKET_ENV: '${GCP_TRIGGER_BUCKET_ENV}'"

    echo "✅ Configuration setup complete for project '${GCP_PROJECT_ENV}'."
}

get_env_var() {
    local var_name="$1"
    local default_value="$2"
    local env_file="./secret/.env.${ENV}" # Use global ${ENV} here

    if [[ ! -f "${env_file}" ]]; then
        echo "Error: Environment file '${env_file}' not found!"
        exit 1
    fi

    local raw_value=$(grep -E "^${var_name}=" "${env_file}" | head -n1 | cut -d '=' -f2-)
    if [[ -n "${raw_value}" ]]; then
        # Remove surrounding quotes and trim whitespace
        local cleaned_value=$(echo "${raw_value}" | sed -e 's/^["'\'']//;s/["'\'']$//' | xargs)
        echo "${cleaned_value}"
    else
        echo "${default_value}"
    fi
}

build_db_job_image() {
    echo "Building db job image..."
    DOCKER_DEFAULT_PLATFORM=linux/amd64 \
        docker build \
        --progress=plain \
        --build-arg ENV=${ENV} \
        -t "${GCP_REGION_ENV}-docker.pkg.dev/${GCP_PROJECT_ENV}/${GCP_ARTIFACT_ENV}/ligla_db_job:latest" \
        -f backend-core/Dockerfile.migrations .

    echo "Configuring Docker for GCP Artifact Registry..."
    gcloud auth configure-docker "${GCP_REGION_ENV}-docker.pkg.dev" --quiet

    echo "Pushing database job image to GCP Artifact Registry..."
    docker push "${GCP_REGION_ENV}-docker.pkg.dev/${GCP_PROJECT_ENV}/${GCP_ARTIFACT_ENV}/ligla_db_job:latest"

    echo "Deploying/updating ligla-db-job..."
    if gcloud run jobs update ligla-db-job \
        --image=${GCP_REGION_ENV}-docker.pkg.dev/${GCP_PROJECT_ENV}/${GCP_ARTIFACT_ENV}/ligla_db_job:latest \
        --set-cloudsql-instances=${GCP_DB_INSTANCE_ENV} \
        --network=${VPC_NETWORK_ENV} \
        --subnet=${VPC_SUBNET_ENV} \
        --vpc-egress=private-ranges-only \
        --service-account=${SERVICE_ACCOUNT} \
        --region=${GCP_REGION_ENV} \
        --project=${GCP_PROJECT_ENV} \
        --memory=1Gi \
        --max-retries=0 \
        --task-timeout=1800s \
        --set-env-vars="^;;^ENV=${ENV};;USE_CLOUD_SQL_PROXY=true;;CLOUD_SQL_CONNECTION_NAME=${GCP_DB_INSTANCE_ENV};;DB_JOB_COMMAND=" \
        2>/dev/null; then
        echo "Successfully updated existing job"
    else
        echo "Update failed, attempting to delete and recreate job..."
        gcloud run jobs delete ligla-db-job \
            --region=${GCP_REGION_ENV} \
            --project=${GCP_PROJECT_ENV} \
            --quiet 2>/dev/null || true

        gcloud run jobs create ligla-db-job \
            --image=${GCP_REGION_ENV}-docker.pkg.dev/${GCP_PROJECT_ENV}/${GCP_ARTIFACT_ENV}/ligla_db_job:latest \
            --set-cloudsql-instances=${GCP_DB_INSTANCE_ENV} \
            --network=${VPC_NETWORK_ENV} \
            --subnet=${VPC_SUBNET_ENV} \
            --vpc-egress=private-ranges-only \
            --service-account=${SERVICE_ACCOUNT} \
            --region=${GCP_REGION_ENV} \
            --project=${GCP_PROJECT_ENV} \
            --memory=1Gi \
            --max-retries=0 \
            --task-timeout=1800s \
            --set-env-vars="^;;^ENV=${ENV};;USE_CLOUD_SQL_PROXY=true;;CLOUD_SQL_CONNECTION_NAME=${GCP_DB_INSTANCE_ENV};;DB_JOB_COMMAND="
        echo "Successfully created new job"
    fi
}

execute_db_job() {
    local args="$1"
    local description="$2"
    local timeout="$3"
    local wait_flag="$4"

    echo "Executing: ${description} [${args}]"

    local timeout_arg=""
    [[ -n "${timeout}" ]] && timeout_arg="--task-timeout=${timeout}"

    gcloud run jobs update ligla-db-job \
        --region=${GCP_REGION_ENV} \
        --project=${GCP_PROJECT_ENV} \
        --set-env-vars="^;;^ENV=${ENV};;USE_CLOUD_SQL_PROXY=true;;CLOUD_SQL_CONNECTION_NAME=${GCP_DB_INSTANCE_ENV};;DB_JOB_COMMAND=${args}" \
        ${timeout_arg} \
        --quiet

    local wait_args=""
    [[ "${wait_flag}" != "--no-wait" ]] && wait_args="--wait"

    gcloud run jobs execute ligla-db-job \
        --region=${GCP_REGION_ENV} \
        --project=${GCP_PROJECT_ENV} \
        ${wait_args}

    local status=$?

    if [[ "${wait_flag}" == "--no-wait" ]]; then
        # --no-wait: status reflects submission only; the job runs detached.
        # Skip the connection-cleanup sleep — nothing finished here.
        echo "ℹ️  Job submitted detached (--task-timeout=${timeout:-default})."
        echo "    Poll status: gcloud run jobs executions list --job=ligla-db-job --region=${GCP_REGION_ENV} --project=${GCP_PROJECT_ENV}"
        return ${status}
    fi

    echo "Waiting for database connections to cleanup..."
    sleep 15
    return ${status}
}

# Function to run database migrations
run_migrations() {
    echo "Running migrations..."
    build_db_job_image
    execute_db_job "migrate-up,--revision,head" "Alembic upgrade to head"
}

get_migration_down_revision() {
    local revision_id="$1"
    local migration_file

    migration_file=$(ls backend-core/alembic/versions/*"${revision_id}"*.py 2>/dev/null | head -n1)
    if [[ -z "${migration_file}" ]]; then
        echo "❌ Error: Could not find Alembic migration file for revision ${revision_id}" >&2
        return 1
    fi

    python3 - <<PY
from pathlib import Path
import re

content = Path(${migration_file@Q}).read_text()
match = re.search(r'^down_revision\s*=\s*["\']([^"\']+)["\']', content, re.MULTILINE)
if not match:
    raise SystemExit(1)
print(match.group(1))
PY
}

# Migrations rollback
downgrade_migration() {
    local revision_target="$1"
    revision_target="${revision_target#rev=}"

    echo "WARNING: Downgrading to ${revision_target}. This may cause data loss."
    read -p "Proceed? (yes/NO): " confirm
    if [[ "$confirm" != "yes" ]]; then
        echo "Cancelled."
        return 0
    fi

    build_db_job_image

    # Tenants first, then public (reverse of upgrade order)
    echo "Downgrading tenant schemas to ${revision_target}..."
    if ! execute_db_job "tenant-downgrade-all,--revision,${revision_target}" "Alembic downgrade tenant schemas to ${revision_target}"; then
        echo "❌ Tenant schema downgrade failed. Public schema is still at current revision."
        echo "   Recovery: Fix the tenant migration issue and retry."
        return 1
    fi
    echo "✅ Tenant schema downgrade completed."

    if ! execute_db_job "migrate-down,--revision,${revision_target}" "Alembic downgrade public schema to ${revision_target}"; then
        echo "❌ Public schema downgrade failed. Tenants were already downgraded."
        echo "   Recovery: Run 'make tenant-upgrade-all REV=head' to restore tenants, then investigate."
        return 1
    fi
    echo "✅ Public schema downgrade completed."
}

# Tenant operations
run_tenant_sync() {
    execute_db_job "tenant-sync" "Sync template schema to tenants"
}

run_tenant_migrate() {
    local commit_flag="${1:-}"
    local args="tenant-migrate,--source,public_old"
    if [[ "$commit_flag" == "--commit" ]]; then
        args="${args},--commit"
    fi
    execute_db_job "${args}" "Migrate data to tenant schemas"
}

run_tenant_validate() {
    execute_db_job "tenant-validate,--deep" "Validate tenant data (deep)"
}

run_tenant_rollback() {
    local commit_flag="${1:-}"
    local args="tenant-rollback,--target,public_old"
    if [[ "$commit_flag" == "--commit" ]]; then
        args="${args},--commit"
    fi
    execute_db_job "${args}" "Rollback data to public schema"
}

run_tenant_split() {
    local auto_confirm="${1:-}"
    local workers=1
    if [[ "${ENV}" == "stg" ]]; then
        workers=2
    elif [[ "${ENV}" == "prd" ]]; then
        workers=4
    fi

    echo "Tenant split (${ENV}): migrate + copy data (${workers} workers) + validate"
    if [[ "$auto_confirm" != "--yes" ]]; then
        read -p "Proceed? (yes/NO): " confirm
        if [[ "$confirm" != "yes" ]]; then
            echo "Cancelled."
            return 1
        fi
    fi

    if ! execute_db_job "tenant-setup-full,--workers,${workers}" "Tenant split workflow"; then
        echo "❌ Tenant split failed"
        return 1
    fi
    echo "✅ Tenant split complete"
}

# Encryption operations
run_tenant_encrypt() {
    local commit_flag="${1:-}"
    local workers=1
    if [[ "${ENV}" == "stg" ]]; then
        workers=2
    elif [[ "${ENV}" == "prd" ]]; then
        workers=4
    fi

    local args="tenant-encrypt,--workers,${workers},--batch-size,1000,--continue-on-error"
    if [[ "$commit_flag" == "--commit" ]]; then
        args="${args},--commit"
    fi
    execute_db_job "${args}" "Encrypt tenant data (workers=${workers})" 604800s --no-wait
}

run_tenant_decrypt() {
    local commit_flag="${1:-}"
    local workers=1
    if [[ "${ENV}" == "stg" ]]; then
        workers=2
    elif [[ "${ENV}" == "prd" ]]; then
        workers=4
    fi

    local args="tenant-decrypt,--workers,${workers},--batch-size,1000,--continue-on-error"
    if [[ "$commit_flag" == "--commit" ]]; then
        args="${args},--commit"
    fi
    execute_db_job "${args}" "Decrypt tenant data (workers=${workers})"
}

run_tenant_chat_search_indexes() {
    local mode="${1:-create}"
    local commit_flag="${2:-}"
    local workers=1
    if [[ "${ENV}" == "stg" ]]; then
        workers=2
    elif [[ "${ENV}" == "prd" ]]; then
        workers=4
    fi

    local args="tenant-chat-search-indexes,--mode,${mode},--workers,${workers},--continue-on-error"
    if [[ "$commit_flag" == "--commit" ]]; then
        args="${args},--commit"
    fi

    local description="Create tenant chat search indexes"
    if [[ "${mode}" == "replace" ]]; then
        description="Create or replace tenant chat search indexes"
    elif [[ "${mode}" == "drop" ]]; then
        description="Remove tenant chat search indexes"
    fi

    execute_db_job "${args}" "${description} (workers=${workers})" 604800s --no-wait
}

# Preflight: ENCRYPTION_MASTER_KEY must be present and well-formed (32-byte
# base64) before any encryption job runs. Fails fast so a missing or malformed
# key can't strand a deploy/backfill mid-flight. Reads the key from the same
# CHAT_ENV payload setup_config already fetched (SECRET_DATA), or from the local
# secret/.env.${ENV} file when Secret Manager is not in use.
preflight_encryption_key() {
    local _master_key _raw
    if [[ -n "${SECRET_DATA:-}" ]]; then
        _raw=$(echo "${SECRET_DATA}" | grep "^ENCRYPTION_MASTER_KEY=" | head -n1 | cut -d'=' -f2-)
        _master_key=$(clean_env_value "${_raw}")
    else
        _master_key=$(get_env_var "ENCRYPTION_MASTER_KEY" "")
    fi

    if [[ -z "${_master_key}" ]]; then
        echo "❌ FATAL: ENCRYPTION_MASTER_KEY missing or empty in CHAT_ENV (${GCP_PROJECT_ENV})"
        echo "   Generate via: python scripts/generate-master-key.py"
        echo "   Then add ENCRYPTION_MASTER_KEY=<key> to the CHAT_ENV secret payload"
        exit 1
    fi
    # 32 bytes base64-encoded = 44 chars (with '=' padding), alphabet [A-Za-z0-9+/].
    if [[ ! "${_master_key}" =~ ^[A-Za-z0-9+/]{43}=$ ]]; then
        echo "❌ FATAL: ENCRYPTION_MASTER_KEY has invalid shape (expected 32-byte base64, 44 chars)"
        echo "   Regenerate via: python scripts/generate-master-key.py"
        exit 1
    fi
    echo "✅ ENCRYPTION_MASTER_KEY preflight passed (CHAT_ENV @ ${GCP_PROJECT_ENV})"
}

deploy_encryption() {
    export CLOUDSDK_CORE_DISABLE_PROMPTS=1

    local maintenance_mode=0 backup_mode=0
    for arg in "$@"; do
        case "$arg" in
            --maintenance) maintenance_mode=1 ;;
            --backup)      backup_mode=1 ;;
            *) echo "❌ Unknown flag: ${arg}"; exit 1 ;;
        esac
    done

    preflight_encryption_key

    local total=3
    [[ "${maintenance_mode}" == "1" ]] && total=$((total+1))
    [[ "${backup_mode}" == "1" ]]      && total=$((total+1))
    local step=0

    local WHO TS BACKUP _maintenance_on=0
    WHO=$(gcloud config get-value account 2>/dev/null | cut -d'@' -f1)
    TS=$(date +%Y%m%d-%H%M%S)
    BACKUP="deploy-encryption-${ENV}-${TS}-${WHO}"

    trap '
        if [[ "${_maintenance_on}" == "1" ]]; then
            echo "⚠️  Turning off maintenance mode before exit..."
            unset VITE_MAINTENANCE_MODE_ACTIVE
            deploy_frontend && echo "✅ Maintenance OFF" || echo "❌ Maintenance OFF failed — run: bash deploy-local.sh deploy-front"
        fi
    ' EXIT

    local mode_label="no maintenance, no backup"
    [[ "${maintenance_mode}" == "1" && "${backup_mode}" == "1" ]] && mode_label="maintenance + backup"
    [[ "${maintenance_mode}" == "1" && "${backup_mode}" == "0" ]] && mode_label="maintenance only"
    [[ "${maintenance_mode}" == "0" && "${backup_mode}" == "1" ]] && mode_label="backup only"

    echo ""
    echo "deploy-encryption [${ENV}] (${mode_label})"
    echo ""
    echo "ℹ️  Backward-compatible (expand/contract) rollout:"
    echo "    • Migration is purely additive (ADD COLUMN contentEncrypted/...). ~50ms lock per tenant."
    echo "    • Plaintext columns (content/noteValue/value) stay intact for old BFF read compatibility."
    echo "    • Encryption is performed by the separate 'encrypt' step (online backfill, no service impact)."
    echo "    • --maintenance is OPTIONAL (kept as a safety knob); not required by the migration itself."
    echo ""
    echo "⚠️  Instance: ${DB_INSTANCE}  Project: ${GCP_PROJECT_ENV}"
    [[ "${backup_mode}" == "1" ]] && echo "    Backup: ${BACKUP}"
    read -p "   Proceed? (yes/NO): " _confirm
    [[ "$_confirm" != "yes" ]] && { echo "Cancelled."; exit 0; }

    # Snapshot the currently-serving revisions BEFORE any deploy step so the
    # rollback targets are on record (printed at the end). core = Cloud Run
    # revision; bff/front = App Engine versions.
    local PREV_CORE_REV PREV_BFF_VER PREV_FRONT_VER FRONT_GAE_SERVICE
    PREV_CORE_REV=$(gcloud run services describe chat-core \
        --region="${GCP_REGION_ENV}" --project="${GCP_PROJECT_ENV}" \
        --format='value(status.latestReadyRevisionName)' 2>/dev/null) || true
    PREV_BFF_VER=$(gcloud app versions list --service=chat-bff \
        --project="${GCP_PROJECT_ENV}" --hide-no-traffic \
        --sort-by='~traffic_split' --format='value(id)' 2>/dev/null | head -n1)
    FRONT_GAE_SERVICE=$(grep '^service:' "frontend/app.${ENV}.yaml" 2>/dev/null \
        | awk '{print $2}' | tr -d "'\"")
    FRONT_GAE_SERVICE="${FRONT_GAE_SERVICE:-default}"
    PREV_FRONT_VER=$(gcloud app versions list --service="${FRONT_GAE_SERVICE}" \
        --project="${GCP_PROJECT_ENV}" --hide-no-traffic \
        --sort-by='~traffic_split' --format='value(id)' 2>/dev/null | head -n1)

    if [[ "${maintenance_mode}" == "1" ]]; then
        step=$((step+1))
        echo "[${step}/${total}] Maintenance ON"
        export VITE_MAINTENANCE_MODE_ACTIVE=true
        deploy_frontend || { echo "❌ [${step}/${total}] failed"; exit 1; }
        _maintenance_on=1
        unset VITE_MAINTENANCE_MODE_ACTIVE
    fi

    if [[ "${backup_mode}" == "1" ]]; then
        step=$((step+1))
        echo "[${step}/${total}] Cloud SQL backup"
        gcloud sql backups create --instance="${DB_INSTANCE}" --description="${BACKUP}" \
            --location=asia-northeast1 --project="${GCP_PROJECT_ENV}" \
            || { echo "❌ [${step}/${total}] failed"; exit 1; }
    fi

    step=$((step+1))
    echo "[${step}/${total}] Apply migrations (bytea schema)"
    run_migrations || { echo "❌ [${step}/${total}] migration failed"; exit 1; }

    step=$((step+1))
    echo "[${step}/${total}] Schema introspection"
    run_schema_introspection || { echo "❌ [${step}/${total}] introspection failed"; exit 1; }
    fetch_schema || { echo "❌ [${step}/${total}] fetch-schema failed"; exit 1; }

    step=$((step+1))
    echo "[${step}/${total}] Deploy core + bff (parallel), then frontend"
    local LOG_DIR="./.deploy-logs"
    mkdir -p "${LOG_DIR}"
    local LOG="${LOG_DIR}/deploy-encryption-${TS}.log"
    local pids=() names=() failed=()
    deploy_core >> "${LOG}.core" 2>&1 & pids+=($!); names+=("core")
    deploy_bff  >> "${LOG}.bff"  2>&1 & pids+=($!); names+=("bff")
    local remaining=("${pids[@]}") remaining_names=("${names[@]}")
    while [[ ${#remaining[@]} -gt 0 ]]; do
        local still_running=() still_names=()
        for i in "${!remaining[@]}"; do
            local pid="${remaining[$i]}" name="${remaining_names[$i]}"
            if ! kill -0 "$pid" 2>/dev/null; then
                wait "$pid" && echo "  ${name} ✅" || { echo "  ${name} ❌"; failed+=("$name"); }
            elif ps -o stat= -p "$pid" 2>/dev/null | grep -q 'Z'; then
                wait "$pid" && echo "  ${name} ✅" || { echo "  ${name} ❌"; failed+=("$name"); }
            else
                still_running+=("$pid"); still_names+=("$name")
            fi
        done
        remaining=("${still_running[@]+"${still_running[@]}"}") remaining_names=("${still_names[@]+"${still_names[@]}"}")
        [[ ${#remaining[@]} -gt 0 ]] && { echo "  waiting: ${still_names[*]}"; sleep 5; }
    done
    cat "${LOG}".{core,bff} >> "${LOG}" 2>/dev/null
    [[ ${#failed[@]} -gt 0 ]] && { echo "❌ deploy failed: ${failed[*]}"; exit 1; }

    _maintenance_on=0
    deploy_frontend || { echo "❌ frontend deploy failed"; exit 1; }

    echo "✅ Encryption deployment complete (services live, schema additive)."
    echo ""
    echo "ℹ️  Current state of every tenant table:"
    echo "    • New writes (Core receiver + BFF services) are dual-written:"
    echo "        plaintext column populated AND *Encrypted column populated, isEncrypted=true."
    echo "    • Existing rows have isEncrypted=false and *Encrypted=NULL — BFF reads them via"
    echo "        the 3-arg CASE fallback to plaintext::text. No user-visible difference."
    echo ""
    echo "ℹ️  Backfill is a SEPARATE manual step. Run when ready:"
    echo "        bash deploy-local.sh tenant-encrypt-commit   # commits encryption"
    echo "        bash deploy-local.sh tenant-encrypt          # rehearses without writes"
    echo ""
    echo "    • Backfill is fully online (FOR UPDATE SKIP LOCKED, batched). No --maintenance needed."
    echo "    • You may pause indefinitely between deploy-encryption and tenant-encrypt / tenant-encrypt-commit."
    echo ""
    echo "ℹ️  Search-index build (GIN bigm) is also a SEPARATE manual step. Run after backfill:"
    echo "        bash deploy-local.sh tenant-chat-search-indexes-commit"

    # GAE versions stopped after cutover need start before set-traffic.
    local ROLLBACK="${LOG_DIR}/rollback-encryption-${TS}.sh"
    {
        echo "#!/bin/bash"
        echo "# Rollback for deploy-encryption [${ENV}] ${TS} — project ${GCP_PROJECT_ENV}"
        echo "# Reverts service traffic to the revisions live before this deploy."
        echo "# The additive DB migration is NOT reverted (safe: plaintext intact)."
        echo "# Run: bash $(basename "${ROLLBACK}")"
        echo "set -euo pipefail"
        echo ""
        if [[ -n "${PREV_CORE_REV}" ]]; then
            echo "# core (Cloud Run): revisions scale from zero — no start step needed."
            echo "gcloud run services update-traffic chat-core --to-revisions=${PREV_CORE_REV}=100 --region=${GCP_REGION_ENV} --project=${GCP_PROJECT_ENV}"
        else
            echo "# core: previous revision unknown — inspect: gcloud run revisions list --service=chat-core --region=${GCP_REGION_ENV} --project=${GCP_PROJECT_ENV}"
        fi
        echo ""
        if [[ -n "${PREV_BFF_VER}" ]]; then
            echo "# bff (App Engine): describe → start if not SERVING → shift traffic. Fail loud on describe error."
            echo "BFF_STATUS=\"\$(gcloud app versions describe ${PREV_BFF_VER} --service=chat-bff --project=${GCP_PROJECT_ENV} --format='value(servingStatus)' 2>&1)\" || { echo \"ERROR: describe ${PREV_BFF_VER} failed: \$BFF_STATUS\" >&2; exit 1; }"
            echo "if [ \"\$BFF_STATUS\" != \"SERVING\" ]; then"
            echo "  gcloud app versions start ${PREV_BFF_VER} --service=chat-bff --project=${GCP_PROJECT_ENV} --quiet"
            echo "fi"
            echo "gcloud app services set-traffic chat-bff --splits=${PREV_BFF_VER}=1 --quiet --project=${GCP_PROJECT_ENV}"
        else
            echo "# bff: previous version unknown — inspect: gcloud app versions list --service=chat-bff --project=${GCP_PROJECT_ENV}"
        fi
        echo ""
        if [[ -n "${PREV_FRONT_VER}" ]]; then
            echo "# front (App Engine): describe → start if not SERVING → shift traffic. Fail loud on describe error."
            echo "FRONT_STATUS=\"\$(gcloud app versions describe ${PREV_FRONT_VER} --service=${FRONT_GAE_SERVICE} --project=${GCP_PROJECT_ENV} --format='value(servingStatus)' 2>&1)\" || { echo \"ERROR: describe ${PREV_FRONT_VER} failed: \$FRONT_STATUS\" >&2; exit 1; }"
            echo "if [ \"\$FRONT_STATUS\" != \"SERVING\" ]; then"
            echo "  gcloud app versions start ${PREV_FRONT_VER} --service=${FRONT_GAE_SERVICE} --project=${GCP_PROJECT_ENV} --quiet"
            echo "fi"
            echo "gcloud app services set-traffic ${FRONT_GAE_SERVICE} --splits=${PREV_FRONT_VER}=1 --quiet --project=${GCP_PROJECT_ENV}"
        else
            echo "# front: previous version unknown — inspect: gcloud app versions list --service=${FRONT_GAE_SERVICE} --project=${GCP_PROJECT_ENV}"
        fi
    } > "${ROLLBACK}"
    chmod +x "${ROLLBACK}"

    {
        echo ""
        echo "ℹ️  Pre-deploy revisions (rollback targets if this deploy must be reverted):"
        echo "        core   chat-core               ${PREV_CORE_REV:-<unknown>}"
        echo "        bff    chat-bff                ${PREV_BFF_VER:-<unknown>}"
        echo "        front  ${FRONT_GAE_SERVICE}    ${PREV_FRONT_VER:-<unknown>}"
        echo ""
        echo "    Rollback script written: ${ROLLBACK}"
        echo "    Revert traffic with:     bash ${ROLLBACK}"
    } | tee -a "${LOG}"
}

run_rollback_encryption() {
    local encryption_revision="0128c7c6877c"
    local previous_revision

    previous_revision=$(get_migration_down_revision "${encryption_revision}") || {
        echo "❌ Failed to determine the revision before ${encryption_revision}."
        return 1
    }

    echo "Backward-compatible rollback for migration ${encryption_revision} -> ${previous_revision}"
    echo ""
    echo "ℹ️  How this works in the expand/contract design:"
    echo "    • Plaintext columns (content/noteValue/value) were never modified — data is intact there."
    echo "    • Rolling back = NULL the *Encrypted columns + drop them via tenant downgrade."
    echo "    • No pgp_sym_decrypt necessary; no data loss possible."
    echo ""
    read -p "Proceed? (yes/NO): " confirm
    if [[ "$confirm" != "yes" ]]; then
        echo "Cancelled."
        return 0
    fi

    echo "Downgrading schema (drop *Encrypted + isEncrypted columns + extensions)..."
    if ! execute_db_job "tenant-downgrade-all,--revision,${previous_revision}" "Downgrade tenant schemas"; then
        echo "❌ Tenant downgrade failed."
        return 1
    fi
    if ! execute_db_job "migrate-down,--revision,${previous_revision}" "Downgrade public schema"; then
        echo "❌ Public schema downgrade failed."
        return 1
    fi

    echo "✅ Encryption rollback complete (encrypted columns cleared + schema reverted; plaintext intact)"
}

run_fix_column_aliases() {
    local commit_flag="${1:-}"
    local args="fix-column-aliases"
    [[ "$commit_flag" == "--commit" ]] && args="${args},--commit"
    execute_db_job "${args}" "Fix camelCase column aliases in memberFeed/survey settings"
}

# Function to run schema introspection
run_schema_introspection() {
    echo "Running Drizzle schema introspection..."

    SCHEMA_BUCKET="${GCP_STORAGE_SCHEMA_BUCKET_ENV}"
    echo "Ensuring schema bucket exists: ${SCHEMA_BUCKET}"

    if ! gcloud storage ls "gs://${SCHEMA_BUCKET}" >/dev/null 2>&1; then
        echo "Error: Bucket ${SCHEMA_BUCKET} does not exist."
        echo "Please create it manually before running this script."
        exit 1
    fi

    echo "Building Drizzle introspection Docker image..."
    DOCKER_DEFAULT_PLATFORM=linux/amd64 \
        docker build \
        --progress=plain \
        --build-arg ENV=${ENV} \
        -t "${GCP_REGION_ENV}-docker.pkg.dev/${GCP_PROJECT_ENV}/${GCP_ARTIFACT_ENV}/ligla_drizzle_introspect:latest" \
        -f backend-bff/Dockerfile.drizzle-introspect .

    echo "Pushing Drizzle introspection image to GCP Artifact Registry..."
    docker push "${GCP_REGION_ENV}-docker.pkg.dev/${GCP_PROJECT_ENV}/${GCP_ARTIFACT_ENV}/ligla_drizzle_introspect:latest"
    echo "Deploying Drizzle introspection Cloud Run job..."

    if gcloud run jobs update ligla-drizzle-introspect-job \
        --image=${GCP_REGION_ENV}-docker.pkg.dev/${GCP_PROJECT_ENV}/${GCP_ARTIFACT_ENV}/ligla_drizzle_introspect:latest \
        --set-cloudsql-instances=${GCP_DB_INSTANCE_ENV} \
        --network=${VPC_NETWORK_ENV} \
        --subnet=${VPC_SUBNET_ENV} \
        --vpc-egress=private-ranges-only \
        --service-account=${SERVICE_ACCOUNT} \
        --region=${GCP_REGION_ENV} \
        --project=${GCP_PROJECT_ENV} \
        --memory=1Gi \
        --task-timeout=600s \
        --set-env-vars="USE_CLOUD_SQL_PROXY=true,CLOUD_SQL_CONNECTION_NAME=${GCP_DB_INSTANCE_ENV},GCS_SCHEMA_BUCKET=${SCHEMA_BUCKET},GCS_SCHEMA_PATH=drizzle-schema/raw/schema.ts,GCP_PROJECT_ID=${GCP_PROJECT_ENV}" \
        2>/dev/null; then
        echo "Successfully updated existing job"
    else
        echo "Update failed, attempting to delete and recreate job..."

        gcloud run jobs delete ligla-drizzle-introspect-job \
            --region=${GCP_REGION_ENV} \
            --project=${GCP_PROJECT_ENV} \
            --quiet 2>/dev/null || true
        gcloud run jobs create ligla-drizzle-introspect-job \
            --image=${GCP_REGION_ENV}-docker.pkg.dev/${GCP_PROJECT_ENV}/${GCP_ARTIFACT_ENV}/ligla_drizzle_introspect:latest \
            --set-cloudsql-instances=${GCP_DB_INSTANCE_ENV} \
            --network=${VPC_NETWORK_ENV} \
            --subnet=${VPC_SUBNET_ENV} \
            --vpc-egress=private-ranges-only \
            --service-account=${SERVICE_ACCOUNT} \
            --region=${GCP_REGION_ENV} \
            --project=${GCP_PROJECT_ENV} \
            --memory=1Gi \
            --task-timeout=600s \
            --set-env-vars="USE_CLOUD_SQL_PROXY=true,CLOUD_SQL_CONNECTION_NAME=${GCP_DB_INSTANCE_ENV},GCS_SCHEMA_BUCKET=${SCHEMA_BUCKET},GCS_SCHEMA_PATH=drizzle-schema/raw/schema.ts,GCP_PROJECT_ID=${GCP_PROJECT_ENV}"
    fi

    echo "Running Drizzle introspection..."
    gcloud run jobs execute ligla-drizzle-introspect-job \
        --region=${GCP_REGION_ENV} \
        --project=${GCP_PROJECT_ENV} \
        --wait

    echo "✅ Drizzle introspection completed"
    sleep 15
}

# Function to fetch and validate schema
fetch_schema() {
    echo "Fetching Drizzle schema..."
    cd backend-bff

    npm install @google-cloud/storage @google-cloud/secret-manager dotenv tsx || { echo "❌ Failed to install dependencies"; exit 1; }
    GCS_SCHEMA_BUCKET="${GCP_STORAGE_SCHEMA_BUCKET_ENV}" GCS_SCHEMA_PATH="drizzle-schema/raw/schema.ts" node ./scripts/fetch-schema.js || { echo "❌ fetch-schema.js failed"; exit 1; }
    if grep -q 'pgTable' ./drizzle/raw/schema.ts && grep -q 'drizzle-orm' ./drizzle/raw/schema.ts; then
        echo "Drizzle schema validation passed"
    else
        echo "Drizzle schema validation failed"
        exit 1
    fi

    cd ..
}

# Function to deploy backend core
deploy_core() {
    echo "Deploying backend-core..."
    DOCKER_DEFAULT_PLATFORM=linux/amd64 docker build --progress=plain -t "ligla_core:${ENV}" -f backend-core/Dockerfile.${ENV} .

    echo "Tagging and pushing image to GCP Artifact Registry..."
    docker tag ligla_core:${ENV} ${GCP_REGION_ENV}-docker.pkg.dev/${GCP_PROJECT_ENV}/${GCP_ARTIFACT_ENV}/ligla_core:latest
    docker push ${GCP_REGION_ENV}-docker.pkg.dev/${GCP_PROJECT_ENV}/${GCP_ARTIFACT_ENV}/ligla_core:latest

    MIN_INSTANCES=1
    if [[ "${ENV}" = "stg" ]]; then
        MIN_INSTANCES=0
        APP_ENV="staging"
    else
        APP_ENV="production"
    fi

    echo "Deploying backend-core to Cloud Run..."
    gcloud run deploy chat-core \
        --set-env-vars=ENV=${APP_ENV} \
        --memory=1G --timeout=600 \
        --image=${GCP_REGION_ENV}-docker.pkg.dev/${GCP_PROJECT_ENV}/${GCP_ARTIFACT_ENV}/ligla_core:latest \
        --add-cloudsql-instances=${GCP_DB_INSTANCE_ENV} \
        --network=${VPC_NETWORK_ENV} \
        --subnet=${VPC_SUBNET_ENV} \
        --vpc-egress=private-ranges-only \
        --update-secrets=ENV_VAR_NAME=CHAT_ENV:latest \
        --min-instances=${MIN_INSTANCES} \
        --max-instances=5 \
        --concurrency=500 \
        --cpu-throttling \
        --execution-environment=gen2 \
        --service-account=${SERVICE_ACCOUNT} \
        --platform=managed --ingress=internal --allow-unauthenticated \
        --region=${GCP_REGION_ENV} --project=${GCP_PROJECT_ENV}

    echo "Updating traffic to latest revision for chat-core..."
    gcloud run services update-traffic chat-core \
        --to-latest \
        --region=${GCP_REGION_ENV} \
        --project=${GCP_PROJECT_ENV}
}

# Function to deploy BFF
deploy_bff() {
    echo "Deploying BFF..."
    cd backend-bff
    if [[ ! -f "./drizzle/raw/schema.ts" ]]; then
        echo "❌ Drizzle schema missing. Run 'fetch-schema' first."
        exit 1
    fi

    npm install --include=dev || { echo "❌ Failed to install BFF dependencies"; exit 1; }
    npm run drizzle:post-introspect || { echo "❌ Post-introspect failed"; exit 1; }
    npm run build || { echo "❌ BFF build failed"; exit 1; }
    gcloud app deploy app.${ENV}.yaml --service-account=${SERVICE_ACCOUNT}
    stop_old_gae_versions "chat-bff"

    cd ..
}

# Function to deploy frontend
deploy_frontend() {
    echo "Deploying frontend..."
    cd frontend
    npm install --include=dev || { echo "❌ Failed to install frontend dependencies"; exit 1; }
    cp ../backend-bff/src/schema.gql ./src/schema.gql 2>/dev/null || true
    npm run start:${ENV} || { echo "❌ Frontend build failed"; exit 1; }
    gcloud app deploy app.${ENV}.yaml --service-account=${SERVICE_ACCOUNT}
    local gae_service
    gae_service=$(grep '^service:' "app.${ENV}.yaml" | awk '{print $2}' | tr -d "'" | tr -d '"')
    if [[ -n "${gae_service}" && "${gae_service}" != "default" ]]; then
        stop_old_gae_versions "${gae_service}"
    fi
    cd ..
}

# Function to deploy cloud functions
deploy_functions() {
    echo "Deploying cloud functions..."
    [[ ! -d "functions/datasync" ]] && {
        echo "❗ Error: functions/datasync directory not found!"
        exit 1
    }

    cd functions/datasync

    echo "Deploying ${GCP_FUNCTION_NAME_ENV} to ${ENV} environment... (This may take a while)"

    gcloud functions deploy ${GCP_FUNCTION_NAME_ENV} \
        --gen2 \
        --runtime=python314 \
        --region=${GCP_REGION_ENV} \
        --entry-point=gcs_event_trigger \
        --source=. \
        --trigger-event-filters=type=google.cloud.storage.object.v1.finalized \
        --trigger-event-filters=bucket=${GCP_TRIGGER_BUCKET_ENV} \
        --memory=2G \
        --timeout=540 \
        --project=${GCP_PROJECT_ENV} \
        --service-account=${SERVICE_ACCOUNT} \
        --run-service-account=${FUNCTIONS_RUN_SERVICE_ACCOUNT} \
        --direct-vpc-egress=all

    if gcloud run services describe ${GCP_FUNCTION_NAME_ENV} \
        --region=${GCP_REGION_ENV} \
        --project=${GCP_PROJECT_ENV} \
        --format=yaml 2>/dev/null | grep -q "${GCP_DB_INSTANCE_ENV}"; then
        echo "✅ Cloud SQL instance already attached, skipping update."
    else
        echo "Attaching Cloud SQL to the function's service..."
        gcloud run services update ${GCP_FUNCTION_NAME_ENV} \
            --region=${GCP_REGION_ENV} \
            --project=${GCP_PROJECT_ENV} \
            --add-cloudsql-instances=${GCP_DB_INSTANCE_ENV} \
            --network=${VPC_NETWORK_ENV} \
            --subnet=${VPC_SUBNET_ENV} \
            --direct-vpc-egress=all \
            --verbosity=info

        echo "Updating traffic to latest revision for ${GCP_FUNCTION_NAME_ENV}..."
        gcloud run services update-traffic ${GCP_FUNCTION_NAME_ENV} \
            --to-latest \
            --region=${GCP_REGION_ENV} \
            --project=${GCP_PROJECT_ENV}
    fi

    echo "Verifying function configuration..."
    gcloud run services describe ${GCP_FUNCTION_NAME_ENV} \
        --region=${GCP_REGION_ENV} \
        --project=${GCP_PROJECT_ENV} \
        --format='table(status.url,status.traffic[0].percent:label=TRAFFIC%,spec.template.spec.containers[0].resources.limits.memory:label=MEMORY)' \
        || echo "⚠️  Could not verify Direct VPC egress configuration"

    echo "✅ Cloud function deployment completed"
    cd ../..
}

# Function to deploy member feed data sync
deploy_member_sync() {
    echo "Deploying member feed data sync..."
    [[ ! -d "worker/member-feed-data-sync" ]] && {
        echo "❗ Error: worker/member-feed-data-sync directory not found!"
        exit 1
    }

    echo "Building Docker image for chat-member-feed-sync..."
    DOCKER_DEFAULT_PLATFORM=linux/amd64 docker build --progress=plain -f worker/member-feed-data-sync/Dockerfile.${ENV} -t "chat-member-feed-sync:${ENV}" .

    echo "Tagging and pushing image to GCP Artifact Registry..."
    docker tag chat-member-feed-sync:${ENV} ${GCP_REGION_ENV}-docker.pkg.dev/${GCP_PROJECT_ENV}/${GCP_ARTIFACT_ENV}/chat-member-feed-sync:latest
    docker push ${GCP_REGION_ENV}-docker.pkg.dev/${GCP_PROJECT_ENV}/${GCP_ARTIFACT_ENV}/chat-member-feed-sync:latest

    echo "Deploying chat-member-feed-sync to Cloud Run..."

    gcloud run deploy chat-member-feed-sync \
        --memory=2G --timeout=3600 \
        --image=${GCP_REGION_ENV}-docker.pkg.dev/${GCP_PROJECT_ENV}/${GCP_ARTIFACT_ENV}/chat-member-feed-sync:latest \
        --add-cloudsql-instances=${GCP_DB_INSTANCE_ENV} \
        --network=${VPC_NETWORK_ENV} \
        --subnet=${VPC_SUBNET_ENV} \
        --vpc-egress=all-traffic \
        --update-secrets=ENV_VAR_NAME=CHAT_ENV:latest \
        --min-instances=0 \
        --max-instances=10 \
        --service-account=${SERVICE_ACCOUNT} \
        --concurrency=500 \
        --cpu-throttling \
        --execution-environment=gen2 \
        --platform=managed --ingress=internal --allow-unauthenticated \
        --region=${GCP_REGION_ENV} --project=${GCP_PROJECT_ENV}

    gcloud run services update-traffic chat-member-feed-sync \
        --to-latest \
        --region=${GCP_REGION_ENV} \
        --project=${GCP_PROJECT_ENV}
    echo "✅ Member feed data sync deployed"
}

# Function to deploy malware scanner
deploy_malware_scanner() {
    echo "=========================="
    echo "Deploying Malware Scanner"
    echo "=========================="

    [[ ! -d "functions/gcs-malware-scanner" ]] && {
        echo "❗ Error: functions/gcs-malware-scanner directory not found!"
        exit 1
    }

    echo "Building and deploying malware-scanner to ${ENV} environment..."
    echo "This may take several minutes as it builds the Docker image..."

    cd functions/gcs-malware-scanner

    gcloud run deploy ${MALWARE_SCANNER_SERVICE_NAME} \
        --source . \
        --region=${GCP_REGION_ENV} \
        --project=${GCP_PROJECT_ENV} \
        --no-allow-unauthenticated \
        --memory=4Gi \
        --cpu=1 \
        --concurrency=20 \
        --min-instances=1 \
        --max-instances=${MALWARE_SCANNER_MAX_INSTANCES} \
        --no-cpu-throttling \
        --timeout=600s \
        --set-env-vars=BUCKET_NAME=${MALWARE_SCANNER_BUCKET},GCP_VIRUS_SCAN_RESULT_TOPIC_NAME=${GCP_VIRUS_SCAN_RESULT_TOPIC_NAME_ENV} \
        --service-account=${SERVICE_ACCOUNT} \
        --verbosity=debug

    echo "✅ Malware scanner deployment completed"
    cd ../..
}

# Function to run complete deployment
deploy_all() {
    local _prev_disable_prompts="${CLOUDSDK_CORE_DISABLE_PROMPTS:-}"
    export CLOUDSDK_CORE_DISABLE_PROMPTS=1

    setup_config
    run_migrations
    run_schema_introspection
    fetch_schema
    deploy_core
    deploy_bff
    deploy_frontend
    deploy_functions
    deploy_member_sync
    deploy_malware_scanner

    export CLOUDSDK_CORE_DISABLE_PROMPTS="${_prev_disable_prompts}"

    echo "✅ Deployment complete"
}

migrate_and_deploy() {
    export CLOUDSDK_CORE_DISABLE_PROMPTS=1

    local maintenance_mode=0
    for arg in "$@"; do
        case "$arg" in
            --maintenance) maintenance_mode=1 ;;
            *) echo "❌ Unknown flag: ${arg}"; exit 1 ;;
        esac
    done

    local total=5
    [[ "${maintenance_mode}" == "1" ]] && total=6
    local step=0

    local WHO TS LOG BACKUP _maintenance_on=0
    WHO=$(gcloud config get-value account 2>/dev/null | cut -d'@' -f1)
    TS=$(date +%Y%m%d-%H%M%S)
    mkdir -p ./.deploy-logs
    LOG="./.deploy-logs/ligla-deploy-${TS}.log"
    BACKUP="migrate-and-deploy-${ENV}-${TS}-${WHO}"

    trap '
        if [[ "${_maintenance_on}" == "1" ]]; then
            echo "⚠️  Turning off maintenance mode before exit..."
            unset VITE_MAINTENANCE_MODE_ACTIVE
            deploy_frontend >> "${LOG}" 2>&1 && echo "✅ Maintenance OFF" || echo "❌ Maintenance OFF failed — run: bash deploy-local.sh deploy-front"
        fi
    ' EXIT

    local mode_label="without maintenance"
    [[ "${maintenance_mode}" == "1" ]] && mode_label="with maintenance"

    echo ""
    echo "migrate-and-deploy [${ENV}] (${mode_label})  log: ${LOG}"
    echo "⚠️  Instance: ${DB_INSTANCE}  Project: ${GCP_PROJECT_ENV}  Backup: ${BACKUP}"
    read -p "   Proceed? (yes/NO): " _confirm
    [[ "$_confirm" != "yes" ]] && { echo "Cancelled."; exit 0; }

    echo "[pre] Cloud SQL backup"
    gcloud sql backups create --instance="${DB_INSTANCE}" --description="${BACKUP}" --project="${GCP_PROJECT_ENV}" \
        || { echo "❌ Backup failed. Aborting."; exit 1; }

    if [[ "${maintenance_mode}" == "1" ]]; then
        step=$((step+1))
        echo "[${step}/${total}] Maintenance ON"
        export VITE_MAINTENANCE_MODE_ACTIVE=true
        deploy_frontend >> "${LOG}" 2>&1 || { echo "❌ [${step}/${total}] failed — see ${LOG}"; exit 1; }
        _maintenance_on=1
        unset VITE_MAINTENANCE_MODE_ACTIVE
    fi

    step=$((step+1))
    echo "[${step}/${total}] Build DB job image"
    build_db_job_image >> "${LOG}" 2>&1 || { echo "❌ [${step}/${total}] failed — see ${LOG}"; exit 1; }

    step=$((step+1))
    echo "[${step}/${total}] Apply migrations"
    execute_db_job "migrate-up,--revision,head" "Alembic upgrade to head" >> "${LOG}" 2>&1 \
        || { echo "❌ [${step}/${total}] failed — see ${LOG}"; exit 1; }
    # Tenant split is no longer part of the standard release flow now that the
    # schema-per-tenant rollout is complete. Run manually via
    # `bash deploy-local.sh tenant-split` if ever needed again.
    # run_tenant_split --yes >> "${LOG}" 2>&1 || { echo "❌ failed — see ${LOG}"; exit 1; }

    step=$((step+1))
    echo "[${step}/${total}] Schema introspection"
    run_schema_introspection >> "${LOG}" 2>&1 || { echo "❌ [${step}/${total}] failed — see ${LOG}"; exit 1; }
    fetch_schema             >> "${LOG}" 2>&1 || { echo "❌ [${step}/${total}] failed — see ${LOG}"; exit 1; }

    step=$((step+1))
    echo "[${step}/${total}] Deploy services (parallel)"
    local pids=() names=() failed=()
    deploy_core        >> "${LOG}.core"        2>&1 & pids+=($!); names+=("core")
    deploy_bff         >> "${LOG}.bff"         2>&1 & pids+=($!); names+=("bff")
    deploy_functions   >> "${LOG}.functions"   2>&1 & pids+=($!); names+=("functions")
    deploy_member_sync >> "${LOG}.member-sync" 2>&1 & pids+=($!); names+=("member-sync")
    local remaining=("${pids[@]}") remaining_names=("${names[@]}")
    while [[ ${#remaining[@]} -gt 0 ]]; do
        local still_running=() still_names=()
        for i in "${!remaining[@]}"; do
            local pid="${remaining[$i]}" name="${remaining_names[$i]}"
            if ! kill -0 "$pid" 2>/dev/null; then
                wait "$pid" && echo "  ${name} ✅" || { echo "  ${name} ❌"; failed+=("$name"); }
            elif ps -o stat= -p "$pid" 2>/dev/null | grep -q 'Z'; then
                wait "$pid" && echo "  ${name} ✅" || { echo "  ${name} ❌"; failed+=("$name"); }
            else
                still_running+=("$pid"); still_names+=("$name")
            fi
        done
        remaining=("${still_running[@]+"${still_running[@]}"}") remaining_names=("${still_names[@]+"${still_names[@]}"}")
        [[ ${#remaining[@]} -gt 0 ]] && { echo "  waiting: ${still_names[*]}"; sleep 5; }
    done
    cat "${LOG}".{core,bff,functions,member-sync} >> "${LOG}" 2>/dev/null
    [[ ${#failed[@]} -gt 0 ]] && { echo "❌ [${step}/${total}] failed: ${failed[*]}"; exit 1; }

    local fe_label="Frontend"
    [[ "${_maintenance_on}" == "1" ]] && fe_label="Frontend - Maintenance OFF"
    step=$((step+1))
    echo "[${step}/${total}] ${fe_label}"
    _maintenance_on=0
    deploy_frontend >> "${LOG}" 2>&1 || { echo "❌ [${step}/${total}] failed — see ${LOG}"; exit 1; }

    echo "✅ Deploy complete"
}

deploy_all_services() {
    export CLOUDSDK_CORE_DISABLE_PROMPTS=1

    local skip_fetch_schema="${1:-}"

    local TS LOG
    TS=$(date +%Y%m%d-%H%M%S)
    mkdir -p ./.deploy-logs
    LOG="./.deploy-logs/ligla-deploy-${TS}.log"

    echo "deploy-all-services [${ENV}]  log: ${LOG}"

    if [[ "${skip_fetch_schema}" != "--skip-fetch-schema" ]]; then
        fetch_schema >> "${LOG}" 2>&1 || { echo "❌ fetch-schema failed — see ${LOG}"; exit 1; }
    fi

    echo "Deploying all services in parallel..."
    local pids=() names=() failed=()

    deploy_core        >> "${LOG}.core"        2>&1 & pids+=($!); names+=("core")
    deploy_bff         >> "${LOG}.bff"         2>&1 & pids+=($!); names+=("bff")
    deploy_functions   >> "${LOG}.functions"   2>&1 & pids+=($!); names+=("functions")
    deploy_member_sync >> "${LOG}.member-sync" 2>&1 & pids+=($!); names+=("member-sync")
    deploy_frontend    >> "${LOG}.frontend"    2>&1 & pids+=($!); names+=("frontend")

    local remaining=("${pids[@]}") remaining_names=("${names[@]}")
    while [[ ${#remaining[@]} -gt 0 ]]; do
        local still_running=() still_names=()
        for i in "${!remaining[@]}"; do
            local pid="${remaining[$i]}" name="${remaining_names[$i]}"
            if ! kill -0 "$pid" 2>/dev/null; then
                wait "$pid" && echo "  ${name} ✅" || { echo "  ${name} ❌"; failed+=("$name"); }
            elif ps -o stat= -p "$pid" 2>/dev/null | grep -q 'Z'; then
                wait "$pid" && echo "  ${name} ✅" || { echo "  ${name} ❌"; failed+=("$name"); }
            else
                still_running+=("$pid"); still_names+=("$name")
            fi
        done
        remaining=("${still_running[@]+"${still_running[@]}"}") remaining_names=("${still_names[@]+"${still_names[@]}"}")
        [[ ${#remaining[@]} -gt 0 ]] && { echo "  waiting: ${still_names[*]}"; sleep 5; }
    done

    cat "${LOG}".{core,bff,functions,member-sync,frontend} >> "${LOG}" 2>/dev/null
    [[ ${#failed[@]} -gt 0 ]] && { echo "❌ failed: ${failed[*]}"; exit 1; }

    echo "✅ Deploy complete"
}

case "$1" in
setup)              setup_config ;;
db-job)             setup_config; build_db_job_image ;;
migrate)            setup_config; run_migrations ;;
downgrade)          setup_config; downgrade_migration "${2:--1}" ;;
deploy-encryption)  setup_config; deploy_encryption "${@:2}" ;;
tenant-encrypt)     setup_config; preflight_encryption_key; run_tenant_encrypt ;;
tenant-encrypt-commit) setup_config; preflight_encryption_key; run_tenant_encrypt --commit ;;
tenant-decrypt)     setup_config; preflight_encryption_key; run_tenant_decrypt ;;
tenant-decrypt-commit) setup_config; preflight_encryption_key; run_tenant_decrypt --commit ;;
tenant-chat-search-indexes) setup_config; preflight_encryption_key; run_tenant_chat_search_indexes create ;;
tenant-chat-search-indexes-commit) setup_config; preflight_encryption_key; run_tenant_chat_search_indexes create --commit ;;
tenant-chat-search-indexes-drop) setup_config; build_db_job_image; run_tenant_chat_search_indexes drop ;;
tenant-chat-search-indexes-drop-commit) setup_config; build_db_job_image; run_tenant_chat_search_indexes drop --commit ;;
tenant-downgrade-all)
    setup_config
    build_db_job_image
    case "${2:-}" in
        --revision) _rev="${3:--1}" ;;
        rev=*)      _rev="${2#rev=}" ;;
        "")         _rev="-1" ;;
        *)          _rev="${2}" ;;
    esac
    execute_db_job "tenant-downgrade-all,--revision,${_rev}" "Downgrade all tenant schemas to ${_rev}"
    ;;
rollback-encryption) setup_config; run_rollback_encryption ;;
schema)             setup_config; run_schema_introspection ;;
fetch-schema)       setup_config; fetch_schema ;;
deploy-core)        setup_config; deploy_core ;;
deploy-bff)         setup_config; fetch_schema; deploy_bff ;;
deploy-front)       setup_config; deploy_frontend ;;
deploy-front-maintenance) setup_config; export VITE_MAINTENANCE_MODE_ACTIVE=true; deploy_frontend ;;
deploy-functions)   setup_config; deploy_functions ;;
deploy-member-sync) setup_config; deploy_member_sync ;;
deploy-malware-scanner) setup_config; deploy_malware_scanner ;;
deploy-all)         deploy_all ;;
deploy-all-services) setup_config; deploy_all_services ;;
migrate-and-deploy) setup_config; migrate_and_deploy "${@:2}" ;;
run-job)            setup_config; execute_db_job "${2}" "${2}" ;;
help|--help|-h)     print_usage ;;
*)                  echo "Error: Invalid command '$1'"; print_usage; exit 1 ;;
esac
