import json
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm.session import Session

from app.common.errors import (
    ChatActivityError,
    ChatAssignmentError,
    ChatCreationError,
    ChatNotFoundError,
    MessageProcessingError,
    raise_error,
)
from app.common.utils import get_exception_info, get_logger
from app.db.models import ActivityType, Chat, ChatActivityActorType, ChatMessage, Organization
from app.db.tenant_context import with_tenant_context
from app.services.auto_reply.service import AutoReplyService
from app.services.encryption import EncryptionService
from app.services.receiver import repository, schemas
from app.services.receiver.constants import MessageType
from app.services.receiver.dependencies import get_encryption_service
from app.services.receiver.helper.notifications import notify_bff_auto_reply, notify_bff_message
from app.services.receiver.schemas.message import MessageRequest

logger = get_logger(__name__)


@dataclass
class MessageProcessingResult:
    message_request: MessageRequest
    end_user_id: str
    chat_id: uuid.UUID
    organization_name: str
    message_id: uuid.UUID | None = None
    auto_reply_message: ChatMessage | None = None
    close_chat: bool | None = None

    async def notify_bff(self):
        await notify_bff_message(self.message_request, self.end_user_id, self.chat_id, self.message_id)

    async def notify_bff_auto_reply(self):
        if self.auto_reply_message:
            await notify_bff_auto_reply(
                Chat(id=self.chat_id, endUserId=self.end_user_id),
                self.auto_reply_message,
                self.close_chat,
                self.organization_name,
            )


@with_tenant_context(organization_name=lambda *args, **kwargs: args[0].client_name)
async def handle_nonexisting_user(message_request: schemas.MessageRequest, db: Session):
    logger.info(
        "Creating new end user and initializing chat",
        extra={
            "user_id": message_request.user_id,
            "organization": message_request.client_name,
            "message_type": message_request.message_type,
        },
    )
    end_user = repository.end_user.create_end_user(db=db, user_id=message_request.user_id, profile=schemas.Profile())

    chat = repository.chat.save_payload_to_database(db, message_request)
    if not chat:
        raise_error(ChatCreationError("Failed to save message payload"))

    chat_assignment = repository.chat_assignment.create_chat_assignment(
        db, chat.id, message_request.client_name, message_request.user_id, None, None
    )
    if not chat_assignment.success:
        raise_error(ChatAssignmentError("Failed to create chat assignment", chat_id=str(chat.id)))

    logger.info(
        "Successfully created new user with initial chat and assignment",
        extra={
            "user_id": message_request.user_id,
            "chat_id": str(chat.id),
            "organization": message_request.client_name,
        },
    )
    return end_user


