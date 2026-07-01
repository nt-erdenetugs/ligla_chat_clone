from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.crud_base import CRUDBase
from app.db.models import Chat, ChatTags, Tags
from app.services.chat_data_sync import schemas
from app.services.chat_data_sync.constants import ChatDataSyncType
from app.services.chat_data_sync.helper.schema_to_model import rows_to_schema_list
from app.services.chat_data_sync.schemas.payloads import (
    ChatDataSyncNotificationPayload,
    TagSettingsPayload,
    UserTagsPayload,
)
from app.services.chat_data_sync.schemas.tags import ChatTagsCreate, ChatTagsUpdate


class CRUDTags(CRUDBase[Tags, schemas.TagsCreate, schemas.TagsUpdate]):
    def get_all_tags(self, db: Session):
        stmt = select(
            Tags.id,
            Tags.name,
            Tags.isActive,
            Tags.createdAt,
            Tags.updatedAt,
        )
        return db.execute(stmt).all()

    def get_tag_settings(self, db: Session, notification: ChatDataSyncNotificationPayload) -> TagSettingsPayload:
        rows = self.get_all_tags(db)
        data = rows_to_schema_list(rows, schemas.TagSettingsResponse)

        return TagSettingsPayload(
            type=ChatDataSyncType.TAG_SETTINGS,
            organizationId=notification.organizationId,
            timestamp=notification.timestamp,
            data=data,
        )


class CRUDChatTags(CRUDBase[ChatTags, ChatTagsCreate, ChatTagsUpdate]):
    def get_chat_tags_from_end_user(self, db: Session, end_user_id: str):
        stmt = select(
            ChatTags.id,
            ChatTags.tagId,
            ChatTags.createdAt,
        ).join(Chat, Chat.id == ChatTags.chatId)

        stmt = stmt.where(Chat.endUserId == end_user_id)
        return db.execute(stmt).all()

    def get_user_tags(self, db: Session, notification: ChatDataSyncNotificationPayload) -> UserTagsPayload:
        if not notification.userId:
            return UserTagsPayload(
                type=ChatDataSyncType.USER_TAGS,
                organizationId=notification.organizationId,
                timestamp=notification.timestamp,
                userId="unknown",
                data=[],
            )

        rows = self.get_chat_tags_from_end_user(db, notification.userId)
        data = rows_to_schema_list(rows, schemas.UserTagsResponse)

        return UserTagsPayload(
            type=ChatDataSyncType.USER_TAGS,
            organizationId=notification.organizationId,
            timestamp=notification.timestamp,
            userId=notification.userId,
            data=data,
        )


tags = CRUDTags(Tags)
chat_tags = CRUDChatTags(ChatTags)
