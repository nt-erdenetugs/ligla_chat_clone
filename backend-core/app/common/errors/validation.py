from http import HTTPStatus
from typing import Any

from app.common.errors.base import ErrorCategory, ErrorSeverity, ReceiverError
from app.services.receiver.constants import ContentType, MessageType


class ValidationError(ReceiverError):
    def __init__(
        self,
        message: str,
        error_code: str = "VALIDATION_ERROR",
        details: dict[str, Any] | None = None,
        suggestion: str | None = None,
    ) -> None:
        super().__init__(
            message=message,
            error_code=error_code,
            http_status=HTTPStatus.BAD_REQUEST,
            details=details,
            suggestion=suggestion or "Check that all required fields are present and have valid formats",
            severity=ErrorSeverity.WARNING,
            category=ErrorCategory.VALIDATION,
            retryable=False,
        )


class InvalidMessageFormatError(ValidationError):
    def __init__(self, details: dict[str, Any] | None = None, suggestion: str | None = None) -> None:
        super().__init__(
            message="Invalid message format",
            error_code="INVALID_MESSAGE_FORMAT",
            details=details,
            suggestion=suggestion or "Ensure message data is a valid JSON object with required fields",
        )


class InvalidMessageTypeError(ValidationError):
    def __init__(self, received_type: str, allowed_types: set[MessageType]) -> None:
        super().__init__(
            message=f"Invalid messageType: {received_type}",
            error_code="INVALID_MESSAGE_TYPE",
            details={"received_type": received_type, "allowed_types": allowed_types},
            suggestion=f"Use one of: {', '.join(allowed_types)}",
        )


class InvalidContentTypeError(ValidationError):
    def __init__(self, received_type: str, allowed_types: set[ContentType]) -> None:
        super().__init__(
            message=f"Invalid contentType: {received_type}",
            error_code="INVALID_CONTENT_TYPE",
            details={"received_type": received_type, "allowed_types": allowed_types},
            suggestion=f"Use one of: {', '.join(allowed_types)}",
        )


class MissingRequiredFieldError(ValidationError):
    def __init__(self, field_name: str, context: str | None = None) -> None:
        message = f"Missing required field: {field_name}"
        if context:
            message += f" for {context}"

        super().__init__(
            message=message,
            error_code="MISSING_REQUIRED_FIELD",
            details={"field_name": field_name, "context": context},
            suggestion=f"Include the '{field_name}' field in your request",
        )


class SchemaValidationError(ValidationError):
    def __init__(self, field_errors: list[str], obj_in: object | None = None) -> None:
        super().__init__(
            message="Schema validation failed",
            details={
                "validation_errors": field_errors,
                "received_object": obj_in,
            },
            suggestion="Check that all required fields are present and have valid types",
        )


class InvalidOperatorIdError(ValidationError):
    def __init__(self, operator_id: str) -> None:
        super().__init__(
            message=f"Invalid operator ID format: {operator_id}",
            error_code="INVALID_OPERATOR_ID",
            details={"operator_id": operator_id},
            suggestion="Provide a valid UUID format for operator ID",
        )
