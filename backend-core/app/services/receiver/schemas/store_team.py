from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StoreTeamBase(BaseModel):
    storeId: UUID = Field(...)
    teamId: UUID = Field(...)


class StoreTeamCreate(StoreTeamBase):
    pass


class StoreTeamUpdate(StoreTeamBase):
    pass


class StoreTeamInDBBase(StoreTeamBase):
    id: UUID = Field(...)

    model_config = ConfigDict(from_attributes=True)


class StoreTeamInDB(StoreTeamInDBBase):
    pass


class StoreTeam(StoreTeamInDBBase):
    pass