@with_tenant_context(organization_name=lambda *args, **kwargs: args[0].client_name)
async def handle_new_message(
    message_request: schemas.NewMessageRequest, db: Session, encryption_service: EncryptionService
) -> MessageProcessingResult | None:
    logger.info(
        "Processing new message request",
        extra={
            "user_id": message_request.user_id,
            "organization": message_request.client_name,
            "has_favorites": bool(message_request.favorites),
            "has_additions": bool(message_request.additions),
            "auto_reply_enabled": message_request.auto_reply,
        },
    )

    organization = repository.organization.get_by_name(db, message_request.client_name)
    if not organization:
        logger.warning(
            "Organization not found - silently returning",
            extra={
                "organization": message_request.client_name,
                "user_id": message_request.user_id,
            },
        )
        return None

    # save_payload_to_database creates/updates the Chat and EndUser records only.
    # No chatMessage row is inserted here; the actual LINE message content arrives
    # via a separate OngoingMessageRequest handled by handle_ongoing_message, where
    # encryption is applied before the chatMessage is persisted.
    chat = repository.chat.save_payload_to_database(db, message_request)
    if not chat:
        raise_error(ChatCreationError("Failed to save message payload"))

    logger.info(
        "Chat created successfully",
        extra={
            "chat_id": str(chat.id),
            "end_user_id": chat.endUserId,
            "organization": message_request.client_name,
        },
    )

    if message_request.additions:
        chat_survey_create = schemas.SurveyDataCreate(
            clientUserId=chat.clientUserId,
            userSurvey=message_request.additions,
            organizationName=organization.name,
            endUserId=chat.endUserId,
        )
        repository.chat.upsert_chat_survey_data(db, chat_survey_create)
        logger.info(
            "Survey data attached to chat",
            extra={
                "chat_id": str(chat.id),
                "organization": organization.name,
                "survey_data": message_request.additions.model_dump(exclude_none=True),
            },
        )
    else:
        logger.debug(
            "No survey data to attach",
            extra={
                "chat_id": str(chat.id),
            },
        )

    end_user_id = message_request.user_id

    chat_assignment_result = repository.chat_assignment.create_chat_assignment(
        db, chat.id, organization.name, end_user_id, message_request.favorites, message_request.additions
    )

    if not chat_assignment_result.success:
        raise_error(ChatAssignmentError("Failed to create chat assignment", chat_id=str(chat.id)))

    logger.info(
        "Chat assignment created",
        extra={
            "chat_id": str(chat.id),
            "organization": organization.name,
            "end_user_id": end_user_id,
            "has_favorites": bool(message_request.favorites),
        },
    )

    activity_type = ActivityType.STATUS_CHANGE if message_request.auto_reply else ActivityType.USER_ADDED

    activity = schemas.ChatActivityCreate(
        chatId=chat.id,
        activityType=activity_type,
        actorType=ChatActivityActorType.SYSTEM,
    )

    chat_activity = repository.chat_activity.save_activity_to_db(db, obj_in=activity)
    if not chat_activity:
        raise_error(ChatActivityError("Failed to save chat activity", chat_id=str(chat.id)))

    logger.info(
        "Chat activity recorded",
        extra={
            "chat_id": str(chat.id),
            "activity_type": ActivityType.STATUS_CHANGE,
            "actor_type": ChatActivityActorType.SYSTEM,
        },
    )

    auto_reply_message = None
    close_chat = None
    if message_request.auto_reply:
        logger.info(
            "Preparing auto-reply for chat",
            extra={"chat_id": str(chat.id), "organization": message_request.client_name},
        )
        try:
            auto_reply_service = AutoReplyService(
                db,
                encryption_service,
                str(organization.id),
                message_request.client_name,
            )
            auto_reply_message, close_chat = await auto_reply_service.prepare_auto_reply(chat)
            if auto_reply_message:
                logger.info(
                    "Auto-reply prepared successfully",
                    extra={
                        "chat_id": str(chat.id),
                        "message_id": auto_reply_message.messageId,
                        "will_close_chat": close_chat,
                    },
                )
            else:
                logger.info(
                    "Auto-reply not sent - conditions not met",
                    extra={"chat_id": str(chat.id)},
                )
        except Exception as auto_reply_error:
            error_info = get_exception_info(auto_reply_error)
            logger.error(
                "Auto-reply preparation failed",
                extra={
                    "chat_id": str(chat.id),
                    "organization": message_request.client_name,
                    **error_info,
                },
            )
    else:
        logger.info("Auto-reply disabled for chat", extra={"chat_id": str(chat.id)})

    logger.info(
        "New message processing completed",
        extra={
            "chat_id": str(chat.id),
            "end_user_id": end_user_id,
            "organization": message_request.client_name,
            "auto_reply_sent": auto_reply_message is not None,
        },
    )

    return MessageProcessingResult(
        message_request=message_request,
        end_user_id=end_user_id,
        chat_id=chat.id,
        organization_name=organization.name,
        auto_reply_message=auto_reply_message,
        close_chat=close_chat,
    )


