import time
import gzip
import csv
import io
import psycopg2
from datetime import datetime, timezone

from app.core.config import settings
from app.core.errors import CloudSQLImportError
from app.core.logger import logger
from app.pipeline.data_processing.gcs_handler import _get_storage_client


class CSVConfig:
    ID_COLUMNS = 0
    CLIENT_ID_COLUMNS = 1
    CATEGORY_COLUMNS = 25
    NUMBER_COLUMNS = 15
    DATETIME_COLUMNS = 15
    TOTAL_REQUIRED_COLUMNS = (
        ID_COLUMNS
        + CLIENT_ID_COLUMNS
        + CATEGORY_COLUMNS
        + NUMBER_COLUMNS
        + DATETIME_COLUMNS
    )
    MIN_VIABLE_ROW_LENGTH = 20


def detect_column_positions_from_schema(header_fields):
    positions = {
        "client_user_id": None,
        "category_1": None,
        "number_1": None,
        "datetime_1": None,
    }

    for i, field in enumerate(header_fields):
        field_clean = field.strip().lower()

        if field_clean == "client_user_id":
            positions["client_user_id"] = i
        elif field_clean == "category_1":
            positions["category_1"] = i
        elif field_clean == "number_1":
            positions["number_1"] = i
        elif field_clean == "datetime_1":
            positions["datetime_1"] = i

    logger.info(f"Schema positions: {positions}")
    return positions


def get_schema_structure(positions):
    structure = {
        "categories": 25,
        "numbers": 15,
        "datetimes": 15,
        "category_start_pos": positions["category_1"],
        "number_start_pos": positions["number_1"],
        "datetime_start_pos": positions["datetime_1"],
    }

    logger.info(
        f"Schema structure: {structure['categories']} cats + {structure['numbers']} nums + {structure['datetimes']} dates"
    )
    return structure


def build_optimized_mapping(row, mapping, org_name):
    mapped_row = []

    client_pos = mapping["client_user_id_pos"]
    mapped_row.append(
        row[client_pos] if client_pos is not None and client_pos < len(row) else ""
    )

    cat_start = mapping["category_start_pos"]
    if cat_start is not None:
        for i in range(25):
            csv_pos = cat_start + i
            mapped_row.append(row[csv_pos] if csv_pos < len(row) else "")
    else:
        for _ in range(25):
            mapped_row.append("")

    num_start = mapping["number_start_pos"]
    if num_start is not None:
        for i in range(15):
            csv_pos = num_start + i
            mapped_row.append(row[csv_pos] if csv_pos < len(row) else "")
    else:
        for _ in range(15):
            mapped_row.append("")

    dt_start = mapping["datetime_start_pos"]
    if dt_start is not None:
        for i in range(15):
            csv_pos = dt_start + i
            mapped_row.append(row[csv_pos] if csv_pos < len(row) else "")
    else:
        for _ in range(15):
            mapped_row.append("")

    return mapped_row[: CSVConfig.TOTAL_REQUIRED_COLUMNS]


class StreamWrapper:
    def __init__(self, generator):
        self.generator = generator
        self.buffer = ""
        self.closed = False

    def read(self, size=-1):
        if self.closed:
            return ""

        if size == -1:
            result = self.buffer + "".join(self.generator)
            self.buffer = ""
            return result

        while len(self.buffer) < size:
            try:
                self.buffer += next(self.generator)
            except StopIteration:
                self.closed = True
                break

        result = self.buffer[:size]
        self.buffer = self.buffer[size:]
        return result

    def readline(self):
        try:
            return next(self.generator)
        except StopIteration:
            return ""


