from http import HTTPStatus
from typing import Any

from app.common.errors.base import ErrorCategory, ErrorSeverity, ReceiverError


class TimeoutError(ReceiverError):
    def __init__(self, operation: str, timeout_seconds: float) -> None:
        super().__init__(
            message=f"Operation timed out: {operation}",
            error_code="TIMEOUT_ERROR",
            http_status=HTTPStatus.GATEWAY_TIMEOUT,
            details={"operation": operation, "timeout_seconds": timeout_seconds},
            suggestion=f"Operation exceeded {timeout_seconds}s timeout. Please retry",
            severity=ErrorSeverity.WARNING,
            category=ErrorCategory.TIMEOUT,
            retryable=True,
        )


class SystemError(ReceiverError):
    def __init__(
        self,
        message: str,
        error_code: str = "SYSTEM_ERROR",
        details: dict[str, Any] | None = None,
        original_error: Exception | None = None,
    ) -> None:
        super().__init__(
            message=message,
            error_code=error_code,
            http_status=HTTPStatus.INTERNAL_SERVER_ERROR,
            details=details,
            suggestion="An unexpected system error occurred. Please contact support",
            severity=ErrorSeverity.CRITICAL,
            category=ErrorCategory.SYSTEM,
            retryable=False,
            original_error=original_error,
        )


class ConfigurationError(SystemError):
    def __init__(self, config_key: str, reason: str) -> None:
        super().__init__(
            message=f"Invalid configuration: {config_key}",
            error_code="CONFIGURATION_ERROR",
            details={"config_key": config_key, "reason": reason},
        )


class InternalError(SystemError):
    def __init__(self, message: str, original_error: Exception | None = None) -> None:
        super().__init__(
            message=message,
            error_code="INTERNAL_ERROR",
            details={"error": str(original_error)} if original_error else None,
            original_error=original_error,
        )
