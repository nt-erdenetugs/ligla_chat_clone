import logging
import os
import re
import traceback
import uuid

from app.libs.gcp.log.cloud_logging import get_cloud_logger

_LINE_USER_ID_RE = re.compile(r"^U[0-9a-f]{32}$")


def get_logger(name: str = __name__) -> logging.Logger:
    return get_cloud_logger(name)


def validate_line_user_id(value: str) -> bool:
    return bool(_LINE_USER_ID_RE.match(value))


def get_exception_info(exception: Exception) -> dict[str, str | int]:
    info = {
        "error_type": type(exception).__name__,
        "error_message": str(exception),
    }

    tb = traceback.extract_tb(exception.__traceback__)
    if tb:
        last_frame = tb[-1]
        info["error_file"] = os.path.basename(last_frame.filename)
        info["error_line"] = last_frame.lineno
        info["error_function"] = last_frame.name

    return info


def uuid_to_schema_name(org_id: uuid.UUID | str) -> str:
    compact = str(org_id).replace("-", "").lower()
    return f"org_{compact}"
