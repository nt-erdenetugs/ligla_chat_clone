from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class OrganizationBase(BaseModel):
    name: str = Field(...)
    displayName: str = Field(...)
    description: str | None = Field(default=None)
    isActive: bool = Field(default=True)
    archivedBy: str | None = Field(default=None)


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationUpdate(OrganizationBase):
    pass


class OrganizationInDBBase(OrganizationBase):

    model_config = ConfigDict(from_attributes=True)


class OrganizationInDB(OrganizationInDBBase):
    pass


class Organization(OrganizationInDBBase):
    storage_deletion: dict[str, Any] | None = Field(default=None)
    database_deletion: dict[str, Any] | None = Field(default=None)
