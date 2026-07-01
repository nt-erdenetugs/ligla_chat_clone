from pydantic import BaseModel, ConfigDict, Field


class EndUserBase(BaseModel):
    userId: str = Field(...)
    displayName: str = Field(...)
    pictureUrl: str | None = Field(default=None)


class EndUserCreate(EndUserBase):
    pass


class EndUserUpdate(EndUserBase):
    pass


class EndUserInDBBase(EndUserBase):
    userId: str = Field(...)

    model_config = ConfigDict(from_attributes=True)


class EndUser(EndUserInDBBase):
    pass
