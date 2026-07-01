from http import HTTPStatus
from typing import Any

from app.common.errors.base import ErrorCategory, ErrorSeverity, ReceiverError


class MessageProcessingError(ReceiverError):
    def __init__(
        self,
        message: str,
        error_code: str = "MESSAGE_PROCESSING_ERROR",
        details: dict[str, Any] | None = None,
        suggestion: str | None = None,
        retryable: bool = True,
        original_error: Exception | None = None,
    ) -> None:
        super().__init__(
            message=message,
            error_code=error_code,
            http_status=HTTPStatus.INTERNAL_SERVER_ERROR,
            details=details,
            suggestion=suggestion or "Please retry the operation. Contact support if the issue persists",
            severity=ErrorSeverity.ERROR,
            category=ErrorCategory.BUSINESS_LOGIC,
            retryable=retryable,
            original_error=original_error,
        )


class SerializationError(MessageProcessingError):
    def __init__(self, original_error: Exception, extra: dict[str, Any] | None = None) -> None:

        super().__init__(
            message="Failed to serialize message data",
            error_code="SERIALIZATION_ERROR",
            details={"error": str(original_error), **(extra or {})},
            suggestion="Check message data structure and ensure all fields are serializable",
            retryable=False,
            original_error=original_error,
        )


class DeserializationError(MessageProcessingError):
    def __init__(self, original_error: Exception) -> None:
        super().__init__(
            message="Failed to deserialize message data",
            error_code="DESERIALIZATION_ERROR",
            details={"error": str(original_error)},
            suggestion="Ensure message data is valid JSON",
            retryable=False,
            original_error=original_error,
        )


class UnsendMessageError(MessageProcessingError):
    def __init__(self, message_id: str, reason: str) -> None:
        super().__init__(
            message=f"Failed to unsend message: {reason}",
            error_code="UNSEND_MESSAGE_ERROR",
            details={"message_id": message_id, "reason": reason},
            retryable=True,
        )


class ChatAssignmentError(MessageProcessingError):
    def __init__(self, reason: str, chat_id: str | None = None) -> None:
        details = {"reason": reason}
        if chat_id:
            details["chat_id"] = chat_id
        super().__init__(
            message=f"Failed to assign chat: {reason}",
            error_code="CHAT_ASSIGNMENT_ERROR",
            details=details,
            retryable=True,
        )


class ChatCreationError(MessageProcessingError):
    def __init__(self, reason: str, details: dict[str, Any] | None = None) -> None:
        merged_details = {"reason": reason}
        if details:
            merged_details.update(details)
        super().__init__(
            message=f"Failed to create chat: {reason}",
            error_code="CHAT_CREATION_ERROR",
            details=merged_details,
            retryable=True,
        )


class ChatActivityError(MessageProcessingError):
    def __init__(self, reason: str, chat_id: str | None = None) -> None:
        details = {"reason": reason}
        if chat_id:
            details["chat_id"] = chat_id
        super().__init__(
            message=f"Failed to create chat activity: {reason}",
            error_code="CHAT_ACTIVITY_ERROR",
            details=details,
            retryable=True,
        )


class AutoReplyError(MessageProcessingError):
    def __init__(self, reason: str, chat_id: str | None = None) -> None:
        details = {"reason": reason}
        if chat_id:
            details["chat_id"] = chat_id
        super().__init__(
            message=f"Auto-reply failed: {reason}",
            error_code="AUTO_REPLY_ERROR",
            details=details,
            retryable=True,
        )
