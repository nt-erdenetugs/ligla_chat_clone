import asyncio
import threading
import time
from typing import Any

from app.common.errors import PubSubPublishError, PubSubTimeoutError, SerializationError, raise_error
from app.common.utils import get_exception_info, get_logger
from app.config.settings import AppENV, settings
from app.libs.gcp.pubsub_v1.queue_service import BasePubSubConfig, QueueService
from app.services.receiver.helper.decorators import handle_receiver_errors
from app.services.receiver.helper.parsers import build_metadata
from app.services.receiver.schemas import MessageRequest

logger = get_logger(__name__)

# Constants
PUBSUB_PUBLISH_TIMEOUT_SECONDS = 10

# Singleton instance and lock for thread-safe initialization
_queue_service_instance: QueueService | None = None
_queue_service_lock = threading.Lock()


def get_queue_service() -> QueueService:
    pubsub_config = BasePubSubConfig(
        topic_name=settings.RECEIVE_MESSAGE_TOPIC_NAME,
        subscription_name=settings.RECEIVE_MESSAGE_TOPIC_SUBSCRIPTION_NAME,
        dlq_topic_name=settings.RECEIVE_MESSAGE_DLQ_TOPIC_NAME,
        dlq_subscription_name=settings.RECEIVE_MESSAGE_DLQ_TOPIC_SUBSCRIPTION_NAME,
    )

    return QueueService(settings=settings, topic_config=pubsub_config)


def _get_queue_service_cached() -> QueueService:
    global _queue_service_instance
    if _queue_service_instance is None:
        with _queue_service_lock:
            if _queue_service_instance is None:
                logger.info(
                    "Initializing queue service singleton",
                    extra={
                        "topic": settings.RECEIVE_MESSAGE_TOPIC_NAME,
                        "subscription": settings.RECEIVE_MESSAGE_TOPIC_SUBSCRIPTION_NAME,
                        "dlq_topic": settings.RECEIVE_MESSAGE_DLQ_TOPIC_NAME,
                        "environment": settings.ENV,
                    },
                )
                pubsub_config = BasePubSubConfig(
                    topic_name=settings.RECEIVE_MESSAGE_TOPIC_NAME,
                    subscription_name=settings.RECEIVE_MESSAGE_TOPIC_SUBSCRIPTION_NAME,
                    dlq_topic_name=settings.RECEIVE_MESSAGE_DLQ_TOPIC_NAME,
                    dlq_subscription_name=settings.RECEIVE_MESSAGE_DLQ_TOPIC_SUBSCRIPTION_NAME,
                )
                _queue_service_instance = QueueService(settings=settings, topic_config=pubsub_config)
                logger.debug("Queue service singleton created successfully")
    return _queue_service_instance


def initialize_pubsub_resources() -> None:
    queue = _get_queue_service_cached()
    if settings.ENV == AppENV.LOCAL:
        logger.info(
            "Initializing local Pub/Sub resources",
            extra={
                "environment": settings.ENV,
                "topic": settings.RECEIVE_MESSAGE_TOPIC_NAME,
                "subscription": settings.RECEIVE_MESSAGE_TOPIC_SUBSCRIPTION_NAME,
                "push_endpoint": settings.RECEIVE_MESSAGE_PUSH_ENDPOINT,
            },
        )
        queue.create_topic_and_subscription(push_endpoint=settings.RECEIVE_MESSAGE_PUSH_ENDPOINT)
        logger.info("Local Pub/Sub resources initialized successfully")
    else:
        logger.info(
            "Validating GCP Pub/Sub resources",
            extra={
                "environment": settings.ENV,
                "topic": settings.RECEIVE_MESSAGE_TOPIC_NAME,
                "subscription": settings.RECEIVE_MESSAGE_TOPIC_SUBSCRIPTION_NAME,
            },
        )
        queue.validate_pubsub_resources()
        logger.info("GCP Pub/Sub resources validated successfully")


@handle_receiver_errors
async def publish_message(payload: MessageRequest) -> dict[str, Any]:
    start_time = time.time()

    client_name = getattr(payload, "client_name", "unknown")
    user_id = getattr(payload, "user_id", "unknown")
    message_id = getattr(payload, "message_id", "N/A")

    message_metadata = build_metadata(payload, {"message_id": message_id})

    logger.info(
        f"Publishing '{payload.message_type.value}' message to Pub/Sub - org: {client_name}, user: {user_id}, msg_id: {message_id}",
        extra=message_metadata,
    )

    try:
        msg = payload.model_dump(mode="json", by_alias=True)
        logger.debug(
            f"Message payload serialized: {msg}",
            extra=message_metadata,
        )
    except Exception as e:
        raise_error(
            SerializationError(
                original_error=e,
                extra=message_metadata,
            )
        )

    queue_service = _get_queue_service_cached()

    try:
        # Run the blocking Pub/Sub call in a thread pool to avoid blocking the event loop
        logger.debug("Executing async Pub/Sub publish", extra=message_metadata)
        msg_id = await asyncio.to_thread(queue_service.publish_message, message_data=msg)

        if not msg_id:
            logger.error(
                "Pub/Sub publish returned no message ID",
                extra=message_metadata,
            )
            raise RuntimeError("No message ID returned from publish_message")

        publish_time = time.time() - start_time
        logger.info(
            "Message published to Pub/Sub successfully",
            extra={
                **message_metadata,
                "publish_time_ms": round(publish_time * 1000, 2),
                "topic": settings.RECEIVE_MESSAGE_TOPIC_NAME,
            },
        )

        return {
            "message_id": msg_id,
            "published_at": payload.timestamp,
            "publish_time_ms": round(publish_time * 1000, 2),
        }

    except Exception as error:
        error_type = type(error).__name__
        is_timeout = "TimeoutError" in error_type or "DeadlineExceeded" in error_type
        error_info = get_exception_info(error)

        logger.error(
            "Pub/Sub message publish failed",
            extra={
                **message_metadata,
                **error_info,
                "is_timeout": is_timeout,
                "timeout_threshold_seconds": PUBSUB_PUBLISH_TIMEOUT_SECONDS,
            },
        )

        if is_timeout:
            raise_error(PubSubTimeoutError())
        else:
            raise_error(PubSubPublishError(original_error=error))
