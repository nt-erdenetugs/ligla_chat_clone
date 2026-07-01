from http import HTTPStatus
from typing import Any

from app.common.errors.base import ErrorCategory, ErrorSeverity, ReceiverError


class TenantContextRequiredError(ReceiverError):
    def __init__(
        self,
        message: str = "Tenant context is required for this operation but none was found.",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            message=message,
            error_code="TENANT_CONTEXT_MISSING",
            http_status=HTTPStatus.INTERNAL_SERVER_ERROR,
            details=details,
            suggestion="Ensure the request includes valid 'X-Organization-Name' header or payload.",
            severity=ErrorSeverity.ERROR,
            category=ErrorCategory.SYSTEM,
            retryable=False,
        )
