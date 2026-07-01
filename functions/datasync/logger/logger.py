import logging
import time
from http import HTTPStatus

logger = logging.getLogger()


class DataProcessingError(Exception):
    def __init__(self, message: str):
        self.status_code: int = HTTPStatus.INTERNAL_SERVER_ERROR
        self.detail: str = message
        super().__init__(message)


class FileValidationError(Exception):
    def __init__(self, message: str):
        self.status_code: int = HTTPStatus.BAD_REQUEST
        self.detail: str = message
        super().__init__(message)


class ProcessingStatus(Exception):
    def __init__(self, message: str = ""):
        super().__init__(message)
        self.total_rows: int = 0
        self.processed_rows: int = 0
        self.failed_rows: int = 0
        self.start_time: float = time.time()
        self.detail: str = message

    def update(self, processed: int, failed: int = 0):
        self.processed_rows += processed
        self.failed_rows += failed

    def get_progress(self) -> dict[str, str | int | float]:
        current_time = time.time()
        return {
            "total": self.total_rows,
            "processed": self.processed_rows,
            "failed": self.failed_rows,
            "start_time": self.start_time,
            "end_time": current_time,
            "elapsed_time": current_time - self.start_time,
            "detail": self.detail,
        }
