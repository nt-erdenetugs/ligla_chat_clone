import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.common.crud_base import CRUDBase
from app.db.models import Auth, Team, User, UserStatus, UserTeam
from app.services.receiver import schemas


class CRUDOperator(CRUDBase[User, schemas.UserCreate, schemas.UserUpdate]):
    def get_one(self, db: Session, id: uuid.UUID):
        stmt = select(User).options(selectinload(User.auth)).where(User.id == id)
        result = db.execute(stmt)
        return result.scalar_one_or_none()

    def get_teams(self, db: Session, id: uuid.UUID) -> list[Team]:
        stmt = (
            select(Team)
            .select_from(UserTeam)
            .join(Team, Team.id == UserTeam.teamId)
            .where(
                UserTeam.userId == id,
                Team.isActive.is_(True),
            )
        )
        result = db.execute(stmt)
        return list(result.scalars().all())

    def is_active(self, db: Session, operator_id: uuid.UUID) -> bool:
        stmt = select(Auth.status).where(Auth.id == operator_id)
        auth = db.execute(stmt).one_or_none()
        return auth is not None and auth.status == UserStatus.ACTIVE


operator = CRUDOperator(User)
