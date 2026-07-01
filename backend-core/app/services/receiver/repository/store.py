from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from app.common.crud_base import CRUDBase
from app.common.utils import get_logger
from app.db.models import Store, StoreTeam, Team
from app.services.receiver import schemas

logger = get_logger(__name__)


class CRUDStore(CRUDBase[Store, schemas.StoreCreate, schemas.StoreUpdate]):
    def get_by_ligla_store_id(self, db: Session, store_id: int) -> Store | None:
        stmt = select(Store).where(Store.liglaStoreId == store_id)
        result = db.execute(stmt)
        return result.scalar_one_or_none()

    def validate_store_ids(self, db: Session, store_ids: list[int]) -> list[int]:
        stmt = select(Store.liglaStoreId).where(
            Store.liglaStoreId.in_(store_ids),
            Store.isActive.is_(True),
        )
        result = db.execute(stmt)
        valid_store_ids = result.all()
        return [store_id[0] for store_id in valid_store_ids]

    def create_store(self, db: Session, *, obj_in: schemas.StoreCreate) -> Store | None:
        store_id = obj_in.liglaStoreId
        if store_id is None:
            logger.warning("No store id was passed")
            return None
        existing_store = self.get_by_ligla_store_id(db, store_id)
        if existing_store:
            logger.warning(f"Store {obj_in.liglaStoreId} already exists. Skipping.")
            return None

        create_data = obj_in.model_dump(exclude_none=True)
        stmt = insert(Store).values(**create_data).returning(Store)
        result = db.execute(stmt)
        return result.scalar_one()


class CRUDStoreTeam(CRUDBase[StoreTeam, schemas.StoreTeamCreate, schemas.StoreTeamUpdate]):
    def get_by_team_and_store(self, db: Session, team_id: int, store_id: int) -> StoreTeam | None:
        stmt = (
            select(StoreTeam)
            .join(Store, Store.id == StoreTeam.storeId)
            .join(Team, Team.id == StoreTeam.teamId)
            .where(
                Team.id == team_id,
                Store.liglaStoreId == store_id,
            )
        )
        result = db.execute(stmt)
        return result.scalar_one_or_none()


store = CRUDStore(Store)
store_team = CRUDStoreTeam(StoreTeam)
