from enum import Enum
from sqlalchemy import MetaData, Table, func, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.sql import select
from sqlalchemy.orm import Session
from crud.base import CRUDDataSync

COLUMN_CONFIG = {
    "category": 25,
    "number": 15,
    "datetime": 15,
}


class ColumnSettingType(str, Enum):
    SURVEY = "survey"
    MEMBER_FEED = "memberFeed"


class CRUDColumnAliasSetting(CRUDDataSync):
    _table_cache: dict[str, Table] = {}

    def _get_settings_table(self, db: Session) -> Table:
        schema_name = db.execute(text("SELECT current_schema()")).scalar() or "public"
        cache_key = f"{schema_name}.organizationSettings"
        cached = self._table_cache.get(cache_key)
        if cached is not None:
            return cached

        table = Table(
            "organizationSettings",
            MetaData(),
            autoload_with=db.get_bind(),
            schema=schema_name,
        )
        self._table_cache[cache_key] = table
        return table

    def upsert_data(
        self,
        db: Session,
        upsert_data: list[dict[str, str | None]],
        setting_type: ColumnSettingType,
    ) -> None:
        table = self._get_settings_table(db)

        stmt = select(table.c.memberFeedSurveyColumnSettings).where(
            table.c.type == setting_type.value
        )
        existing_result = db.execute(stmt).scalar_one_or_none()

        settings = dict(existing_result) if existing_result else {}
        input_row = upsert_data[0] if upsert_data else {}

        for prefix, max_count in COLUMN_CONFIG.items():
            for i in range(1, max_count + 1):
                col_name = f"{prefix}{i}"
                new_alias = input_row.get(col_name)
                default_snake_alias = f"{prefix}_{i}"

                if col_name not in settings:
                    settings[col_name] = {"isEnabled": False}

                if col_name not in input_row:
                    continue

                if new_alias is None:
                    settings[col_name].pop("alias", None)
                    continue

                if new_alias == col_name or new_alias == default_snake_alias:
                    settings[col_name].pop("alias", None)
                    continue

                settings[col_name]["alias"] = new_alias

        insert_data = {
            "type": setting_type.value,
            "memberFeedSurveyColumnSettings": settings,
            "syncedAt": func.now(),
        }

        upsert_stmt = insert(table).values(insert_data)
        upsert_stmt = upsert_stmt.on_conflict_do_update(
            index_elements=["type"],
            set_={
                "memberFeedSurveyColumnSettings": settings,
                "syncedAt": insert_data["syncedAt"],
            },
        )

        db.execute(upsert_stmt)


crud_column_alias_setting = CRUDColumnAliasSetting()