@with_tenant_context(organization_name=lambda *args, **kwargs: args[0].client_name)
async def handle_ongoing_message(
    ongoing_message: schemas.OngoingMessageRequest, db: Session, encryption_service: EncryptionService
) -> MessageProcessingResult | None:
    logger.info(
        "Processing ongoing message",
        extra={
            "user_id": ongoing_message.user_id,
            "organization": ongoing_message.client_name,
            "content_type": ongoing_message.content_type,
            "has_text": bool(getattr(ongoing_message, "text", None)),
        },
    )

    organization_and_chat = validate_organization_and_end_user(db, ongoing_message)
    if not organization_and_chat:
        return None
    organization, chat = organization_and_chat

    payload = schemas.ChatMessageCreate.from_ongoing_message(ongoing_message, chat.id)
    # TODO(JIRA-922): drop the contentEncrypted/isEncrypted dual-write; the encryption
    # trigger derives both from content.
    payload.contentEncrypted = encrypt_chat_message_content(
        db, payload.content, str(organization.id), encryption_service
    )
    payload.isEncrypted = payload.contentEncrypted is not None

    message = repository.chat_message.create_chat_message(db, payload)

    logger.info(
        "Ongoing message added to chat",
        extra={
            "chat_id": str(chat.id),
            "message_id": payload.messageId,
            "sender_type": payload.senderType,
            "content_type": payload.type,
            "organization": ongoing_message.client_name,
        },
    )

    return MessageProcessingResult(
        message_request=ongoing_message,
        end_user_id=ongoing_message.user_id,
        chat_id=chat.id,
        organization_name=ongoing_message.client_name,
        message_id=message.id,
    )


@with_tenant_context(organization_name=lambda *args, **kwargs: args[0].client_name)
async def handle_unsend_message(
    unsend_message: schemas.UnsendMessageRequest, db: Session, encryption_service: EncryptionService
) -> MessageProcessingResult | None:
    logger.info(
        "Processing unsend message request",
        extra={
            "user_id": unsend_message.user_id,
            "organization": unsend_message.client_name,
            "message_id": unsend_message.message_id,
        },
    )

    organization_and_chat = validate_organization_and_end_user(db, unsend_message)
    if not organization_and_chat:
        return None
    organization, chat = organization_and_chat

    success = repository.chat_message.mark_message_as_unsent(
        db,
        chat.id,
        unsend_message.message_id,
        str(organization.id),
        encryption_service,
    )
    if not success:
        raise_error(
            MessageProcessingError(
                f"Failed to mark message {unsend_message.message_id} as unsent",
                details={"chat_id": str(chat.id), "message_id": unsend_message.message_id},
            )
        )

    logger.info(
        "Message marked as unsent successfully",
        extra={
            "chat_id": str(chat.id),
            "message_id": unsend_message.message_id,
            "organization": unsend_message.client_name,
        },
    )

    return MessageProcessingResult(
        message_request=unsend_message,
        end_user_id=unsend_message.user_id,
        chat_id=chat.id,
        organization_name=unsend_message.client_name,
    )


@with_tenant_context(organization_name=lambda *args, **kwargs: args[0].client_name)
async def handle_user_action(message_request: MessageRequest, db: Session) -> MessageProcessingResult | None:
    logger.info(
        "Processing user action",
        extra={
            "user_id": message_request.user_id,
            "organization": message_request.client_name,
            "message_type": message_request.message_type,
        },
    )

    organization_and_chat = validate_organization_and_end_user(db, message_request)
    if not organization_and_chat:
        return None
    _, chat = organization_and_chat

    activity_type = None

    match message_request.message_type:
        case MessageType.USER_FOLLOW:
            was_user_blocked = chat.isUserBlocked
            if message_request.is_unblocked is True:
                activity_type = ActivityType.USER_FOLLOWED
            elif message_request.is_unblocked is False:
                activity_type = ActivityType.USER_FOLLOWED_NEW
            elif message_request.is_unblocked is None:
                if was_user_blocked:
                    activity_type = ActivityType.USER_FOLLOWED
                else:
                    activity_type = ActivityType.USER_FOLLOWED_NEW
        case MessageType.USER_UNFOLLOW:
            activity_type = ActivityType.USER_UNFOLLOWED
        case MessageType.END_SESSION if getattr(message_request, "is_timeout", None):
            activity_type = ActivityType.SESSION_TIMEOUT
        case _:
            activity_type = ActivityType.END_SESSION

    logger.info(
        "Mapping message type to activity",
        extra={
            "chat_id": str(chat.id),
            "message_type": message_request.message_type,
            "activity_type": activity_type,
        },
    )

    activity = schemas.ChatActivityCreate(
        chatId=chat.id, activityType=activity_type, actorType=ChatActivityActorType.SYSTEM
    )

    chat_activity = repository.chat_activity.save_activity_to_db(db, obj_in=activity)
    if not chat_activity:
        raise_error(ChatActivityError("Failed to save chat activity", chat_id=str(chat.id)))

    success = repository.chat.user_action(db, chat, message_request.message_type)
    if not success:
        raise_error(
            MessageProcessingError(
                f"Failed to complete action {activity_type}",
                details={"chat_id": str(chat.id), "activity_type": activity_type},
            )
        )

    logger.info(
        "User action completed successfully",
        extra={
            "chat_id": str(chat.id),
            "activity_type": activity_type,
            "message_type": message_request.message_type,
            "organization": message_request.client_name,
            "is_timeout": getattr(message_request, "is_timeout", None),
        },
    )

    return MessageProcessingResult(
        message_request=message_request,
        end_user_id=message_request.user_id,
        chat_id=chat.id,
        organization_name=message_request.client_name,
    )


