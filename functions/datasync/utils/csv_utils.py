from collections.abc import Generator
import csv
import io
from typing import Any
from google.cloud import storage
from google.cloud.storage.fileio import BlobReader
from logger import logger, FileValidationError
from schemas.csv_data import CSVData
from config import settings


def _get_blob(bucket_name: str, file_name: str) -> storage.Blob:
    client_options = {"api_endpoint": settings.GCS_EMULATOR_HOST} if settings.GCS_EMULATOR_HOST else None
    storage_client = storage.Client(client_options=client_options)
    bucket = storage_client.bucket(bucket_name)
    return bucket.blob(file_name)


def read_csv_from_bucket(
    bucket_name: str,
    file_name: str,
    dataType: type[CSVData],
    max_rows: int | None = None,
) -> Generator[dict[str, Any], None, None]:
    logger.info(
        f"Streaming CSV file '{file_name}' from bucket '{bucket_name}'..."
    )
    blob = _get_blob(bucket_name, file_name)

    # Check for UTF-8 BOM to set correct encoding
    first_bytes = blob.download_as_bytes(start=0, end=3)
    encoding = 'utf-8-sig' if first_bytes.startswith(b'\xef\xbb\xbf') else 'utf-8'

    try:
        with BlobReader(blob) as blob_reader:
            with io.TextIOWrapper(blob_reader, encoding=encoding, errors='strict') as text_wrapper:
                reader = csv.DictReader(text_wrapper)
                row_count = 0
                for line in reader:
                    row_count += 1
                    if max_rows and row_count > max_rows:
                        break
                    try:
                        yield dataType(**line).model_dump()
                    except FileValidationError as e:
                        logger.error(f"Invalid data in CSV file: {str(e)}")

                logger.info(f"Finished processing {row_count} rows from file {file_name}")

    except Exception as e:
        logger.error(f"Error processing file {file_name} from bucket {bucket_name}: {e}")
        raise
