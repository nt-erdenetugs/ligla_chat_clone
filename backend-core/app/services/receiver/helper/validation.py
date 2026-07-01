import json
import uuid
from typing import Any

from pydantic import ValidationError as PydanticValidationError

from app.common.errors import (
    DeserializationError,
    InvalidContentTypeError,
    InvalidMessageFormatError,
    InvalidMessageTypeError,
    MissingRequiredFieldError,
    SchemaValidationError,
    raise_error,
)
from app.common.utils import get_logger
from app.services.receiver.constants import ALLOWED_CONTENT_TYPES, ALLOWED_MESSAGE_TYPES, MessageType
from app.services.receiver.helper.decorators import handle_receiver_errors
from app.services.receiver.helper.parsers import parse_pydantic_validation_errors
from app.services.receiver.schemas import (
    BaseMessageRequest,
    EndSessionRequest,
    MessageRequest,
    NewMessageRequest,
    OngoingMessageRequest,
    UnsendMessageRequest,
    UserSurveyRequest,
)

logger = get_logger(__name__)


def validate_message_type(message_request: MessageRequest) -> None:
    if message_request.message_type not in ALLOWED_MESSAGE_TYPES:
        raise_error(
            InvalidMessageTypeError(received_type=message_request.message_type, allowed_types=ALLOWED_MESSAGE_TYPES)
        )


def validate_content_type(message_request: MessageRequest) -> None:
    if isinstance(message_request, OngoingMessageRequest):
        if message_request.content_type not in ALLOWED_CONTENT_TYPES:
            raise_error(
                InvalidContentTypeError(received_type=message_request.content_type, allowed_types=ALLOWED_CONTENT_TYPES)
            )


def validate_operator_assignment(message_request: MessageRequest) -> None:
    operator_id_to_validate = None

    if not isinstance(message_request, NewMessageRequest):
        return

    if message_request.favorites:
        favorites = message_request.favorites
        operator_id_to_validate = str(favorites.operator_id).strip()

    if operator_id_to_validate:
        logger.debug(
            "Validating operator assignment from favorites",
            extra={
                "operator_id": operator_id_to_validate,
                "organization": message_request.client_name,
                "user_id": message_request.user_id,
            },
        )

        try:
            uuid.UUID(operator_id_to_validate)
            logger.debug(
                "Operator ID validation successful",
                extra={"operator_id": operator_id_to_validate, "format": "UUID"},
            )
        except ValueError:
            logger.warning(
                "Invalid operator ID format - clearing from favorites",
                extra={
                    "operator_id": operator_id_to_validate,
                    "organization": message_request.client_name,
                    "user_id": message_request.user_id,
                    "expected_format": "UUID",
                },
            )
            if hasattr(message_request, "favorites") and message_request.favorites:
                message_request.favorites.operator_id = None
                logger.debug(
                    "Operator ID cleared from favorites - assignment will fall back to team",
                    extra={"organization": message_request.client_name},
                )


@handle_receiver_errors
def validate_message_data(message_data: str | dict[str, Any]) -> MessageRequest:
    message_dict: dict[str, Any]

    if isinstance(message_data, str):
        logger.debug("Parsing string message data to JSON", extra={"data_length": len(message_data)})
        try:
            parsed_data = json.loads(message_data)
            if not isinstance(parsed_data, dict):
                raise_error(
                    InvalidMessageFormatError(
                        details={"received_type": type(parsed_data).__name__},
                        suggestion="Ensure message data is a valid JSON object, not a primitive or array",
                    )
                )
            message_dict = parsed_data
            logger.debug("Message data parsed successfully", extra={"fields_count": len(message_dict)})
        except json.JSONDecodeError as e:
            raise_error(DeserializationError(original_error=e))
    else:
        message_dict = message_data
        logger.debug("Message data already in dict format", extra={"fields_count": len(message_dict)})

    message_type = message_dict.get("messageType")
    if not message_type:
        raise_error(
            MissingRequiredFieldError(
                field_name="messageType",
                context=f"message. Allowed values: {', '.join(ALLOWED_MESSAGE_TYPES)}",
            )
        )

    client_name = message_dict.get("clientName", "unknown")
    user_id = message_dict.get("userId", "unknown")

    try:
        match message_type:
            case MessageType.NEW_MESSAGE:
                logger.debug(
                    "Instantiating NewMessageRequest schema",
                    extra={
                        "message_type": message_type,
                        "organization": client_name,
                        "user_id": user_id,
                    },
                )
                return NewMessageRequest(**message_dict)
            case MessageType.ONGOING_MESSAGE:
                logger.debug(
                    "Instantiating OngoingMessageRequest schema",
                    extra={
                        "message_type": message_type,
                        "organization": client_name,
                        "user_id": user_id,
                        "content_type": message_dict.get("contentType"),
                    },
                )
                return OngoingMessageRequest(**message_dict)
            case MessageType.UNSEND_MESSAGE:
                logger.debug(
                    "Instantiating UnsendMessageRequest schema",
                    extra={
                        "message_type": message_type,
                        "organization": client_name,
                        "user_id": user_id,
                        "message_id": message_dict.get("messageId"),
                    },
                )
                return UnsendMessageRequest(**message_dict)
            case MessageType.END_SESSION:
                logger.debug(
                    "Instantiating EndSessionRequest schema",
                    extra={
                        "message_type": message_type,
                        "organization": client_name,
                        "user_id": user_id,
                    },
                )
                return EndSessionRequest(**message_dict)
            case MessageType.USER_FOLLOW | MessageType.USER_UNFOLLOW:
                logger.debug(
                    "Instantiating BaseMessageRequest schema",
                    extra={
                        "message_type": message_type,
                        "organization": client_name,
                        "user_id": user_id,
                    },
                )
                return BaseMessageRequest(**message_dict)
            case MessageType.SURVEY:
                logger.debug(
                    "Instantiating UserSurveyRequest schema",
                    extra={
                        "message_type": message_type,
                        "organization": client_name,
                        "user_id": user_id,
                        "has_additions": "additions" in message_dict,
                    },
                )
                return UserSurveyRequest(**message_dict)
            case _:
                raise_error(InvalidMessageTypeError(received_type=message_type, allowed_types=ALLOWED_MESSAGE_TYPES))
    except PydanticValidationError as ve:
        field_errors = parse_pydantic_validation_errors(ve)
        raise_error(SchemaValidationError(field_errors=field_errors))


@handle_receiver_errors
def validate_incoming_message(decoded_data: str) -> MessageRequest:
    logger.debug("Starting message validation pipeline", extra={"data_length": len(decoded_data)})

    message_request = validate_message_data(decoded_data)

    validate_message_type(message_request)

    if message_request.message_type == MessageType.ONGOING_MESSAGE:
        validate_content_type(message_request)

    if message_request.message_type == MessageType.NEW_MESSAGE:
        validate_operator_assignment(message_request)

    logger.info(
        "Message validation completed successfully",
        extra={
            "message_type": message_request.message_type,
            "organization": message_request.client_name,
            "user_id": message_request.user_id,
        },
    )
    return message_request