async def import_csv_to_tenant_table(
    gcs_uri: str, staging_table: str, org_name: str, schema_name: str
) -> int:
    start_time = time.time()
    qualified_table = f'"{schema_name}"."{staging_table}"'
    logger.info(f"Starting streaming upload: {gcs_uri} -> {qualified_table}")

    try:
        database_url = settings.get_database_url()

        with psycopg2.connect(database_url) as conn:
            with conn.cursor() as cur:
                # Clear any existing data (shouldn't be any in new staging table)
                logger.info(f"Clearing existing data from {qualified_table}")
                cur.execute(f"DELETE FROM {qualified_table}")

                # Stream gzipped CSV from GCS
                logger.info(f"Streaming gzipped CSV from GCS: {gcs_uri}")
                storage_client = _get_storage_client()
                bucket = storage_client.bucket(settings.GCP_STORAGE_CHAT_DATA_BUCKET)
                blob_path = gcs_uri.replace(
                    f"gs://{settings.GCP_STORAGE_CHAT_DATA_BUCKET}/", ""
                )
                blob = bucket.blob(blob_path)

                if not blob.exists():
                    raise CloudSQLImportError(
                        "file_not_found",
                        f"File does not exist: {gcs_uri}",
                        organization=org_name,
                    )

                # Process CSV and stream to database
                logger.info(
                    f"Starting bulk insert for {org_name} using PostgreSQL COPY FROM STDIN"
                )
                with blob.open("rb") as binary_stream:
                    with gzip.open(binary_stream, "rt", encoding="utf-8") as csv_stream:
                        header = next(csv_stream)
                        header_fields = header.strip().split(",")
                        logger.info(f"CSV header: {len(header_fields)} columns")

                        # Analyze CSV structure
                        schema_positions = detect_column_positions_from_schema(
                            header_fields
                        )

                        if schema_positions["client_user_id"] is None:
                            raise CloudSQLImportError(
                                "schema_mismatch",
                                "client_user_id column not found in CSV header",
                                organization=org_name,
                            )
                        if schema_positions["category_1"] is None:
                            raise CloudSQLImportError(
                                "schema_mismatch",
                                "category_1 column not found in CSV header",
                                organization=org_name,
                            )

                        structure = get_schema_structure(schema_positions)
                        logger.info(
                            f"Structure cached: {structure['categories']} cats + {structure['numbers']} nums + {structure['datetimes']} dates"
                        )

                        # Create mapping cache
                        cached_mapping = {
                            "client_user_id_pos": schema_positions["client_user_id"],
                            "category_start_pos": schema_positions["category_1"],
                            "categories_count": structure["categories"],
                            "number_start_pos": schema_positions["number_1"],
                            "numbers_count": structure["numbers"],
                            "datetime_start_pos": schema_positions["datetime_1"],
                            "datetimes_count": structure["datetimes"],
                        }

                        logger.info(
                            f"Mapping: clientUserId[{cached_mapping['client_user_id_pos']}] cats[{cached_mapping['category_start_pos']}] nums[{cached_mapping['number_start_pos']}] dates[{cached_mapping['datetime_start_pos']}]"
                        )

                        # Create optimized stream generator
                        def create_optimized_stream():
                            csv_reader = csv.reader(csv_stream)
                            processed_count = 0

                            for row in csv_reader:
                                processed_count += 1

                                if processed_count % 50000 == 0:
                                    logger.info(
                                        f"Processed {processed_count:,} rows..."
                                    )

                                try:
                                    if len(row) >= CSVConfig.MIN_VIABLE_ROW_LENGTH:
                                        mapped_row = build_optimized_mapping(
                                            row, cached_mapping, org_name
                                        )

                                        output = io.StringIO()
                                        csv.writer(output).writerow(mapped_row)
                                        yield output.getvalue()

                                except Exception as e:
                                    if processed_count <= 10:
                                        logger.error(
                                            f"Error processing row {processed_count}: {e}"
                                        )
                                    continue

                            logger.info(
                                f"Completed processing {processed_count:,} total rows"
                            )

                        # Stream to database using schema-qualified table name
                        filtered_stream = StreamWrapper(create_optimized_stream())

                        cur.copy_expert(
                            f"""
                            COPY {qualified_table}
                            ("clientUserId",
                             category1, category2, category3, category4, category5,
                             category6, category7, category8, category9, category10,
                             category11, category12, category13, category14, category15,
                             category16, category17, category18, category19, category20,
                             category21, category22, category23, category24, category25,
                             number1, number2, number3, number4, number5,
                             number6, number7, number8, number9, number10,
                             number11, number12, number13, number14, number15,
                             datetime1, datetime2, datetime3, datetime4, datetime5,
                             datetime6, datetime7, datetime8, datetime9, datetime10,
                             datetime11, datetime12, datetime13, datetime14, datetime15)
                            FROM STDIN WITH (FORMAT CSV)
                        """,
                            filtered_stream,
                        )

                        # Set missing columns and timestamps
                        current_time = datetime.now(timezone.utc)
                        cur.execute(
                            f"""
                            UPDATE {qualified_table}
                            SET "lineUserId" = NULL,
                                "syncedAt" = %s,
                                "importedAt" = %s,
                                "updatedAt" = %s
                            WHERE "createdAt" IS NOT NULL
                        """,
                            (current_time, current_time, current_time),
                        )

                # Verify critical columns exist before commit
                cur.execute(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = %s
                    AND table_name = %s
                    AND column_name IN ('createdAt', 'updatedAt', 'importedAt', 'syncedAt')
                """,
                    (schema_name, staging_table),
                )
                existing_columns = [row[0] for row in cur.fetchall()]

                missing_columns = set(
                    ["createdAt", "updatedAt", "importedAt", "syncedAt"]
                ) - set(existing_columns)
                if missing_columns:
                    logger.error(
                        f"CRITICAL: Staging table {qualified_table} missing columns: {missing_columns}"
                    )
                    raise CloudSQLImportError(
                        "missing_columns",
                        f"Staging table missing critical columns: {missing_columns}",
                        organization=org_name,
                    )

                # Commit the transaction
                conn.commit()

                # Get final record count
                cur.execute(f"SELECT COUNT(*) FROM {qualified_table}")
                record_count = cur.fetchone()[0]

                duration = time.time() - start_time
                logger.info(
                    f"✅ Streaming upload completed for {org_name}: {record_count:,} records in {duration:.1f}s"
                )
                return record_count

    except Exception as e:
        duration = time.time() - start_time
        logger.error(
            f"❌ Streaming upload failed for {org_name} after {duration:.1f}s: {e}"
        )
        raise CloudSQLImportError(
            "streaming_upload_failed", str(e), organization=org_name
        )
