from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StoreBase(BaseModel):
    liglaStoreId: int | None = Field(default=None)
    name: str = Field(...)
    areaName: str | None = Field(default=None)
    typeName: str | None = Field(default=None)
    isActive: bool = Field(default=True)
    startsAt: datetime | None = Field(default=None)
    endsAt: datetime | None = Field(default=None)

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    @field_validator("startsAt", "endsAt", mode="before")
    @classmethod
    def parse_datetime(cls, value: Any):
        if value is None or value == "":
            return None

        if isinstance(value, datetime):
            return value

        if isinstance(value, str):
            try:
                # Handle ISO format with/without timezone
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                try:
                    # Fallback to common formats
                    return datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    raise ValueError(f"Invalid datetime format: {value}")

        raise ValueError(f"Unsupported datetime type: {type(value)}")


class StoreCreate(StoreBase):
    pass


class StoreBatchCreate(BaseModel):
    liglaStoreId: int = Field(...)
    name: str = Field(...)


class StoreUpdate(StoreBase):
    id: UUID = Field(...)


class StoreInDBBase(StoreBase):
    id: UUID = Field(...)

    model_config = ConfigDict(from_attributes=True)


class StoreInDB(StoreInDBBase):
    pass


class Store(StoreInDBBase):
    pass
