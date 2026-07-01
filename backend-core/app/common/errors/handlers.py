from typing import Any, NoReturn

from fastapi import HTTPException

from app.common.errors.base import ReceiverError
from app.common.errors.system import InternalError
from app.common.utils import get_logger

logger = get_logger(__name__)


def handle_error(error: Exception, context: dict[str, Any] | None = None) -> HTTPException:
    if isinstance(error, ReceiverError):
        error.log()
        return error.to_http_exception()

    if isinstance(error, HTTPException):
        logger.error(f"HTTP Exception: {error.status_code} - {error.detail}", extra=context)
        return error

    logger.error(f"Unexpected error: {type(error).__name__}: {str(error)}", exc_info=True, extra=context)
    internal_error = InternalError(message="An unexpected error occurred", original_error=error)
    internal_error.log()
    return internal_error.to_http_exception()


def raise_error(error: ReceiverError) -> NoReturn:
    error.log()
    raise error.to_http_exception()


def alert_critical_issue(issue: str, details: dict[str, Any]) -> None:
    logger.critical(f"CRITICAL ALERT: {issue}", extra=details)
