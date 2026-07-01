from typing import Any

import requests
from sqlalchemy import func, select
from sqlalchemy import update as sa_update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.common.crud_base import CRUDBase
from app.common.errors import ChatCreationError, DatabaseError, DatabaseIntegrityError, ExternalAPIError, raise_error
from app.common.utils import get_logger
from app.config.settings import settings
from app.db.models import Chat, ChatActivity, ChatMessage, ChatStatus, EndUser, Organization, SurveyData
from app.services.receiver import repository, schemas
from app.services.receiver.constants import MessageType

logger = get_logger(__name__)


def safe_getattr(obj: Any, field_name: str, default: Any = None, log_error: bool = True) -> Any:
    try:
        return getattr(obj, field_name, default)
    except AttributeError as e:
        if log_error:
            logger.error(f"Field access error: {field_name} not found on {type(obj).__name__}: {e}")
        return default


class CRUDChat(CRUDBase[Chat, schemas.ChatCreate, schemas.ChatUpdate]):
    def get_by_end_user(self, db: Session, endUser_id: str) -> Chat | None:
        stmt = select(Chat).where(Chat.endUserId == endUser_id)
        result = db.execute(stmt).scalar_one_or_none()
        logger.info(
            "Query chat by end user",
            extra={
                "end_user_id": endUser_id,
                "found": result is not None,
                "chat_id": str(result.id) if result else None,
            },
        )
        return result

    def update_latest_message_timestamp(self, db: Session, target: ChatActivity | ChatMessage) -> None:
        stmt = sa_update(Chat).where(Chat.id == target.chatId).values(latestMessageTimestamp=target.createdAt)
        db.execute(stmt)

    def user_action(
        self, db: Session, chat: Chat, message_type: MessageType, extra_values: dict[str, Any] | None = None
    ) -> Chat:
        logger.info(
            "Processing user action",
            extra={
                "chat_id": str(chat.id),
                "message_type": message_type.value,
                "current_session_active": chat.sessionActive,
                "current_is_blocked": chat.isUserBlocked,
            },
        )

        update_values: dict[str, Any] = {}
        match message_type:
            case MessageType.NEW_MESSAGE:
                update_values["sessionActive"] = True
            case MessageType.END_SESSION:
                update_values["sessionActive"] = False
            case MessageType.USER_FOLLOW:
                update_values["isUserBlocked"] = False
            case MessageType.USER_UNFOLLOW:
                update_values["isUserBlocked"] = True
            case _:
                pass

        if extra_values:
            update_values.update(extra_values)

        if update_values:
            stmt = sa_update(Chat).where(Chat.id == chat.id).values(**update_values).returning(Chat)
            result = db.execute(stmt)
            chat = result.scalar_one()

        logger.info(
            "User action processed",
            extra={
                "chat_id": str(chat.id),
                "message_type": message_type.value,
                "session_active": chat.sessionActive,
                "is_blocked": chat.isUserBlocked,
            },
        )
        return chat

    def close_chat_session(self, end_user_id: str, organization: Organization):
        headers = {
            "Content-Type": "application/json",
            "X-API-KEY": organization.apiKey,
        }

        body = {
            "userId": end_user_id,
        }

        url = f"{settings.LIGLA_MESSAGE_BASE_URL}/{organization.name}{settings.LIGLA_MESSAGE_CLOSE_ENDPOINT_PATH}"

        res = None
        try:
            res = requests.post(url, json=body, headers=headers)
            if not (200 <= res.status_code < 300):
                response_body = res.text[:500] if res.text else None
                raise ExternalAPIError(settings.LIGLA_MESSAGE_CLOSE_ENDPOINT_PATH, res.status_code, response_body)
            return res.content
        except requests.RequestException as e:
            status_code = e.response.status_code if hasattr(e, "response") and e.response else 500
            raise ExternalAPIError(settings.LIGLA_MESSAGE_CLOSE_ENDPOINT_PATH, status_code, str(e))
        finally:
            if res is not None:
                res.close()

    def upsert_chat_survey_data(self, db: Session, obj_in: schemas.SurveyDataCreate):
        logger.info(
            "Upserting survey data",
            extra={
                "end_user_id": obj_in.endUserId,
                "survey_data": obj_in.userSurvey.model_dump(exclude_none=True),
            },
        )

        try:
            chat_survey_data = obj_in.model_dump()
            user_survey_data = obj_in.userSurvey.model_dump()
            filtered_user_survey = {k: v for k, v in user_survey_data.items() if v is not None}

            logger.info(
                "Survey data prepared",
                extra={
                    "end_user_id": obj_in.endUserId,
                    "filtered_fields_count": len(filtered_user_survey),
                },
            )

            chat_survey_data["userSurvey"] = filtered_user_survey

            stmt = pg_insert(SurveyData).values(**chat_survey_data)
            stmt = stmt.on_conflict_do_update(
                index_elements=[SurveyData.endUserId],
                set_=dict(clientUserId=obj_in.clientUserId, userSurvey=filtered_user_survey, updatedAt=func.now()),
            )
            result = db.execute(stmt)

            logger.info(
                "Survey data upserted successfully",
                extra={
                    "end_user_id": obj_in.endUserId,
                },
            )
            return result
        except IntegrityError as e:
            error = DatabaseIntegrityError(
                "survey_data_upsert",
                original_error=e,
            )
            error.log()
            return
        except SQLAlchemyError:
            DatabaseError(
                "Failed to upsert survey data",
                details={"end_user_id": obj_in.endUserId},
            ).log()
            return

    def save_payload_to_database(self, db: Session, obj_in: schemas.MessageRequest) -> Chat | None:
        organization = repository.organization.get_by_name(db, obj_in.client_name)
        if not organization:
            # This should ideally not happen if service layer already checked,
            # but for robustness:
            raise_error(ChatCreationError(f"Organization not found: {obj_in.client_name}"))

        logger.info(
            "Starting payload save to database",
            extra={
                "organization_id": str(organization.id),
                "organization_name": organization.name,
                "user_id": obj_in.user_id,
                "message_type": type(obj_in).__name__,
            },
        )

        try:
            end_user = repository.end_user.get_by_id(db, obj_in.user_id)
            if not end_user:
                # Use provided profile or create default if None
                if isinstance(obj_in, schemas.NewMessageRequest):
                    logger.info(
                        "Creating new end user",
                        extra={
                            "organization": obj_in.client_name,
                            "user_id": obj_in.user_id,
                            "has_profile": obj_in.profile is not None,
                            "display_name": obj_in.profile.display_name if obj_in.profile else None,
                        },
                    )
                    profile_to_use = obj_in.profile if obj_in.profile else schemas.Profile()
                    try:
                        end_user = repository.end_user.create_end_user(db, obj_in.user_id, profile_to_use)
                    except IntegrityError as integrity_err:
                        logger.warning(
                            "Race condition on end user creation, retrying",
                            extra={
                                "organization": obj_in.client_name,
                                "user_id": obj_in.user_id,
                                "error_type": type(integrity_err).__name__,
                            },
                        )
                        db.rollback()
                        end_user = repository.end_user.get_by_id(db, obj_in.user_id)
                        if not end_user:
                            logger.error(
                                "End user still not found after retry",
                                extra={"user_id": obj_in.user_id},
                            )
                            raise
                else:
                    logger.warning(
                        "End user not found for non-NewMessageRequest",
                        extra={
                            "organization": obj_in.client_name,
                            "user_id": obj_in.user_id,
                            "message_type": type(obj_in).__name__,
                        },
                    )

            # Only update profile if we have profile data and it's a NewMessageRequest
            if (
                isinstance(obj_in, schemas.NewMessageRequest)
                and end_user
                and obj_in.profile
                and (
                    end_user.displayName != obj_in.profile.display_name
                    or end_user.pictureUrl != obj_in.profile.picture_url
                )
            ):
                logger.info(
                    "Updating end user profile",
                    extra={
                        "organization_id": str(organization.id),
                        "user_id": obj_in.user_id,
                        "old_display_name": end_user.displayName,
                        "new_display_name": obj_in.profile.display_name,
                        "profile_updated": True,
                    },
                )
                stmt = (
                    sa_update(EndUser)
                    .where(EndUser.userId == obj_in.user_id)
                    .values(displayName=obj_in.profile.display_name, pictureUrl=obj_in.profile.picture_url)
                )
                db.execute(stmt)

            user_id = obj_in.user_id

            chat = self.get_by_end_user(db, user_id)
            client_user_id: str | None = None

            if isinstance(obj_in, schemas.NewMessageRequest):
                client_user_id = safe_getattr(obj_in, "client_user_id")

            if not chat:
                logger.info(
                    "Creating new chat",
                    extra={
                        "organization_id": str(organization.id),
                        "user_id": obj_in.user_id,
                        "client_user_id": client_user_id,
                        "end_user_exists": end_user is not None,
                    },
                )

                chat_create_data = schemas.ChatCreate(endUserId=obj_in.user_id, clientUserId=client_user_id)
                chat = self.create(db, obj_in=chat_create_data)

                logger.info(
                    "Chat created successfully",
                    extra={
                        "organization_id": str(organization.id),
                        "user_id": obj_in.user_id,
                        "chat_id": str(chat.id),
                        "chat_status": chat.chatStatus.value,
                        "session_active": chat.sessionActive,
                    },
                )
            else:
                old_status = chat.chatStatus
                status_changed = False

                logger.info(
                    "Existing chat found",
                    extra={
                        "organization_id": str(organization.id),
                        "user_id": obj_in.user_id,
                        "chat_id": str(chat.id),
                        "current_status": chat.chatStatus.value,
                        "session_active": chat.sessionActive,
                        "assigned_user_id": str(chat.assignedUserId) if chat.assignedUserId else None,
                    },
                )

                extra_updates: dict[str, Any] = {}

                if chat.chatStatus == ChatStatus.DONE:
                    extra_updates["chatStatus"] = ChatStatus.ADDRESSING
                    status_changed = True
                    logger.info(
                        "Chat status updated from DONE to ADDRESSING",
                        extra={
                            "organization_id": str(organization.id),
                            "chat_id": str(chat.id),
                            "old_status": old_status.value,
                            "new_status": ChatStatus.ADDRESSING.value,
                        },
                    )

                if client_user_id and chat.clientUserId != client_user_id:
                    conflict = db.execute(
                        select(Chat.id).where(Chat.clientUserId == client_user_id, Chat.id != chat.id)
                    ).scalar_one_or_none()
                    if conflict:
                        logger.warning(
                            "clientUserId already owned by another chat, skipping update",
                            extra={
                                "organization_id": str(organization.id),
                                "chat_id": str(chat.id),
                                "conflicting_chat_id": str(conflict),
                                "client_user_id": client_user_id,
                            },
                        )
                    else:
                        extra_updates["clientUserId"] = client_user_id
                        logger.info(
                            "Client user ID updated",
                            extra={
                                "organization_id": str(organization.id),
                                "chat_id": str(chat.id),
                                "client_user_id": client_user_id,
                            },
                        )

                chat = self.user_action(db, chat, MessageType.NEW_MESSAGE, extra_updates or None)

                logger.info(
                    "Chat updated successfully",
                    extra={
                        "organization_id": str(organization.id),
                        "user_id": obj_in.user_id,
                        "chat_id": str(chat.id),
                        "chat_status": chat.chatStatus.value,
                        "status_changed": status_changed,
                        "session_active": chat.sessionActive,
                    },
                )

            return chat

        except IntegrityError as e:
            raise_error(
                DatabaseIntegrityError(
                    constraint="Integrity constraint violated while saving chat",
                    original_error=e,
                )
            )
        except SQLAlchemyError as e:
            raise_error(
                ChatCreationError(
                    f"Failed to save chat payload to database: {e}",
                    details={"organization": obj_in.client_name, "user_id": obj_in.user_id, "error": str(e)},
                )
            )


chat = CRUDChat(Chat)
