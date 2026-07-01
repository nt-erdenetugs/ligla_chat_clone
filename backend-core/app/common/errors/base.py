import enum
import inspect
import os
import traceback
from http import HTTPStatus
from typing import Any

from fastapi import HTTPException

from app.common.utils import get_logger

logger = get_logger(__name__)


class ErrorSeverity(enum.StrEnum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class ErrorCategory(enum.StrEnum):
    VALIDATION = "VALIDATION"
    AUTHENTICATION = "AUTHENTICATION"
    AUTHORIZATION = "AUTHORIZATION"
    RESOURCE = "RESOURCE"
    EXTERNAL_SERVICE = "EXTERNAL_SERVICE"
    DATABASE = "DATABASE"
    BUSINESS_LOGIC = "BUSINESS_LOGIC"
    SYSTEM = "SYSTEM"
    TIMEOUT = "TIMEOUT"
    RATE_LIMIT = "RATE_LIMIT"


class ReceiverError(Exception):
    def __init__(
        self,
        message: str,
        error_code: str,
        http_status: HTTPStatus = HTTPStatus.INTERNAL_SERVER_ERROR,
        details: dict[str, Any] | None = None,
        suggestion: str | None = None,
        severity: ErrorSeverity = ErrorSeverity.ERROR,
        category: ErrorCategory = ErrorCategory.SYSTEM,
        retryable: bool = False,
        original_error: Exception | None = None,
    ) -> None:
        self.message = message
        self.error_code = error_code
        self.http_status = http_status
        self.details = details or {}
        self.suggestion = suggestion
        self.severity = severity
        self.category = category
        self.retryable = retryable
        self.original_error = original_error

        frame = inspect.currentframe()
        caller_frame = None
        current = frame

        while current:
            current = current.f_back
            if current:
                frame_module = current.f_globals.get("__name__", "")
                if "app.common.errors" not in frame_module and frame_module != "":
                    caller_frame = current
                    break

        if caller_frame:
            self.source_module = caller_frame.f_globals.get("__name__", "unknown")
            self.source_function = caller_frame.f_code.co_name
            self.source_file = caller_frame.f_code.co_filename
            self.source_line = caller_frame.f_lineno
        else:
            self.source_module = "unknown"
            self.source_function = "unknown"
            self.source_file = "unknown"
            self.source_line = 0

        if self.original_error:
            tb = traceback.extract_tb(self.original_error.__traceback__)
            if tb:
                last_frame = tb[-1]
                self.original_error_file = last_frame.filename
                self.original_error_line = last_frame.lineno
                self.original_error_function = last_frame.name
            else:
                self.original_error_file = None
                self.original_error_line = None
                self.original_error_function = None

        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        error_dict: dict[str, str | bool | dict[str, Any]] = {
            "error": self.error_code,
            "message": self.message,
            "category": self.category.value,
            "retryable": self.retryable,
        }

        if self.details:
            error_dict["details"] = self.details

        if self.suggestion:
            error_dict["suggestion"] = self.suggestion

        return error_dict

    def to_http_exception(self) -> HTTPException:
        return HTTPException(status_code=self.http_status.value, detail=self.to_dict())

    def log(self) -> None:
        source_location = f"{self.source_module}.{self.source_function}:{self.source_line}"
        source_file = os.path.basename(self.source_file) if self.source_file != "unknown" else "unknown"

        log_extra = {
            "error_code": self.error_code,
            "category": self.category.value,
            "retryable": self.retryable,
            "http_status": self.http_status.value,
            "source_location": source_location,
            "source_file": source_file,
            "source_function": self.source_function,
            "source_line": self.source_line,
            **self.details,
        }

        if self.original_error:
            log_extra["original_error_type"] = type(self.original_error).__name__
            log_extra["original_error_message"] = str(self.original_error)
            if hasattr(self, "original_error_file") and self.original_error_file:
                log_extra["original_error_file"] = os.path.basename(self.original_error_file)
                log_extra["original_error_line"] = self.original_error_line
                log_extra["original_error_function"] = self.original_error_function

        log_message = f"{self.error_code}: {self.message}"

        if self.severity == ErrorSeverity.DEBUG:
            logger.debug(log_message, extra=log_extra)
        elif self.severity == ErrorSeverity.INFO:
            logger.info(log_message, extra=log_extra)
        elif self.severity == ErrorSeverity.WARNING:
            logger.warning(log_message, extra=log_extra)
        elif self.severity == ErrorSeverity.ERROR:
            logger.error(log_message, extra=log_extra)
        elif self.severity == ErrorSeverity.CRITICAL:
            logger.critical(log_message, extra=log_extra)
