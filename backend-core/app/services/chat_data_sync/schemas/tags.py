from datetime import datetime
from typing import ClassVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TagsBase(BaseModel):
    name: str
    isActive: bool
    createdAt: datetime
    updatedAt: datetime | None

    model_config: ClassVar[ConfigDict] = ConfigDict(json_encoders={datetime: lambda v: int(v.timestamp())})


class TagSettingsResponse(TagsBase):
    id: UUID


class TagsCreate(TagsBase):
    pass


class TagsUpdate(TagsCreate):
    id: UUID
    archivedBy: UUID


class ChatTagsBase(BaseModel):
    tagId: UUID
    createdAt: datetime

    model_config: ClassVar[ConfigDict] = ConfigDict(json_encoders={datetime: lambda v: int(v.timestamp())})


class UserTagsResponse(ChatTagsBase):
    id: UUID


class ChatTagsCreate(ChatTagsBase):
    chatId: UUID


class ChatTagsUpdate(ChatTagsCreate):
    id: UUID
