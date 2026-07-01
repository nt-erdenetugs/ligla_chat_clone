import time
from dataclasses import dataclass, field
from typing import Any

from google.api_core.exceptions import GoogleAPIError
from google.cloud import storage
from google.cloud.exceptions import NotFound

from app.common.utils import get_logger
from app.config.settings import settings

logger = get_logger(__name__)


@dataclass
class DeletionProgress:
    organization_folder: str
    total_blobs: int = 0
    deleted_blobs: int = 0
    failed_blobs: list[str] = field(default_factory=list)
    bucket_status: dict[str, dict[str, Any]] = field(default_factory=dict)
    deleted_file_types: dict[str, int] = field(default_factory=dict)

    def update_bucket_totals(self, bucket_name: str, count: int):
        if bucket_name not in self.bucket_status:
            self.bucket_status[bucket_name] = {"total": 0, "deleted": 0, "failed": 0}
        self.bucket_status[bucket_name]["total"] = count
        self.total_blobs += count

    def increment_deleted(self, bucket_name: str, blob_name: str):
        self.deleted_blobs += 1
        self.bucket_status[bucket_name]["deleted"] += 1

        file_extension = blob_name.split(".")[-1].lower() if "." in blob_name else "unknown"
        self.deleted_file_types[file_extension] = self.deleted_file_types.get(file_extension, 0) + 1

    def add_failure(self, bucket_name: str, blob_name: str):
        self.failed_blobs.append(blob_name)
        self.bucket_status[bucket_name]["failed"] += 1

    def get_summary(self) -> dict[str, Any]:
        return {
            "organization_folder": self.organization_folder,
            "total_blobs": self.total_blobs,
            "deleted_blobs": self.deleted_blobs,
            "failed_blobs_count": len(self.failed_blobs),
            "bucket_status": self.bucket_status,
            "file_types_deleted": self.deleted_file_types,
            "completion_percentage": (self.deleted_blobs / self.total_blobs * 100) if self.total_blobs > 0 else 100,
        }


def get_bucket(storage_client: storage.Client, bucket_name: str) -> storage.Bucket:
    try:
        return storage_client.bucket(bucket_name)
    except Exception as e:
        logger.error(f"Error creating bucket reference for {bucket_name}: {str(e)}")
        raise GoogleAPIError(f"Error creating bucket reference for {bucket_name}: {str(e)}")


def find_organization_objects(bucket: storage.Bucket, organization_folder: str) -> list[Any]:
    try:
        prefix = f"{organization_folder}"
        logger.info(f"Finding all objects starting with: {prefix}")

        iterator = bucket.list_blobs(prefix=prefix)
        all_objects = []

        for page in iterator.pages:
            for blob in list(page):
                all_objects.append(blob)

        if not all_objects:
            logger.info(f"No objects found for organization {organization_folder}")
            return []

        # Sort by depth (deepest first) to delete files before parent folders
        # This ensures files are deleted before their parent directories
        # Example: file.csv (depth 3) before stores/ (depth 2) before test_org/ (depth 1)
        # This approach prevents issues with GCS trying to delete parent folders before their contents
        all_objects.sort(key=lambda obj: obj.name.count("/"), reverse=True)

        logger.info(f"Found {len(all_objects)} objects to delete")
        for obj in all_objects:
            logger.debug(f"Will delete: {obj.name}")

        return all_objects

    except Exception as e:
        logger.error(f"Error finding organization objects: {str(e)}")
        return []


def delete_blobs_in_batches(
    storage_client: storage.Client,
    bucket: storage.Bucket,
    blobs: list[Any],
    progress_tracker: DeletionProgress,
    batch_size: int = 100,
):
    blob_batch = []

    for blob in blobs:
        blob_batch.append(blob)

        if len(blob_batch) >= batch_size:
            _process_deletion_batch(storage_client, bucket, blob_batch, progress_tracker)
            blob_batch = []

    if blob_batch:
        _process_deletion_batch(storage_client, bucket, blob_batch, progress_tracker)


def _process_deletion_batch(
    storage_client: storage.Client, bucket: storage.Bucket, blob_batch: list[Any], progress_tracker: DeletionProgress
):
    batch_succeeded = False
    if not bucket.name:
        raise NotFound("Bucket name for client was not provided")
    try:
        with storage_client.batch():
            for blob in blob_batch:
                blob.delete()
        batch_succeeded = True

    except Exception as batch_error:
        logger.error(f"Batch deletion failed: {str(batch_error)}")
        batch_succeeded = False

    # Only mark as deleted if batch succeeded
    if batch_succeeded:
        for blob in blob_batch:
            progress_tracker.increment_deleted(bucket.name, blob.name)
            logger.debug(f"Successfully deleted: {blob.name}")
    else:
        for blob in blob_batch:
            progress_tracker.add_failure(bucket.name, blob.name)


def delete_organization_data(organization_folder: str) -> dict[str, Any]:
    start_time = time.time()
    progress = DeletionProgress(organization_folder=organization_folder)
    logger.info(f"Deleting organization: {organization_folder}")

    try:
        client_options = {"api_endpoint": settings.GCS_EMULATOR_HOST} if settings.GCS_EMULATOR_HOST else None
        storage_client = storage.Client(client_options=client_options)
        bucket_names = [
            settings.GCP_STORAGE_CHAT_DATA_BUCKET,
            settings.GCP_STORAGE_CHAT_PUBLIC_DATA_BUCKET,
        ]

        for bucket_name in bucket_names:
            try:
                bucket = get_bucket(storage_client, bucket_name)

                # Find all objects (files and folders) for this organization
                all_objects = find_organization_objects(bucket, organization_folder)
                total_count = len(all_objects)
                progress.update_bucket_totals(bucket_name, total_count)

                if total_count > 0:
                    logger.info(f"Deleting {total_count} objects from bucket {bucket_name}")

                    # Delete in order: deepest files first, then parent folders
                    delete_blobs_in_batches(storage_client, bucket, all_objects, progress)

                    bucket_stats = progress.bucket_status[bucket_name]
                    failed = bucket_stats.get("failed", 0)

                    if failed == 0:
                        logger.info(f"Successfully deleted all objects from bucket {bucket_name}")
                    else:
                        logger.warning(f"Failed to delete {failed}/{total_count} objects from bucket {bucket_name}")
                else:
                    logger.info(f"No objects found in bucket {bucket_name}")

            except Exception as e:
                logger.error(f"Error processing bucket {bucket_name}: {str(e)}")
                progress.bucket_status[bucket_name] = {"error": str(e)}

        duration = time.time() - start_time
        summary = progress.get_summary()
        summary["duration_seconds"] = duration

        if progress.total_blobs == 0:
            logger.info(f"Organization {organization_folder} not found")
        elif progress.failed_blobs:
            logger.warning(f"Partial deletion: {progress.deleted_blobs}/{progress.total_blobs} objects deleted")
        else:
            logger.info(f"Successfully deleted organization {organization_folder} completely")

        return summary

    except Exception as e:
        logger.error(f"Error deleting organization: {str(e)}")
        return {"error": str(e), "deleted_blobs": 0, "total_blobs": 0}
