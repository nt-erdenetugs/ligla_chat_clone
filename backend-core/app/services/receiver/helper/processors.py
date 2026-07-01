from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.orm import Session

from app.common.errors import SchemaValidationError, raise_error
from app.common.utils import get_logger
from app.services.encryption import EncryptionService
from app.services.receiver.constants import MessageType
from app.services.receiver.helper.decorators import handle_receiver_errors
from app.services.receiver.helper.parsers import build_metadata, parse_pydantic_validation_errors
from app.services.receiver.schemas import (
    MessageRequest,
    NewMessageRequest,
    OngoingMessageRequest,
    UnsendMessageRequest,
    UserSurveyRequest,
)
from app.services.receiver.service import (
    MessageProcessingResult,
    handle_new_message,
    handle_ongoing_message,
    handle_unsend_message,
    handle_user_action,
    handle_user_survey,
)

logger = get_logger(__name__)


@dataclass
class HandlerConfig:
    handler: Callable[..., Any]
    schema: type[BaseModel] | None
    description: str
    requires_encryption: bool = False


# Handler registry mapping message types to their configurations
HANDLER_REGISTRY: dict[MessageType, HandlerConfig] = {
    MessageType.NEW_MESSAGE: HandlerConfig(
        handler=handle_new_message,
        schema=NewMessageRequest,
        description="new message",
        requires_encryption=True,
    ),
    MessageType.ONGOING_MESSAGE: HandlerConfig(
        handler=handle_ongoing_message,
        schema=OngoingMessageRequest,
        description="ongoing message",
        requires_encryption=True,
    ),
    MessageType.UNSEND_MESSAGE: HandlerConfig(
        handler=handle_unsend_message,
        schema=UnsendMessageRequest,
        description="unsend message",
        requires_encryption=True,
    ),
    MessageType.SURVEY: HandlerConfig(handler=handle_user_survey, schema=UserSurveyRequest, description="survey"),
    MessageType.END_SESSION: HandlerConfig(handler=handle_user_action, schema=None, description="user action"),
    MessageType.USER_UNFOLLOW: HandlerConfig(handler=handle_user_action, schema=None, description="user action"),
    MessageType.USER_FOLLOW: HandlerConfig(handler=handle_user_action, schema=None, description="user action"),
}


async def _execute_handler(
    message_request: MessageRequest, config: HandlerConfig, db: Session, encryption_service: EncryptionService
) -> MessageProcessingResult | None:
    # Build metadata for logging
    extra_metadata: dict[str, Any] = {}
    if config.schema is None:  # User action handlers
        extra_metadata["action_type"] = message_request.message_type

    logger.debug(f"Routing to {config.description} handler", extra=build_metadata(message_request, extra_metadata))

    # Convert to specific schema if needed, otherwise use base request
    if config.schema:
        typed_request = config.schema(**message_request.model_dump(by_alias=True))
        if config.requires_encryption:
            result = await config.handler(typed_request, db, encryption_service)
        else:
            result = await config.handler(typed_request, db)
    else:
        if config.requires_encryption:
            result = await config.handler(message_request, db, encryption_service)
        else:
            result = await config.handler(message_request, db)

    # Build success log metadata
    success_metadata: dict[str, Any] = extra_metadata.copy()
    if result and hasattr(result, "chat_id"):
        success_metadata["chat_id"] = str(result.chat_id)

    logger.info(
        f"{config.description.capitalize()} processed successfully",
        extra=build_metadata(message_request, success_metadata),
    )

    return result


@handle_receiver_errors
async def process_message(
    message_request: MessageRequest, db: Session, encryption_service: EncryptionService
) -> MessageProcessingResult | None:
    logger.info("Starting message processing", extra=build_metadata(message_request))

    try:
        # Look up handler configuration
        config = HANDLER_REGISTRY.get(message_request.message_type)
        if not config:
            raise ValueError(f"Unknown message type: {message_request.message_type}")

        # Execute the handler with logging and schema conversion
        return await _execute_handler(message_request, config, db, encryption_service)

    except PydanticValidationError as ve:
        field_errors = parse_pydantic_validation_errors(ve)
        raise_error(SchemaValidationError(field_errors=field_errors))
