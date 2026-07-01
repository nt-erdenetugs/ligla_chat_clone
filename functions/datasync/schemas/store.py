from datetime import datetime
from pydantic import BaseModel, field_validator, ConfigDict, Field

from schemas.csv_data import CSVData


class Store(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    liglaStoreId: int = Field(..., alias="ligla_store_id")
    name: str = Field(..., alias="name")
    areaName: str | None = Field(default=None, alias="area_name")
    typeName: str | None = Field(default=None, alias="type_name")
    note: str | None = Field(default=None, alias="note")
    startsAt: datetime | None = Field(default=None, alias="starts_at")
    endsAt: datetime | None = Field(default=None, alias="ends_at")

    @classmethod
    def get_comparison_fields(cls) -> list[str]:
        return [field for field in cls.__annotations__]


class StoreCSVData(CSVData):
    model_config = ConfigDict(populate_by_name=True)
    id: int
    name: str
    areaName: str | None = Field(default=None, alias="area_name")
    typeName: str | None = Field(default=None, alias="type_name")
    note: str | None = None
    startsAt: datetime | None = Field(default=None, alias="starts_at")
    endsAt: datetime | None = Field(default=None, alias="ends_at")

    @field_validator("startsAt", "endsAt", mode="before")
    def parse_datetime(cls, value: str | None) -> datetime | None:
        """Convert ISO string to datetime, or return None if empty."""
        if value is None or value == "":
            return None
        if isinstance(value, datetime):
            return value
        try:
            return datetime.fromisoformat(value)
        except (TypeError, ValueError):
            raise ValueError(f"Invalid datetime format: {value}")
