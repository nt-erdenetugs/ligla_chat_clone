from app.common.errors.base import ErrorCategory, ErrorSeverity, ReceiverError
from app.common.errors.database import (
    ChatNotFoundError,
    DatabaseConnectionError,
    DatabaseError,
    DatabaseIntegrityError,
    DatabaseQueryError,
    EndUserNotFoundError,
    OrganizationNotFoundError,
    ResourceNotFoundError,
)

# Encryption errors
from app.common.errors.encryption import (
    DecryptionOperationError,
    EncryptionConfigurationError,
    EncryptionError,
    EncryptionKeyDerivationError,
    EncryptionOperationError,
)

# External service errors
from app.common.errors.external import (
    BFFNotificationError,
    ExternalAPIError,
    ExternalServiceError,
    PubSubNotFoundError,
    PubSubPublishError,
    PubSubServiceUnavailableError,
    PubSubTimeoutError,
    StorageError,
)
from app.common.errors.handlers import alert_critical_issue, handle_error, raise_error
from app.common.errors.processing import (
    AutoReplyError,
    ChatActivityError,
    ChatAssignmentError,
    ChatCreationError,
    DeserializationError,
    MessageProcessingError,
    SerializationError,
    UnsendMessageError,
)
from app.common.errors.system import ConfigurationError, InternalError, SystemError, TimeoutError
from app.common.errors.tenant import TenantContextRequiredError
from app.common.errors.validation import (
    InvalidContentTypeError,
    InvalidMessageFormatError,
    InvalidMessageTypeError,
    InvalidOperatorIdError,
    MissingRequiredFieldError,
    SchemaValidationError,
    ValidationError,
)

__all__ = [
    "ReceiverError",
    "ErrorSeverity",
    "ErrorCategory",
    "ValidationError",
    "InvalidMessageFormatError",
    "InvalidMessageTypeError",
    "InvalidContentTypeError",
    "MissingRequiredFieldError",
    "SchemaValidationError",
    "InvalidOperatorIdError",
    "MessageProcessingError",
    "SerializationError",
    "DeserializationError",
    "UnsendMessageError",
    "ChatAssignmentError",
    "ChatCreationError",
    "ChatActivityError",
    "AutoReplyError",
    "DatabaseError",
    "ResourceNotFoundError",
    "OrganizationNotFoundError",
    "EndUserNotFoundError",
    "ChatNotFoundError",
    "DatabaseConnectionError",
    "DatabaseQueryError",
    "DatabaseIntegrityError",
    "ExternalServiceError",
    "BFFNotificationError",
    "PubSubNotFoundError",
    "PubSubPublishError",
    "PubSubServiceUnavailableError",
    "PubSubTimeoutError",
    "StorageError",
    "ExternalAPIError",
    "TimeoutError",
    "SystemError",
    "ConfigurationError",
    "InternalError",
    # Encryption
    "EncryptionError",
    "EncryptionConfigurationError",
    "EncryptionKeyDerivationError",
    "EncryptionOperationError",
    "DecryptionOperationError",
    "TenantContextRequiredError",
    # Handlers
    "handle_error",
    "raise_error",
    "alert_critical_issue",
]
