import uuid

from app.common.errors import BFFNotificationError, raise_error
from app.common.utils import get_logger
from app.db.models import Chat, ChatMessage
from app.libs.utils.notifications import notify_bff
from app.services.receiver import schemas
from app.services.receiver.constants import MessageType

logger = get_logger(__name__)


async def notify_bff_message(
    message_request: schemas.MessageRequest, end_user_id: str, chat_id: uuid.UUID, message_id: uuid.UUID | None = None
) -> None:
    logger.debug(
        "Preparing BFF notification",
        extra={
            "chat_id": str(chat_id),
            "message_type": message_request.message_type,
            "organization": message_request.client_name,
            "end_user_id": end_user_id,
        },
    )

    match message_request.message_type:
        case (
            MessageType.NEW_MESSAGE
            | MessageType.UNSEND_MESSAGE
            | MessageType.END_SESSION
            | MessageType.USER_FOLLOW
            | MessageType.USER_UNFOLLOW
        ):
            message_response = schemas.MessageResponse(
                clientName=message_request.client_name,
                endUserId=end_user_id,
                chatId=str(chat_id),
            )
        case MessageType.ONGOING_MESSAGE:
            # For ongoing messages, include the message content if it's text
            message_text = getattr(message_request, "text", None)
            message_response = schemas.MessageResponse(
                clientName=message_request.client_name,
                message=message_text,
                endUserId=end_user_id,
                chatId=str(chat_id),
                messageId=str(message_id) if message_id else None,
            )
            logger.debug(
                "Including message text in BFF notification",
                extra={
                    "chat_id": str(chat_id),
                    "has_text": bool(message_text),
                    "text_length": len(message_text) if message_text else 0,
                },
            )
        case _:
            raise_error(
                BFFNotificationError(
                    chat_id=str(chat_id),
                    reason=f"Invalid message type: {message_request.message_type}",
                )
            )

    res = await notify_bff(message_response)
    if res is None:
        logger.warning(
            "BFF notification failed but operation continues",
            extra={
                "chat_id": str(chat_id),
                "message_type": message_request.message_type,
                "organization": message_request.client_name,
                "end_user_id": end_user_id,
                "non_blocking": True,
            },
        )
        return

    if res.status_code not in [200, 201]:
        logger.warning(
            "BFF notification returned non-success status but operation continues",
            extra={
                "chat_id": str(chat_id),
                "status_code": res.status_code,
                "message_type": message_request.message_type,
                "organization": message_request.client_name,
                "end_user_id": end_user_id,
                "non_blocking": True,
            },
        )
        return

    logger.info(
        "BFF notified successfully",
        extra={
            "chat_id": str(chat_id),
            "message_type": message_request.message_type,
            "status_code": res.status_code,
        },
    )


async def notify_bff_auto_reply(
    chat: Chat, message: ChatMessage, close_chat: bool | None, organization_name: str
) -> None:
    logger.debug(
        "Sending auto-reply notification to BFF",
        extra={
            "chat_id": str(chat.id),
            "message_id": str(message.id),
            "organization": organization_name,
            "close_chat": close_chat,
        },
    )

    message_response = schemas.MessageResponse(
        clientName=organization_name,
        chatId=str(chat.id),
        endUserId=str(chat.endUserId),
        isAutoReplyMessage=True,
        messageId=str(message.id),
        closeChat=close_chat,
    )

    result = await notify_bff(message_response)
    if result is None:
        logger.warning(
            "Auto-reply BFF notification failed but operation continues",
            extra={
                "chat_id": str(chat.id),
                "message_id": str(message.id),
                "organization": organization_name,
                "non_blocking": True,
            },
        )
        return

    if result.status_code not in [200, 201]:
        logger.warning(
            "Auto-reply BFF notification returned non-success status but operation continues",
            extra={
                "chat_id": str(chat.id),
                "message_id": str(message.id),
                "status_code": result.status_code,
                "organization": organization_name,
                "non_blocking": True,
            },
        )
        return

    logger.info(
        "Auto-reply notification sent to BFF successfully",
        extra={
            "chat_id": str(chat.id),
            "message_id": str(message.id),
            "status_code": result.status_code,
            "close_chat": close_chat,
        },
    )
