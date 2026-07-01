import re
from datetime import datetime, timezone
from pathlib import Path

from google.auth.credentials import AnonymousCredentials
from google.cloud import storage
from google.cloud.exceptions import GoogleCloudError, NotFound

from app.core.config import AppENV, settings
from app.core.errors import FileNotFoundError, FileValidationError, GCSOperationError, OrganizationNotFoundError
from app.core.logger import logger


def _get_storage_client():
    # Check if we're in local environment instead of just emulator host
    if settings.ENV == AppENV.LOCAL and settings.GCS_EMULATOR_HOST:
        emulator_host = settings.GCS_EMULATOR_HOST
        logger.info(f"Using GCS emulator: {emulator_host}")
        return storage.Client(
            credentials=AnonymousCredentials(),
            project=settings.GCP_PROJECT_ID,
            client_options={"api_endpoint": emulator_host},
        )
    else:
        logger.info("Using production GCS")
        return storage.Client(project=settings.GCP_PROJECT_ID)


async def discover_pending_files() -> dict[str, dict]:
    logger.info("Discovering pending files")

    try:
        client = _get_storage_client()
        bucket = client.bucket(settings.GCP_STORAGE_CHAT_DATA_BUCKET)
        pending_files = {}

        for blob in bucket.list_blobs():
            if _is_landing_file(blob.name):
                org_name = extract_org_name(blob.name)
                if org_name and _validate_file_size(blob):
                    file_info = {
                        "org_name": org_name,
                        "file_path": blob.name,
                        "file_size": blob.size,
                        "discovered_at": datetime.now(timezone.utc),
                    }

                    # Keep only the newest file per organization
                    if org_name not in pending_files or _is_newer_file(blob.name, pending_files[org_name]["file_path"]):
                        pending_files[org_name] = file_info

        logger.info(
            f"Stage file_discovery completed: org=all_organizations duration=0.0s records={len(pending_files)} file=organizations: {list(pending_files.keys())}"
        )
        logger.info(f"Found {len(pending_files)} organizations: {list(pending_files.keys())}")
        return pending_files

    except GoogleCloudError as e:
        logger.error(f"GCS file discovery failed: {e}")
        logger.error(
            f"File file_discovery failed for all_organizations: gs://{settings.GCP_STORAGE_CHAT_DATA_BUCKET}/* - {e}"
        )
        raise GCSOperationError("file discovery", str(e))
    except Exception as e:
        # Generic exception handler for unexpected errors
        logger.error(f"Unexpected error during file discovery: {e}")
        raise GCSOperationError("file discovery", f"Unexpected error: {str(e)}")


async def validate_file(file_path: str) -> None:
    logger.info(f"Validating {file_path}")

    try:
        client = _get_storage_client()
        bucket = client.bucket(settings.GCP_STORAGE_CHAT_DATA_BUCKET)
        blob = bucket.blob(file_path)

        if not blob.exists():
            raise FileNotFoundError(file_path)

        logger.info(f"File validation passed: {file_path}")

    except (FileNotFoundError, FileValidationError):
        raise
    except NotFound:
        raise FileNotFoundError(file_path)
    except GoogleCloudError as e:
        org_name = extract_org_name(file_path) or "unknown"
        logger.error(f"File file_validation failed for {org_name}: {file_path} - {e}")
        raise GCSOperationError("file validation", str(e))


async def move_to_processed(file_path: str) -> str:
    logger.info(f"Moving to processed: {file_path}")

    try:
        org_name = extract_org_name(file_path)
        if not org_name:
            raise OrganizationNotFoundError(file_path)

        filename = Path(file_path).name
        processed_path = f"{org_name}/client_users/processed/{filename}"

        _move_file(file_path, processed_path)

        logger.info(f"Stage move_to_processed completed: org={org_name} duration=0.0s records=1 file={processed_path}")
        logger.info(f"Moved to processed: {processed_path}")
        return processed_path

    except GoogleCloudError as e:
        logger.error(f"GCS failed to move to processed: {e}")
        logger.error(f"File move_to_processed failed for {org_name or 'unknown'}: {file_path} - {e}")
        raise GCSOperationError("move to processed", str(e))


async def move_to_failed(file_path: str, error_message: str) -> str:
    logger.warning(f"Moving to failed: {file_path}")

    try:
        org_name = extract_org_name(file_path)
        if not org_name:
            raise OrganizationNotFoundError(file_path)

        filename = Path(file_path).name
        failed_path = f"{org_name}/client_users/failed/{filename}"

        _move_file(file_path, failed_path)
        _create_error_log(failed_path, file_path, org_name, error_message)

        logger.info(f"Stage move_to_failed completed: org={org_name} duration=0.0s records=1 file={failed_path}")
        logger.warning(f"Moved to failed: {failed_path}")
        return failed_path

    except GoogleCloudError as e:
        logger.error(f"GCS failed to move to failed: {e}")
        logger.error(
            f"File move_to_failed failed for {org_name or 'unknown'}: {file_path} - {e} (context: {error_message})"
        )
        raise GCSOperationError("move to failed", str(e))


def get_gcs_uri(file_path: str) -> str:
    if file_path.startswith("gs://"):
        return file_path
    return f"gs://{settings.GCP_STORAGE_CHAT_DATA_BUCKET}/{file_path}"


# Helper functions
def _is_landing_file(blob_name: str) -> bool:
    return "/client_users/" in blob_name and (
        blob_name.endswith(".csv") or blob_name.endswith(".csv.gz") or blob_name.endswith(".gzip")
    )


def extract_org_name(file_path: str) -> str | None:
    try:
        parts = file_path.split("/")

        # ONLY accept client_users format: org_name/client_users/filename
        if len(parts) == 3 and parts[1] == "client_users":
            return parts[0]

        return None
    except Exception:
        return None


def _validate_file_size(blob) -> bool:
    try:
        max_size_bytes = settings.MAX_FILE_SIZE_GB * 1024 * 1024 * 1024
        return 0 < blob.size <= max_size_bytes
    except Exception:
        return False


def _is_newer_file(file1: str, file2: str) -> bool:
    file_pattern = re.compile(r"-client_user_data-(\d{8})\.csv\.gz$")

    try:

        def extract_date(file_path):
            filename = Path(file_path).name
            match = file_pattern.search(filename)
            if match:
                return datetime.strptime(match.group(1), "%Y%m%d")
            return None

        date1 = extract_date(file1)
        date2 = extract_date(file2)

        if date1 and date2:
            return date1 > date2
        return False

    except Exception:
        return False


def _move_file(source_path: str, destination_path: str) -> None:
    client = _get_storage_client()
    bucket = client.bucket(settings.GCP_STORAGE_CHAT_DATA_BUCKET)

    source_blob = bucket.blob(source_path)
    destination_blob = bucket.blob(destination_path)

    destination_blob.rewrite(source_blob)
    source_blob.delete()


def _create_error_log(failed_path: str, original_path: str, org_name: str, error_message: str) -> None:
    client = _get_storage_client()
    bucket = client.bucket(settings.GCP_STORAGE_CHAT_DATA_BUCKET)

    error_log_path = failed_path.replace(".csv.gz", ".error.txt")
    error_blob = bucket.blob(error_log_path)

    error_content = f"""Member Sync Error Report
                        ========================

                        File: {original_path}
                        Organization: {org_name}
                        Failed At: {datetime.now(timezone.utc).isoformat()}
                        Error: {error_message}
                        """

    error_blob.upload_from_string(error_content.strip())
    logger.info(f"Error log created: {error_log_path}")
