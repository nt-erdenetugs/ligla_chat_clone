import base64
from typing import Any

from fastapi import Request
from pydantic import ValidationError as PydanticValidationError

from app.common.errors import DeserializationError, InvalidMessageFormatError, MissingRequiredFieldError, raise_error
from app.common.utils import get_logger
from app.services.receiver.schemas import MessageRequest

logger = get_logger(__name__)


def build_metadata(message_request: MessageRequest, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "message_type": message_request.message_type,
        "organization": message_request.client_name,
        "user_id": message_request.user_id,
        **(extra or {}),
    }


def parse_pydantic_validation_errors(validation_error: PydanticValidationError) -> list[str]:
    field_errors: list[str] = []
    if hasattr(validation_error, "errors"):
        for error in validation_error.errors():
            field = ".".join(str(loc) for loc in error.get("loc", []))
            error_msg = error.get("msg", "validation failed")
            error_type = error.get("type", "")
            if error_type:
                field_errors.append(f"Field '{field}': {error_msg} (type: {error_type})")
            else:
                field_errors.append(f"Field '{field}': {error_msg}")
    return field_errors


async def parse_request_body(request: Request) -> dict[str, Any]:
    try:
        return await request.json()
    except Exception as e:
        raise_error(InvalidMessageFormatError(details={"error": str(e)}))


def decode_pubsub_data(payload: dict[str, Any]) -> str:
    data = payload.get("message", {}).get("data")
    if not data:
        raise_error(MissingRequiredFieldError(field_name="data", context="Pub/Sub message"))

    try:
        return base64.b64decode(data).decode("utf-8")
    except Exception as e:
        raise_error(DeserializationError(original_error=e))


def acknowledge(message: str, success: bool) -> dict[str, str]:
    if success:
        logger.info("Message acknowledged successfully", extra={"acknowledgement_message": message})
        return {"status": "Acknowledged", "message": message}
    else:
        logger.warning("Message acknowledged with error", extra={"acknowledgement_message": message})
        return {"status": "Acknowledged", "error": message}
