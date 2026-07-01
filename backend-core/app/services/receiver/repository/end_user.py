from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.common.crud_base import CRUDBase
from app.common.utils import get_logger
from app.db.models import EndUser
from app.services.receiver import schemas

logger = get_logger(__name__)


class CRUDEndUser(CRUDBase[EndUser, schemas.EndUserCreate, schemas.EndUserUpdate]):

    def get_by_id(self, db: Session, id: str) -> EndUser | None:
        stmt = select(EndUser).where(EndUser.userId == id)
        result = db.execute(stmt)
        return result.scalar_one_or_none()

    def create_end_user(self, db: Session, user_id: str, profile: schemas.Profile) -> EndUser:
        logger.info(
            "Creating/updating end user via UPSERT pattern",
            extra={
                "user_id": user_id,
                "display_name": profile.display_name,
                "has_picture_url": bool(profile.picture_url),
            },
        )

        end_user_data = {
            "userId": user_id,
            "displayName": profile.display_name,
            "pictureUrl": profile.picture_url,
        }

        stmt = (
            insert(EndUser)
            .values(**end_user_data)
            .on_conflict_do_update(
                index_elements=["userId"],
                set_={
                    "displayName": profile.display_name,
                    "pictureUrl": profile.picture_url,
                    "updatedAt": func.now(),
                },
            )
            .returning(EndUser)
        )

        try:
            result = db.execute(stmt)
            end_user = result.scalar_one()

            logger.info(
                "End user UPSERT completed successfully",
                extra={
                    "user_id": user_id,
                    "display_name": end_user.displayName,
                    "operation": "upsert_success",
                },
            )
            return end_user
        except Exception as e:
            logger.error(
                "End user UPSERT failed",
                extra={
                    "user_id": user_id,
                    "error_type": type(e).__name__,
                    "error_details": str(e),
                    "operation": "upsert_failed",
                },
            )
            raise


end_user = CRUDEndUser(EndUser)
