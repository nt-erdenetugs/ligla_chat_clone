from datetime import datetime
from typing import ClassVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.services.chat_data_sync.constants import ChatDataSyncType
from app.services.chat_data_sync.schemas.attribute import (
    AttributeSettingsResponse,
    UserAttributeResponse,
)
from app.services.chat_data_sync.schemas.tags import (
    TagSettingsResponse,
    UserTagsResponse,
)


class ChatDataSyncPayloadBase(BaseModel):
    type: ChatDataSyncType
    organizationId: UUID
    timestamp: datetime

    model_config: ClassVar[ConfigDict] = ConfigDict(json_encoders={datetime: lambda v: int(v.timestamp())})


class ChatDataSyncNotificationPayload(ChatDataSyncPayloadBase):
    userId: str | None = Field(default=None, exclude=True)


class ChatDataSyncPayload[T](ChatDataSyncPayloadBase):
    data: list[T]


class ChatDataSyncUserPayload[T](ChatDataSyncPayload[T]):
    userId: str


class AttributeSettingsPayload(ChatDataSyncPayload[AttributeSettingsResponse]):
    type: ChatDataSyncType = ChatDataSyncType.ATTRIBUTE_SETTINGS


class UserAttributesPayload(ChatDataSyncUserPayload[UserAttributeResponse]):
    type: ChatDataSyncType = ChatDataSyncType.USER_ATTRIBUTES


class TagSettingsPayload(ChatDataSyncPayload[TagSettingsResponse]):
    type: ChatDataSyncType = ChatDataSyncType.TAG_SETTINGS


class UserTagsPayload(ChatDataSyncUserPayload[UserTagsResponse]):
    type: ChatDataSyncType = ChatDataSyncType.USER_TAGS


# Union of all possible payloads
AnyChatDataSyncNotification = AttributeSettingsPayload | UserAttributesPayload | TagSettingsPayload | UserTagsPayload
