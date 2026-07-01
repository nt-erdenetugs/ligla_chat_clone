from http import HTTPStatus
from typing import Any

from app.common.errors.base import ErrorCategory, ErrorSeverity, ReceiverError


class ExternalServiceError(ReceiverError):
    def __init__(
        self,
        service_name: str,
        message: str,
        error_code: str = "EXTERNAL_SERVICE_ERROR",
        status_code: int | None = None,
        details: dict[str, Any] | None = None,
        retryable: bool = True,
        original_error: Exception | None = None,
    ) -> None:
        details = details or {}
        details["service_name"] = service_name
        if status_code:
            details["service_status_code"] = status_code

        super().__init__(
            message=message,
            error_code=error_code,
            http_status=HTTPStatus.BAD_GATEWAY,
            details=details,
            suggestion=f"External service '{service_name}' is unavailable. Please retry",
            severity=ErrorSeverity.ERROR,
            category=ErrorCategory.EXTERNAL_SERVICE,
            retryable=retryable,
            original_error=original_error,
        )


class BFFNotificationError(ExternalServiceError):
    def __init__(self, chat_id: str, status_code: int | None = None, reason: str | None = None) -> None:
        details = {"chat_id": chat_id}
        if reason:
            details["reason"] = reason
        super().__init__(
            service_name="BFF",
            message=f"Failed to notify BFF for chat {chat_id}",
            error_code="BFF_NOTIFICATION_ERROR",
            status_code=status_code,
            details=details,
            retryable=True,
        )


class PubSubPublishError(ExternalServiceError):
    def __init__(self, original_error: Exception) -> None:
        super().__init__(
            service_name="Google Pub/Sub",
            message="Failed to publish message to Pub/Sub",
            error_code="PUBSUB_PUBLISH_ERROR",
            details={"error": str(original_error)},
            retryable=True,
            original_error=original_error,
        )


class PubSubNotFoundError(ExternalServiceError):
    def __init__(self, resource_type: str, original_error: Exception) -> None:
        super().__init__(
            service_name="Google Pub/Sub",
            message=f"Pub/Sub {resource_type} not found. Check GCP configuration.",
            error_code="PUBSUB_NOT_FOUND",
            details={"resource_type": resource_type, "error": str(original_error)},
            retryable=False,
            original_error=original_error,
        )
        self.http_status = HTTPStatus.NOT_FOUND


class PubSubServiceUnavailableError(ExternalServiceError):
    def __init__(self, original_error: Exception) -> None:
        super().__init__(
            service_name="Google Pub/Sub",
            message="Pub/Sub service unavailable. Please try again later.",
            error_code="PUBSUB_SERVICE_UNAVAILABLE",
            details={"error": str(original_error)},
            retryable=True,
            original_error=original_error,
        )
        self.http_status = HTTPStatus.SERVICE_UNAVAILABLE


class PubSubTimeoutError(ExternalServiceError):
    def __init__(self) -> None:
        super().__init__(
            service_name="Google Pub/Sub",
            message="Pub/Sub operation timed out",
            error_code="PUBSUB_TIMEOUT",
            retryable=True,
        )


class StorageError(ExternalServiceError):
    def __init__(self, operation: str, original_error: Exception) -> None:
        super().__init__(
            service_name="Google Cloud Storage",
            message=f"Storage operation failed: {operation}",
            error_code="STORAGE_ERROR",
            details={"operation": operation, "error": str(original_error)},
            retryable=True,
            original_error=original_error,
        )


class ExternalAPIError(ExternalServiceError):
    def __init__(self, api_name: str, status_code: int, response_body: str | None = None) -> None:
        super().__init__(
            service_name=api_name,
            message=f"External API call failed: {api_name}",
            error_code="EXTERNAL_API_ERROR",
            status_code=status_code,
            details={"response_body": response_body} if response_body else None,
            retryable=status_code >= 500,
        )
