from typing import Any
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy import delete, desc, func, insert, select, update
from sqlalchemy.orm import Session

from app.db.base_class import Base

DEFAULT_QUERY_LIMIT = 5000


class CRUDBase[ModelType: Base, CreateSchemaType: BaseModel, UpdateSchemaType: BaseModel]:
    def __init__(self, model: type[ModelType]) -> None:
        self.model: type[ModelType] = model

    def get(self, db: Session, id: UUID) -> ModelType | None:
        stmt = select(self.model).where(self.model.id == id)
        return db.execute(stmt).scalar_one_or_none()

    def get_multi(self, db: Session, skip: int = 0, limit: int = DEFAULT_QUERY_LIMIT) -> list[ModelType]:
        stmt = select(self.model).order_by(desc(self.model.createdAt)).offset(skip).limit(limit)
        return list(db.execute(stmt).scalars().all())

    def get_all_count(self, db: Session) -> int:
        stmt = select(func.count()).select_from(self.model)
        return db.execute(stmt).scalar_one()

    def create(self, db: Session, obj_in: CreateSchemaType) -> ModelType:
        obj_in_data = jsonable_encoder(obj_in, exclude_none=True)
        stmt = insert(self.model).values(**obj_in_data).returning(self.model)
        result = db.execute(stmt)
        return result.scalar_one()

    def update(
        self,
        db: Session,
        db_obj: ModelType,
        obj_in: UpdateSchemaType | dict[str, Any],
    ) -> ModelType:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

        stmt = update(self.model).where(self.model.id == db_obj.id).values(**update_data).returning(self.model)
        result = db.execute(stmt)
        return result.scalar_one()

    def remove(self, db: Session, id: UUID) -> ModelType | None:
        stmt = delete(self.model).where(self.model.id == id).returning(self.model)
        result = db.execute(stmt)
        return result.scalar_one_or_none()