@with_tenant_context(organization_name=lambda *args, **kwargs: args[0].client_name)
async def handle_user_survey(survey_request: schemas.UserSurveyRequest, db: Session):
    logger.info(
        "Processing user survey request",
        extra={
            "user_id": survey_request.user_id,
            "organization": survey_request.client_name,
            "has_additions": bool(survey_request.additions),
        },
    )

    organization_and_chat = validate_organization_and_end_user(db, survey_request)
    if not organization_and_chat:
        return
    _, chat = organization_and_chat

    if not survey_request.additions:
        raise_error(
            MessageProcessingError(
                "No data provided in survey request",
                details={"chat_id": str(chat.id)},
                retryable=False,
            )
        )

    create_data = schemas.SurveyDataCreate(
        clientUserId=chat.clientUserId,
        userSurvey=survey_request.additions,
        endUserId=chat.endUserId,
    )
    result = repository.chat.upsert_chat_survey_data(db, create_data)
    if result is None:
        raise_error(
            MessageProcessingError(
                "Failed to upsert chat survey data",
                details={"chat_id": str(chat.id)},
            )
        )

    logger.info(
        "User survey data saved successfully",
        extra={
            "chat_id": str(chat.id),
            "organization": survey_request.client_name,
            "survey_fields": list(survey_request.additions.model_dump().keys()) if survey_request.additions else [],
            "client_user_id": chat.clientUserId,
        },
    )


def validate_organization_and_end_user(
    db: Session, message_request: MessageRequest
) -> tuple[Organization, Chat] | None:
    logger.debug(
        "Validating organization and end user",
        extra={
            "organization": message_request.client_name,
            "user_id": message_request.user_id,
            "message_type": message_request.message_type,
        },
    )

    organization = repository.organization.get_by_name(db, message_request.client_name)
    if not organization:
        logger.warning(
            "Organization not found",
            extra={
                "organization": message_request.client_name,
                "user_id": message_request.user_id,
            },
        )
        return None

    end_user = repository.end_user.get_by_id(db, message_request.user_id)
    if not end_user:
        logger.warning(
            "End user not found",
            extra={
                "user_id": message_request.user_id,
                "organization": message_request.client_name,
            },
        )
        return None

    chat = repository.chat.get_by_end_user(db, message_request.user_id)
    if not chat:
        raise_error(ChatNotFoundError(message_request.client_name, message_request.user_id))

    logger.info(
        "Chat validated successfully",
        extra={
            "chat_id": str(chat.id),
            "organization": message_request.client_name,
            "user_id": message_request.user_id,
        },
    )

    return organization, chat


def encrypt_chat_message_content(
    db: Session,
    content: dict[str, Any] | None,
    organization_id: str,
    encryption_service: EncryptionService,
) -> bytes | None:
    if content is None:
        return None

    return encryption_service.encrypt_value(db, json.dumps(content), organization_id)


@with_tenant_context(organization_name=lambda *args, **kwargs: args[2])
async def handle_auto_reply(db: Session, chat: Chat, client_name: str):
    organization = repository.organization.get_by_name(db, client_name)
    if not organization:
        return

    auto_reply_service = AutoReplyService(
        db,
        get_encryption_service(),
        str(organization.id),
        client_name,
    )
    message, close_chat = await auto_reply_service.prepare_auto_reply(chat)
    if not message:
        return

    await notify_bff_auto_reply(chat, message, close_chat, client_name)
