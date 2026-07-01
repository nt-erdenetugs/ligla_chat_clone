import functools
import logging
import time
from collections.abc import Awaitable, Callable
from typing import Any

import httpx
from tenacity import before_log, retry, retry_if_exception, stop_after_attempt, stop_after_delay, wait_exponential

from app.common.errors import BFFNotificationError
from app.common.errors import TimeoutError as ReceiverTimeoutError
from app.common.utils import get_logger
from app.config.settings import get_settings
from app.services.receiver.schemas import MessageResponse

logger = get_logger(__name__)

# Constants
NOTIFICATION_TIMEOUT_SECONDS = 10
MAX_RETRY_ATTEMPTS = 3
MAX_RETRY_DELAY_SECONDS = 5


def handle_notification_errors[**P, T](func: Callable[P, Awaitable[T | None]]) -> Callable[P, Awaitable[T | None]]:
    @functools.wraps(func)
    async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T | None:
        try:
            return await func(*args, **kwargs)
        except BFFNotificationError:
            logger.warning(
                "BFF notification failed - operation will continue",
                extra={"error_type": "BFFNotificationError", "non_blocking": True},
            )
            return None
        except ReceiverTimeoutError:
            logger.warning(
                "BFF notification timed out - operation will continue",
                extra={"error_type": "ReceiverTimeoutError", "non_blocking": True},
            )
            return None
        except httpx.HTTPStatusError as e:
            chat_id = "unknown"
            if args and hasattr(args[0], "chatId"):
                chat_id = str(args[0].chatId)

            logger.warning(
                "BFF notification failed with HTTP error - operation will continue",
                extra={
                    "chat_id": chat_id,
                    "status_code": e.response.status_code,
                    "response_text": e.response.text[:200],
                    "non_blocking": True,
                },
            )
            return None
        except httpx.TimeoutException:
            chat_id = "unknown"
            if args and hasattr(args[0], "chatId"):
                chat_id = str(args[0].chatId)

            logger.warning(
                "BFF notification timed out - operation will continue",
                extra={
                    "chat_id": chat_id,
                    "timeout_seconds": NOTIFICATION_TIMEOUT_SECONDS,
                    "non_blocking": True,
                },
            )
            return None
        except Exception as e:
            logger.warning(
                "BFF notification failed with unexpected error - operation will continue",
                extra={"error_type": type(e).__name__, "error_message": str(e), "non_blocking": True},
            )
            return None

    return wrapper


def is_retryable_exception(exception: BaseException) -> bool:
    if isinstance(exception, httpx.HTTPStatusError):
        status_code = exception.response.status_code
        # Retry only on server errors (5xx)
        is_retryable = 500 <= status_code < 600

        logger.debug(
            "Evaluating HTTP status error for retry",
            extra={
                "status_code": status_code,
                "is_retryable": is_retryable,
                "error_type": type(exception).__name__,
            },
        )
        return is_retryable

    # Retry on network-related errors (including timeouts)
    is_retryable = isinstance(exception, httpx.RequestError | httpx.TimeoutException)

    if is_retryable:
        logger.debug(
            "Network error detected - eligible for retry",
            extra={
                "error_type": type(exception).__name__,
                "error_message": str(exception),
            },
        )

    return is_retryable


@handle_notification_errors
@retry(
    stop=(stop_after_attempt(MAX_RETRY_ATTEMPTS) | stop_after_delay(MAX_RETRY_DELAY_SECONDS)),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    before=before_log(logger, logging.DEBUG),
    retry=retry_if_exception(is_retryable_exception),
    reraise=True,
)
async def notify_bff(message: MessageResponse) -> httpx.Response:
    start_time = time.time()
    settings = get_settings()
    bff_url = settings.BFF_URL_RECEIVE_CHAT

    logger.info(
        "Starting BFF notification",
        extra={
            "chat_id": str(message.chatId),
            "organization": message.clientName,
            "bff_url": bff_url,
        },
    )

    headers = {
        "Authorization": f"Bearer {settings.JWT_SECRET}",
        "Content-Type": "application/json",
    }

    message_payload = message.model_dump()
    payload_size = len(str(message_payload))

    logger.debug(
        "Sending notification request to BFF",
        extra={
            "chat_id": str(message.chatId),
            "organization": message.clientName,
            "payload_size_bytes": payload_size,
            "timeout_seconds": NOTIFICATION_TIMEOUT_SECONDS,
        },
    )

    try:
        async with httpx.AsyncClient(timeout=NOTIFICATION_TIMEOUT_SECONDS) as client:
            response = await client.post(bff_url, json=message_payload, headers=headers)
            response.raise_for_status()

            notification_time = time.time() - start_time
            logger.info(
                "BFF notification completed successfully",
                extra={
                    "chat_id": str(message.chatId),
                    "organization": message.clientName,
                    "status_code": response.status_code,
                    "notification_time_ms": round(notification_time * 1000, 2),
                    "response_size_bytes": len(response.content),
                },
            )

            return response

    except (httpx.HTTPStatusError, httpx.TimeoutException, httpx.RequestError) as e:
        notification_time = time.time() - start_time

        error_context: dict[str, Any] = {
            "chat_id": str(message.chatId),
            "organization": message.clientName,
            "error_type": type(e).__name__,
            "notification_time_ms": round(notification_time * 1000, 2),
            "bff_url": bff_url,
            "is_retryable": is_retryable_exception(e),
        }

        if isinstance(e, httpx.HTTPStatusError):
            error_context["status_code"] = e.response.status_code
            error_context["response_body"] = e.response.text[:500]
            logger.debug("BFF notification failed with HTTP error", extra=error_context)
        elif isinstance(e, httpx.TimeoutException):
            error_context["timeout_seconds"] = NOTIFICATION_TIMEOUT_SECONDS
            logger.debug("BFF notification timed out", extra=error_context)
        else:
            error_context["error_message"] = str(e)
            logger.debug("BFF notification failed with network error", extra=error_context)

        raise

    except Exception as e:
        notification_time = time.time() - start_time
        logger.debug(
            "BFF notification failed with unexpected error",
            extra={
                "chat_id": str(message.chatId),
                "organization": message.clientName,
                "error_type": type(e).__name__,
                "error_message": str(e),
                "notification_time_ms": round(notification_time * 1000, 2),
                "bff_url": bff_url,
            },
        )
        raise
