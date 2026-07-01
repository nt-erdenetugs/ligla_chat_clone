from http import HTTPStatus
from typing import Any


class SyncError(Exception):
    def __init__(
        self,
        message: str,
        status_code: HTTPStatus = HTTPStatus.INTERNAL_SERVER_ERROR,
        organization: str | None = None,
        stage: str | None = None,
        context: dict[str, Any] | None = None,
        retry_after: int | None = None,
    ):
        self.message = message
        self.status_code = status_code
        self.organization = organization
        self.stage = stage
        self.context = context or {}
        self.retry_after = retry_after
        super().__init__(self.message)

    def __str__(self) -> str:
        parts = [self.message]
        if self.organization:
            parts.append(f"[org: {self.organization}]")
        if self.stage:
            parts.append(f"[stage: {self.stage}]")
        if self.context:
            context_str = ", ".join([f"{k}={v}" for k, v in self.context.items()])
            parts.append(f"[context: {context_str}]")
        return " ".join(parts)

    def to_dict(self) -> dict[str, Any]:
        return {
            "error": self.__class__.__name__,
            "message": self.message,
            "status_code": self.status_code.value,
            "organization": self.organization,
            "stage": self.stage,
            "context": self.context,
            "retry_after": self.retry_after,
        }


class FileNotFoundError(SyncError):
    def __init__(self, file_path: str, **kwargs):
        message = f"File not found: {file_path}"
        super().__init__(
            message, status_code=HTTPStatus.NOT_FOUND, stage="file_validation", **kwargs
        )


class FileValidationError(SyncError):
    def __init__(self, file_path: str, reason: str, **kwargs):
        message = f"File validation failed for {file_path}: {reason}"
        super().__init__(
            message,
            status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
            stage="file_validation",
            **kwargs,
        )


class TableCreationError(SyncError):
    def __init__(self, table_name: str, reason: str, **kwargs):
        message = f"Failed to create table {table_name}: {reason}"
        super().__init__(
            message,
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            stage="table_creation",
            **kwargs,
        )


class CloudSQLImportError(SyncError):
    def __init__(self, operation_id: str | None, reason: str, **kwargs):
        if operation_id:
            message = f"Cloud SQL import failed (operation: {operation_id}): {reason}"
        else:
            message = f"Cloud SQL import failed: {reason}"
        super().__init__(
            message,
            status_code=HTTPStatus.BAD_GATEWAY,
            stage="cloudsql_import",
            retry_after=600,
            **kwargs,
        )


class GCSOperationError(SyncError):
    def __init__(self, operation: str, reason: str, **kwargs):
        message = f"GCS {operation} failed: {reason}"
        super().__init__(
            message,
            status_code=HTTPStatus.BAD_GATEWAY,
            stage="gcs_operation",
            retry_after=300,
            **kwargs,
        )


class OrganizationNotFoundError(SyncError):
    def __init__(self, file_path: str, **kwargs):
        message = f"Cannot extract organization from file path: {file_path}"
        super().__init__(
            message,
            status_code=HTTPStatus.BAD_REQUEST,
            stage="organization_extraction",
            **kwargs,
        )
