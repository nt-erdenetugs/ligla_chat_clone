import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.crud_base import CRUDBase
from app.common.utils import get_logger
from app.db.models import Store, StoreTeam, Team
from app.services.receiver import schemas

logger = get_logger(__name__)


class CRUDTeam(CRUDBase[Team, schemas.TeamCreate, schemas.TeamUpdate]):
    def get_by_id(self, db: Session, id: uuid.UUID) -> Team | None:
        stmt = select(Team).where(Team.id == id)
        result = db.execute(stmt)
        return result.scalar_one_or_none()

    def get_by_name(self, db: Session, name: str) -> Team | None:
        stmt = select(Team).where(Team.name == name)
        result = db.execute(stmt)
        return result.scalar_one_or_none()

    def get_default_team(self, db: Session) -> Team | None:
        stmt = select(Team).where(
            Team.isActive.is_(True),
            Team.isDefault.is_(True),
        )
        result = db.execute(stmt)
        return result.scalar_one_or_none()

    def get_teams_by_store_id(self, db: Session, store_id: int) -> list[Team]:
        stmt = (
            select(Team)
            .join(StoreTeam, StoreTeam.teamId == Team.id)
            .join(Store, Store.id == StoreTeam.storeId)
            .where(
                Store.liglaStoreId == store_id,
                Team.isActive.is_(True),
            )
        )
        result = db.execute(stmt)
        return list(result.scalars().all())

    def get_teams_by_store_ids(self, db: Session, store_ids: list[int]) -> list[Team]:
        if not store_ids:
            return []

        stmt = (
            select(Team)
            .join(StoreTeam, StoreTeam.teamId == Team.id)
            .join(Store, Store.id == StoreTeam.storeId)
            .where(
                Store.liglaStoreId.in_(store_ids),
                Team.isActive.is_(True),
            )
            .distinct()
        )
        result = db.execute(stmt)
        return list(result.scalars().all())


team = CRUDTeam(Team)
