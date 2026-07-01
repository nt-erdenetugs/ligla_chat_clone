import uuid

from crud.base import CRUDDataSync
from schemas.store import Store
from sqlalchemy import MetaData, Table, text
from sqlalchemy.orm import Session
from sqlalchemy.sql.expression import bindparam, insert, select, update
from sqlalchemy.sql.functions import func


class CRUDStore(CRUDDataSync):
    _table_cache: dict[str, Table] = {}

    def _get_store_table(self, db: Session) -> Table:
        schema_name = db.execute(text("SELECT current_schema()")).scalar() or "public"
        cache_key = f"{schema_name}.store"
        cached = self._table_cache.get(cache_key)
        if cached is not None:
            return cached

        table = Table(
            "store",
            MetaData(),
            autoload_with=db.get_bind(),
            schema=schema_name,
        )
        self._table_cache[cache_key] = table
        return table

    def get_stores_status(self, db: Session, store_ids: set[int]):
        store_table = self._get_store_table(db)

        query = select(store_table.c.liglaStoreId, store_table.c.isActive).where(
            store_table.c.liglaStoreId.in_(store_ids),
        )
        result = db.execute(query).mappings().fetchall()

        return {row["liglaStoreId"]: row["isActive"] for row in result}

    def get_stores_by_organization(self, db: Session) -> list[Store]:
        store_table = self._get_store_table(db)
        query = select(store_table)
        result = db.execute(query).mappings().fetchall()

        if result:
            return [Store(**row) for row in result]
        return []

    def create_store(self, db: Session, store_data: Store) -> None:
        store_table = self._get_store_table(db)
        _ = db.execute(
            insert(store_table).values(
                id=uuid.uuid4(),
                liglaStoreId=store_data["liglaStoreId"],
                name=store_data["name"],
                areaName=store_data["areaName"],
                typeName=store_data["typeName"],
                note=store_data["note"],
                startsAt=store_data["startsAt"],
                endsAt=store_data["endsAt"],
                isActive=True,
                createdAt=func.now(),
            )
        )

    def update_stores(self, db: Session, store_datas: list[Store]) -> None:
        store_table = self._get_store_table(db)

        if not store_datas:
            return

        update_stmt = (
            update(store_table)
            .where(
                store_table.c.liglaStoreId == bindparam("store_id"),
            )
            .values(
                name=bindparam("name"),
                typeName=bindparam("typeName"),
                areaName=bindparam("areaName"),
                note=bindparam("note"),
                startsAt=bindparam("startsAt"),
                endsAt=bindparam("endsAt"),
                isActive=True,
                updatedAt=func.now(),
            )
        )

        params = [
            {
                "store_id": store["liglaStoreId"],
                "name": store["name"],
                "typeName": store["typeName"],
                "areaName": store["areaName"],
                "note": store["note"],
                "startsAt": store["startsAt"],
                "endsAt": store["endsAt"],
            }
            for store in store_datas
        ]

        _ = db.execute(update_stmt, params)

    def soft_delete_stores(self, db: Session, store_ids: set[int]):
        store_table = self._get_store_table(db)
        _ = db.execute(
            update(store_table)
            .where(
                store_table.c.liglaStoreId.in_(store_ids),
            )
            .values(isActive=False, deletedAt=func.now())
        )

    def get_all_stores_by_organization(self, db: Session):
        store_table = self._get_store_table(db)
        query = select(
            store_table.c.liglaStoreId,
            store_table.c.name,
            store_table.c.isActive,
        )
        return db.execute(query).mappings().fetchall()

    def reactivate_store(self, db: Session, store_data: dict):
        store_table = self._get_store_table(db)
        _ = db.execute(
            update(store_table)
            .where(
                store_table.c.liglaStoreId == store_data["liglaStoreId"],
            )
            .values(
                name=store_data["name"],
                type_name=store_data["type_name"],
                area_name=store_data["area_name"],
                note=store_data["note"],
                starts_at=store_data["starts_at"],
                ends_at=store_data["ends_at"],
                isActive=True,
                deletedAt=None,
                updatedAt=func.now(),
            )
        )


crud_store = CRUDStore()
