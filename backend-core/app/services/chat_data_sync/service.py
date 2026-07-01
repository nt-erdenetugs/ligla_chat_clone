import json

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.common.utils import get_exception_info, get_logger
from app.db.session import get_sessionmaker
from app.db.tenant_context import with_tenant_context
from app.services.chat_data_sync import repository, schemas
from app.services.chat_data_sync.constants import ChatDataSyncType

logger = get_logger(__name__)


def publish_message(payload: schemas.payloads.AnyChatDataSyncNotification):
    pass


def parse_notification_payload(payload: str) -> schemas.payloads.ChatDataSyncNotificationPayload | None:
    try:
        return schemas.payloads.ChatDataSyncNotificationPayload.model_validate_json(payload)
    except ValidationError as e:
        logger.warning(
            "Invalid notification payload - schema validation failed",
            extra={
                "error_type": "ValidationError",
                "validation_errors": str(e),
                "payload_length": len(payload),
            },
        )
        return None
    except json.JSONDecodeError as e:
        logger.warning(
            "Invalid notification payload - JSON decode failed",
            extra={
                "error_type": "JSONDecodeError",
                "error_message": str(e),
                "payload_length": len(payload),
            },
        )
        return None


@with_tenant_context(
    organization_id=lambda *args, **kwargs: getattr(args[1], "organizationId", None) if len(args) > 1 else None
)
def fetch_sync_data(db: Session, notification: schemas.payloads.ChatDataSyncNotificationPayload):
    try:
        match notification.type:
            case ChatDataSyncType.ATTRIBUTE_SETTINGS:
                return repository.attribute.get_attribute_settings(db, notification)
            case ChatDataSyncType.USER_ATTRIBUTES:
                return repository.chat_attribute_value.get_user_attributes(db, notification)
            case ChatDataSyncType.TAG_SETTINGS:
                return repository.tags.get_tag_settings(db, notification)
            case ChatDataSyncType.USER_TAGS:
                return repository.chat_tags.get_user_tags(db, notification)
    except Exception as e:
        error_info = get_exception_info(e)
        logger.error(
            "Failed to fetch sync data",
            extra={
                "sync_type": notification.type,
                "organization_id": str(getattr(notification, "organizationId", "unknown")),
                **error_info,
            },
        )
        return None


def send_sync_data(data: schemas.payloads.AnyChatDataSyncNotification):
    try:
        publish_message(data)
    except Exception as e:
        error_info = get_exception_info(e)
        logger.error(
            "Failed to publish sync data",
            extra={
                "sync_type": getattr(data, "type", "unknown"),
                **error_info,
            },
        )


@with_tenant_context(organization_id=lambda *args, **kwargs: None)  # Default to unknown/None initially...
def handle_chat_data_sync_notify(_channel: str, payload: str) -> None:
    logger.info(
        "Received chat data sync notify event",
        extra={
            "channel": _channel,
            "payload_length": len(payload),
        },
    )
    SessionMaker = get_sessionmaker()
    with SessionMaker() as db:
        notification = parse_notification_payload(payload)
        if not notification:
            logger.warning(
                "Failed to parse notification payload - skipping sync",
                extra={
                    "channel": _channel,
                    "payload_length": len(payload),
                },
            )
            return

        data = fetch_sync_data(db, notification)
        if not data:
            logger.warning(
                "No data found to sync",
                extra={
                    "sync_type": notification.type,
                    "organization_id": str(getattr(notification, "organizationId", "unknown")),
                },
            )
            return

        send_sync_data(data)
        logger.info(
            "Chat data sync completed successfully",
            extra={
                "sync_type": notification.type,
                "organization_id": str(getattr(notification, "organizationId", "unknown")),
            },
        )
