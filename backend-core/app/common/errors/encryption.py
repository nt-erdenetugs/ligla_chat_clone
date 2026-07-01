from http import HTTPStatus
from typing import Any

from app.common.errors.base import ErrorCategory, ErrorSeverity, ReceiverError


class EncryptionError(ReceiverError):
    def __init__(
        self,
        message: str,
        error_code: str = "ENCRYPTION_ERROR",
        details: dict[str, Any] | None = None,
        original_error: Exception | None = None,
    ):
        super().__init__(
            message=message,
            error_code=error_code,
            http_status=HTTPStatus.INTERNAL_SERVER_ERROR,
            details=details,
            suggestion="Encryption operation failed. Please contact support",
            severity=ErrorSeverity.CRITICAL,
            category=ErrorCategory.SYSTEM,
            retryable=False,
            original_error=original_error,
        )


class EncryptionConfigurationError(EncryptionError):
    def __init__(self, config_key: str, reason: str):
        super().__init__(
            message=f"Encryption configuration invalid: {config_key}",
            error_code="ENCRYPTION_CONFIGURATION_ERROR",
            details={"config_key": config_key, "reason": reason},
        )


class EncryptionKeyDerivationError(EncryptionError):
    def __init__(self, organization_id: str, original_error: Exception | None = None):
        super().__init__(
            message=f"Failed to derive encryption key for organization: {organization_id}",
            error_code="ENCRYPTION_KEY_DERIVATION_ERROR",
            details={"organization_id": organization_id},
            original_error=original_error,
        )


class EncryptionOperationError(EncryptionError):
    def __init__(self, organization_id: str, original_error: Exception | None = None):
        super().__init__(
            message=f"Encryption operation failed for organization: {organization_id}",
            error_code="ENCRYPTION_OPERATION_ERROR",
            details={"organization_id": organization_id},
            original_error=original_error,
        )


class DecryptionOperationError(EncryptionError):
    def __init__(self, organization_id: str, original_error: Exception | None = None):
        super().__init__(
            message=f"Decryption operation failed for organization: {organization_id}",
            error_code="DECRYPTION_OPERATION_ERROR",
            details={"organization_id": organization_id},
            original_error=original_error,
        )
