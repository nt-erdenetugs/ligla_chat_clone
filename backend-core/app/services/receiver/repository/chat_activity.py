from sqlalchemy import insert
from sqlalchemy.orm import Session

from app.common.crud_base import CRUDBase
from app.common.utils import get_logger
from app.db.models import ChatActivity
from app.services.receiver import repository, schemas

logger = get_logger(__name__)


class CRUDChatActivity(CRUDBase[ChatActivity, schemas.ChatActivityCreate, schemas.ChatActivityUpdate]):
    def save_activity_to_db(self, db: Session, obj_in: schemas.ChatActivityCreate) -> ChatActivity:
        logger.info(
            "Saving chat activity to database",
            extra={
                "chat_id": str(obj_in.chatId),
                "activity_type": obj_in.activityType.value,
                "actor_type": obj_in.actorType.value,
                "old_user_id": str(obj_in.oldUserId) if obj_in.oldUserId else None,
                "new_user_id": str(obj_in.newUserId) if obj_in.newUserId else None,
            },
        )

        activity_data = obj_in.model_dump(exclude_none=True)

        stmt = insert(ChatActivity).values(**activity_data).returning(ChatActivity)
        result = db.execute(stmt)
        chat_activity = result.scalar_one()

        repository.chat.update_latest_message_timestamp(db, chat_activity)

        logger.info(
            "Chat activity saved successfully",
            extra={
                "chat_id": str(obj_in.chatId),
                "activity_id": str(chat_activity.id),
                "activity_type": obj_in.activityType.value,
                "created_at": str(chat_activity.createdAt),
            },
        )

        return chat_activity


chat_activity = CRUDChatActivity(ChatActivity)
