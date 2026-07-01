from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UserBase(BaseModel):
    id: UUID = Field(...)
    organizationId: UUID = Field(...)
    email: str = Field(...)
    firstName: str | None = Field(default=None)
    lastName: str | None = Field(default=None)
    pictureUrl: str | None = Field(default=None)
    status: str = Field(...)
    roleType: str = Field(...)
    archivedBy: str | None = Field(default=None)
    createdAt: str = Field(...)
    updatedAt: str | None = Field(default=None)
    mailSentAt: str | None = Field(default=None)


class UserCreate(UserBase):
    hashedPassword: str = Field(...)


class UserUpdate(UserBase):
    pass


class UserInDBBase(UserBase):
    id: UUID = Field(...)

    model_config = ConfigDict(from_attributes=True)


class UserInDB(UserInDBBase):
    hashedPassword: str = Field(...)


class User(UserInDBBase):
    pass
