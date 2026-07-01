import base64
from datetime import datetime
from typing import ClassVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_serializer

from app.db.models import AttributeType


class AttributeBase(BaseModel):
    name: str
    type: AttributeType
    isActive: bool
    createdAt: datetime
    updatedAt: datetime

    model_config: ClassVar[ConfigDict] = ConfigDict(json_encoders={datetime: lambda v: int(v.timestamp())})


class AttributeSettingsResponse(AttributeBase):
    id: UUID


class AttributeCreate(AttributeBase):
    chatId: UUID | None


class AttributeUpdate(AttributeBase):
    id: UUID
    chatId: UUID | None


class ChatAttributeValueBase(BaseModel):
    attributeId: UUID
    value: bytes
    createdAt: datetime
    updatedAt: datetime | None

    model_config: ClassVar[ConfigDict] = ConfigDict(json_encoders={datetime: lambda v: int(v.timestamp())})

    @field_serializer("value", when_used="json")
    def serialize_value(self, value: bytes) -> str:
        return base64.b64encode(value).decode("ascii")


class UserAttributeResponse(ChatAttributeValueBase):
    id: UUID


class ChatAttributeValueCreate(ChatAttributeValueBase):
    chatId: UUID
    userId: UUID


class ChatAttributeValueUpdate(ChatAttributeValueBase):
    id: UUID
    userId: UUID
