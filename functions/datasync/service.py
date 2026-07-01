import enum

from db import get_db_session, get_tenant_db_session
from handlers.member_feed import MemberFeedHandler
from handlers.member_feed_columns import MemberFeedColumnHandler
from handlers.store import StoreHandler
from handlers.survey_feed_columns import SurveyFeedColumnHandler
from logger import DataProcessingError, FileValidationError, get_cloud_logger
from utils.data_processing import process_large_dataset
from utils.tenant_utils import lookup_organization_schema

logger = get_cloud_logger("datasync_event_handler")


class HandlerName(enum.Enum):
    STORE = "stores"
    MEMBER_FEED = "member_feed"
    MEMBER_FEED_COLUMN = "member_feed_column"
    SURVEY_FEED_COLUMN = "survey_feed_column"


class VALID_DIRECTORIES(enum.Enum):
    STORES = "stores"
    SETTINGS = "settings"
    MEMBER_FEED = "client_users"


HANDLERS = {
    HandlerName.STORE.value: StoreHandler(),
    HandlerName.MEMBER_FEED_COLUMN.value: MemberFeedColumnHandler(),
    HandlerName.MEMBER_FEED.value: MemberFeedHandler(),
    HandlerName.SURVEY_FEED_COLUMN.value: SurveyFeedColumnHandler(),
}

DIR_HANDLER_MAP = {
    VALID_DIRECTORIES.STORES.value: HandlerName.STORE.value,
    VALID_DIRECTORIES.MEMBER_FEED.value: HandlerName.MEMBER_FEED.value,
    VALID_DIRECTORIES.SETTINGS.value: None,
}

FLAT_HANDLER_MAP = {
    "store_data": HandlerName.STORE.value,
    "client_users": HandlerName.MEMBER_FEED_COLUMN.value,
    "additions": HandlerName.SURVEY_FEED_COLUMN.value,
}


def _get_flat_handler(file_name: str):
    try:
        token = file_name.split("-", 2)[1]
        return HANDLERS.get(str(FLAT_HANDLER_MAP.get(token)))
    except IndexError:
        return None


def _is_member_data_file(file_name: str) -> bool:
    """Use existing validate_file utility for member data file validation"""
    try:
        from utils.file_validation import validate_file

        _ = validate_file(
            file_name, VALID_DIRECTORIES.MEMBER_FEED.value, "-client_user_data-"
        )
        return True
    except Exception:
        # Fall back to basic validation if util fails
        if not (
            file_name.endswith(".csv")
            or file_name.endswith(".csv.gz")
            or file_name.endswith(".gzip")
        ):
            return False
        file_name = file_name.strip("/")
        parts = file_name.split("/")
        return (
            len(parts) == 3
            and parts[1] == "client_users"
            and "client_user_data" in parts[2]
        )


def _get_handler(file_path: str):
    if not file_path.endswith((".csv", ".csv.gz")):
        return None
    if _is_member_data_file(file_path):
        return HANDLERS.get(HandlerName.MEMBER_FEED.value)
    cleaned_file_path = file_path.strip("/")
    if "/" in cleaned_file_path:
        *_, dir_name, file_name = cleaned_file_path.rsplit("/", 2)
        dir_handler = DIR_HANDLER_MAP.get(dir_name)
        if dir_name == VALID_DIRECTORIES.SETTINGS.value and dir_handler is None:
            return _get_flat_handler(file_name)
        elif dir_handler:
            return HANDLERS.get(dir_handler)
        return None
    return _get_flat_handler(cleaned_file_path)


def _get_organization_schema(org_name: str) -> str | None:
    _, _, engine = get_db_session()

    result = lookup_organization_schema(engine, org_name)
    if result is None:
        logger.error(f"Organization not found: {org_name}")
        return None

    _, schema_name = result
    logger.info(f"Found organization schema: {org_name} -> {schema_name}")
    return schema_name


def handle_event(event_data: dict[str, str]) -> bool | None:
    _ = get_db_session()
    try:
        bucket_name: str = event_data["bucket"]
        file_name: str = event_data["name"]

        handler = _get_handler(file_name)
        if not handler:
            logger.info(f"No handler for file: {file_name}, skipping file {file_name}")
            return True

        logger.info(f"Validating file: {file_name}")
        org_name = handler.validate_file(file_name)
        logger.info(f"Processing {handler.entity_name} file for org: {org_name}")

        # Special handling for member feed files - route to Cloud Run
        if handler.entity_name == "member_feed" and isinstance(
            handler, MemberFeedHandler
        ):
            logger.info(f"Detected member feed file, routing to Cloud Run: {file_name}")
            return handler.route_to_cloud_run(file_name)

        # Schema-per-tenant: Look up organization's schema
        schema_name = _get_organization_schema(org_name)
        if schema_name is None:
            logger.error(f"Cannot process file - organization not found: {org_name}")
            return None

        # Process with tenant-aware session
        try:
            with get_tenant_db_session(schema_name) as db:
                logger.info(f"Streaming CSV file {file_name} from bucket '{bucket_name}' (schema: {schema_name})")
                csv_rows = list(handler.read_csv(bucket_name, file_name))
                if not csv_rows:
                    logger.warning(f"No data found in file: {file_name}")
                    return True

                # For stores: process the full snapshot in one pass to avoid per-batch disabling
                if isinstance(handler, StoreHandler):
                    handler.process_batch(db, org_name, csv_rows)
                else:
                    process_large_dataset(
                        db=db,
                        org_name=org_name,
                        csv_rows=csv_rows,
                        process_batch_fn=handler.process_batch,
                    )

                logger.info(
                    f"Successfully completed data sync for {org_name} using {file_name}"
                )
                return True

        except Exception as e:
            logger.error(
                f"Failed to complete data sync for {org_name} using {file_name}: {e}"
            )
            raise  # Re-raise to ensure proper error handling

    except (FileValidationError, DataProcessingError) as e:
        logger.error(f"Validation/Processing error: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return None
