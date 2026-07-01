import json
import uuid
from typing import Any

from sqlalchemy import insert, select
from sqlalchemy import update as sa_update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.common.crud_base import CRUDBase
from app.common.errors import DatabaseError, raise_error
from app.common.utils import get_logger
from app.db.models import ChatMessage, ContentType
from app.services.receiver import repository, schemas

logger = get_logger(__name__)


class CRUDChatMessage(CRUDBase[ChatMessage, schemas.ChatMessageCreate, schemas.ChatMessageUpdate]):
    def create_chat_message(
        self,
        db: Session,
        obj_in: schemas.ChatMessageCreate,
    ) -> ChatMessage:
        logger.info(
            "Creating chat message",
            extra={
                "chat_id": str(obj_in.chatId),
                "sender_type": obj_in.senderType,
                "content_type": obj_in.type,
                "has_plaintext_content": obj_in.content is not None,
                "has_encrypted_content": obj_in.contentEncrypted is not None,
            },
        )

        create_data = obj_in.model_dump(exclude_none=True)

        if isinstance(create_data.get("type"), str):
            create_data["type"] = ContentType(create_data["type"])

        content = create_data.get("content")
        if content is not None and not isinstance(content, dict):
            raise_error(
                DatabaseError(
                    "Chat message plaintext content must be a JSON dict for the JSONB column",
                    details={"chat_id": str(obj_in.chatId), "content_type": type(content).__name__},
                )
            )

        stmt = insert(ChatMessage).values(**create_data).returning(ChatMessage)
        result = db.execute(stmt)

        chat_message = result.scalar_one()
        repository.chat.update_latest_message_timestamp(db, chat_message)

        logger.info(
            "Chat message created successfully",
            extra={
                "chat_id": str(obj_in.chatId),
                "message_id": str(chat_message.id),
                "sender_type": chat_message.senderType,
                "content_type": chat_message.type.value,
                "is_encrypted": chat_message.isEncrypted,
                "created_at": str(chat_message.createdAt),
            },
        )

        return chat_message

    def mark_message_as_unsent(
        self,
        db: Session,
        chat_id: uuid.UUID,
        message_id: str,
    ) -> bool:
        try:
            stmt = select(
                ChatMessage.id,
                ChatMessage.content,
                ChatMessage.isEncrypted,
            ).where(ChatMessage.chatId == chat_id, ChatMessage.messageId == message_id)
            result = db.execute(stmt).first()

            if not result:
                # Fallback for older rows where messageId was embedded inside the JSONB payload
                # rather than promoted to a column.
                stmt = select(
                    ChatMessage.id,
                    ChatMessage.content,
                    ChatMessage.isEncrypted,
                ).where(ChatMessage.chatId == chat_id)
                for row in db.execute(stmt).fetchall():
                    _, content_temp, _ = row
                    if isinstance(content_temp, dict) and content_temp.get("id") == message_id:
                        result = row
                        break

            if not result:
                logger.warning(
                    "Message not found for unsend operation",
                    extra={"chat_id": str(chat_id), "message_id": message_id},
                )
                return False

            msg_id, content_plain, is_encrypted = result

            updated_plain: dict[str, Any] | None = None
            if isinstance(content_plain, dict):
                updated_plain = dict(content_plain)
                updated_plain["unsent"] = True
            elif content_plain is not None:
                # Legacy bytes-shaped content (rows that were written under the prior
                # destructive-migration deploy attempt and not yet cleaned up).
                try:
                    decoded = bytes(content_plain).decode("utf-8")
                    parsed = json.loads(decoded)
                    if isinstance(parsed, dict):
                        parsed["unsent"] = True
                        updated_plain = parsed
                except (UnicodeDecodeError, json.JSONDecodeError, TypeError, ValueError):
                    logger.debug(
                        "Could not parse legacy plaintext content; updating flag only",
                        extra={"chat_id": str(chat_id), "message_id": message_id},
                    )

            update_values: dict[str, Any] = {"isUnsent": True}
            if updated_plain is not None:
                # Write only the plaintext column: the BEFORE UPDATE encryption trigger
                # re-derives contentEncrypted/isEncrypted from it. Setting them here too
                # would briefly leave contentEncrypted NULL until the trigger ran.
                update_values["content"] = updated_plain

            db.execute(sa_update(ChatMessage).where(ChatMessage.id == msg_id).values(**update_values))

            logger.info(
                "Message marked as unsent successfully",
                extra={
                    "chat_id": str(chat_id),
                    "message_id": message_id,
                    "is_encrypted": is_encrypted,
                },
            )
            return True

        except SQLAlchemyError as e:
            logger.error(
                "Database error while marking message as unsent",
                extra={
                    "chat_id": str(chat_id),
                    "message_id": message_id,
                    "error": str(e),
                },
            )
            raise_error(
                DatabaseError(
                    "Failed to mark message as unsent",
                    details={"chat_id": str(chat_id), "message_id": message_id},
                )
            )


chat_message = CRUDChatMessage(ChatMessage)
