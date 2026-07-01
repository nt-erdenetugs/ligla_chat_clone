from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TeamBase(BaseModel):
    name: str = Field(...)
    isActive: bool = Field(default=True)
    archivedBy: str | None = Field(default=None)


class TeamCreate(TeamBase):
    organizationId: UUID = Field(...)


class TeamUpdate(TeamBase):
    pass


class TeamInDBBase(TeamBase):
    id: UUID = Field(...)
    organizationId: UUID = Field(...)

    model_config = ConfigDict(from_attributes=True)


class TeamInDB(TeamInDBBase):
    pass


class Team(TeamInDBBase):
    pass
