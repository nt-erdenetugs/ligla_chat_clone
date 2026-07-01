from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.crud_base import CRUDBase
from app.db.models import Attribute, Chat, ChatAttributeValue
from app.services.chat_data_sync.constants import ChatDataSyncType
from app.services.chat_data_sync.helper.schema_to_model import rows_to_schema_list
from app.services.chat_data_sync.schemas import attribute as schema
from app.services.chat_data_sync.schemas.payloads import (
    AttributeSettingsPayload,
    ChatDataSyncNotificationPayload,
    UserAttributesPayload,
)


class CRUDAttribute(CRUDBase[Attribute, schema.AttributeCreate, schema.AttributeUpdate]):
    def get_all_attributes(self, db: Session):
        stmt = select(
            Attribute.id,
            Attribute.name,
            Attribute.type,
            Attribute.isActive,
            Attribute.createdAt,
            Attribute.updatedAt,
        )
        return db.execute(stmt).all()

    def get_attribute_settings(
        self, db: Session, notification: ChatDataSyncNotificationPayload
    ) -> AttributeSettingsPayload:
        rows = self.get_all_attributes(db)
        data = rows_to_schema_list(rows, schema.AttributeSettingsResponse)

        return AttributeSettingsPayload(
            type=ChatDataSyncType.ATTRIBUTE_SETTINGS,
            organizationId=notification.organizationId,
            timestamp=notification.timestamp,
            data=data,
        )


class CRUDChatAttributeValue(
    CRUDBase[
        ChatAttributeValue,
        schema.ChatAttributeValueCreate,
        schema.ChatAttributeValueUpdate,
    ]
):
    def get_chat_attribute_values_from_end_user(self, db: Session, end_user_id: str):
        stmt = select(
            ChatAttributeValue.id,
            ChatAttributeValue.attributeId,
            ChatAttributeValue.value,
            ChatAttributeValue.createdAt,
            ChatAttributeValue.updatedAt,
        ).join(Chat, Chat.id == ChatAttributeValue.chatId)

        stmt = stmt.where(Chat.endUserId == end_user_id)
        return db.execute(stmt).all()

    def get_user_attributes(self, db: Session, notification: ChatDataSyncNotificationPayload) -> UserAttributesPayload:
        if not notification.userId:
            return UserAttributesPayload(
                type=ChatDataSyncType.USER_ATTRIBUTES,
                organizationId=notification.organizationId,
                timestamp=notification.timestamp,
                userId="unknown",
                data=[],
            )

        rows = self.get_chat_attribute_values_from_end_user(db, notification.userId)
        data = rows_to_schema_list(rows, schema.UserAttributeResponse)

        return UserAttributesPayload(
            type=ChatDataSyncType.USER_ATTRIBUTES,
            organizationId=notification.organizationId,
            timestamp=notification.timestamp,
            userId=notification.userId,
            data=data,
        )


attribute = CRUDAttribute(Attribute)
chat_attribute_value = CRUDChatAttributeValue(ChatAttributeValue)
