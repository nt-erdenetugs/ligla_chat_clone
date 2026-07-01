from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SurveyDataBase(BaseModel):
    category1: str | None = Field(None, alias="category_1")
    category2: str | None = Field(None, alias="category_2")
    category3: str | None = Field(None, alias="category_3")
    category4: str | None = Field(None, alias="category_4")
    category5: str | None = Field(None, alias="category_5")
    category6: str | None = Field(None, alias="category_6")
    category7: str | None = Field(None, alias="category_7")
    category8: str | None = Field(None, alias="category_8")
    category9: str | None = Field(None, alias="category_9")
    category10: str | None = Field(None, alias="category_10")
    category11: str | None = Field(None, alias="category_11")
    category12: str | None = Field(None, alias="category_12")
    category13: str | None = Field(None, alias="category_13")
    category14: str | None = Field(None, alias="category_14")
    category15: str | None = Field(None, alias="category_15")
    category16: str | None = Field(None, alias="category_16")
    category17: str | None = Field(None, alias="category_17")
    category18: str | None = Field(None, alias="category_18")
    category19: str | None = Field(None, alias="category_19")
    category20: str | None = Field(None, alias="category_20")
    category21: str | None = Field(None, alias="category_21")
    category22: str | None = Field(None, alias="category_22")
    category23: str | None = Field(None, alias="category_23")
    category24: str | None = Field(None, alias="category_24")
    category25: str | None = Field(None, alias="category_25")

    number1: int | None = Field(None, alias="number_1")
    number2: int | None = Field(None, alias="number_2")
    number3: int | None = Field(None, alias="number_3")
    number4: int | None = Field(None, alias="number_4")
    number5: int | None = Field(None, alias="number_5")
    number6: int | None = Field(None, alias="number_6")
    number7: int | None = Field(None, alias="number_7")
    number8: int | None = Field(None, alias="number_8")
    number9: int | None = Field(None, alias="number_9")
    number10: int | None = Field(None, alias="number_10")
    number11: int | None = Field(None, alias="number_11")
    number12: int | None = Field(None, alias="number_12")
    number13: int | None = Field(None, alias="number_13")
    number14: int | None = Field(None, alias="number_14")
    number15: int | None = Field(None, alias="number_15")

    datetime1: str | None = Field(None, alias="datetime_1")
    datetime2: str | None = Field(None, alias="datetime_2")
    datetime3: str | None = Field(None, alias="datetime_3")
    datetime4: str | None = Field(None, alias="datetime_4")
    datetime5: str | None = Field(None, alias="datetime_5")
    datetime6: str | None = Field(None, alias="datetime_6")
    datetime7: str | None = Field(None, alias="datetime_7")
    datetime8: str | None = Field(None, alias="datetime_8")
    datetime9: str | None = Field(None, alias="datetime_9")
    datetime10: str | None = Field(None, alias="datetime_10")
    datetime11: str | None = Field(None, alias="datetime_11")
    datetime12: str | None = Field(None, alias="datetime_12")
    datetime13: str | None = Field(None, alias="datetime_13")
    datetime14: str | None = Field(None, alias="datetime_14")
    datetime15: str | None = Field(None, alias="datetime_15")

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def handle_validation_errors(cls, data: Any) -> dict[str, Any]:
        if not isinstance(data, dict):
            return {}

        result: dict[str, Any] = {}

        # Handle category fields - coerce to string or None
        for i in range(1, 26):
            key = f"category_{i}"
            value = data.get(key)
            if value is None:
                result[key] = None
            elif isinstance(value, str | int | bool | float):
                result[key] = str(value)
            else:
                result[key] = None

        # Handle number fields - coerce to int or None
        for i in range(1, 26):
            key = f"number_{i}"
            value = data.get(key)
            if value is None:
                result[key] = None
            elif isinstance(value, int):
                result[key] = value
            elif isinstance(value, str):
                try:
                    result[key] = int(value)
                except ValueError:
                    result[key] = None
            else:
                result[key] = None

        # Handle datetime fields - coerce to string or None
        for i in range(1, 26):
            key = f"datetime_{i}"
            value = data.get(key)
            if value is None:
                result[key] = None
            elif isinstance(value, str | int | bool | float):
                result[key] = str(value)
            else:
                result[key] = None

        return result


class SurveyDataCreate(BaseModel):
    endUserId: str = Field(...)
    clientUserId: str | None = Field(default=None)
    userSurvey: SurveyDataBase = Field(...)
    updatedAt: datetime | None = Field(default=None)
