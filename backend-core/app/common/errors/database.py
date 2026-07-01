from http import HTTPStatus
from typing import Any

from app.common.errors.base import ErrorCategory, ErrorSeverity, ReceiverError


class DatabaseError(ReceiverError):
    def __init__(
        self,
        message: str,
        error_code: str = "DATABASE_ERROR",
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
            suggestion=suggestion or "Database operation failed. Please retry",
            severity=ErrorSeverity.ERROR,
            category=ErrorCategory.DATABASE,
            retryable=retryable,
            original_error=original_error,
        )


class ResourceNotFoundError(DatabaseError):
    def __init__(self, resource_type: str, resource_id: str) -> None:
        super().__init__(
            message=f"{resource_type} not found: {resource_id}",
            error_code="RESOURCE_NOT_FOUND",
            details={"resource_type": resource_type, "resource_id": resource_id},
            suggestion=f"Verify that the {resource_type} exists",
            retryable=False,
        )


class OrganizationNotFoundError(ResourceNotFoundError):
    def __init__(self, organization_name: str) -> None:
        super().__init__(resource_type="Organization", resource_id=organization_name)


class EndUserNotFoundError(ResourceNotFoundError):
    def __init__(self, user_id: str) -> None:
        super().__init__(resource_type="EndUser", resource_id=user_id)


class ChatNotFoundError(ResourceNotFoundError):
    def __init__(self, organization_name: str, user_id: str) -> None:
        super().__init__(
            resource_type="Chat",
            resource_id=f"org={organization_name}, user={user_id}",
        )


class DatabaseConnectionError(DatabaseError):
    def __init__(self, original_error: Exception) -> None:
        super().__init__(
            message="Database connection failed",
            error_code="DATABASE_CONNECTION_ERROR",
            details={"error": str(original_error)},
            retryable=True,
            original_error=original_error,
        )


class DatabaseQueryError(DatabaseError):
    def __init__(self, query_type: str, original_error: Exception) -> None:
        super().__init__(
            message=f"Database query failed: {query_type}",
            error_code="DATABASE_QUERY_ERROR",
            details={"query_type": query_type, "error": str(original_error)},
            retryable=True,
            original_error=original_error,
        )


class DatabaseIntegrityError(DatabaseError):
    def __init__(self, constraint: str, original_error: Exception) -> None:
        super().__init__(
            message=f"Database integrity constraint violated: {constraint}",
            error_code="DATABASE_INTEGRITY_ERROR",
            details={"constraint": constraint, "error": str(original_error)},
            suggestion="Check that all foreign key relationships and unique constraints are satisfied",
            retryable=False,
            original_error=original_error,
        )
