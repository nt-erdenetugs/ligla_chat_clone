import logging
from typing import Any
from uuid import UUID

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import ChatReplyMessageTemplate, OrganizationSettings
from app.services.auto_reply.schemas import ChatReplySettings

logger = logging.getLogger(__name__)


class AutoReplyRepository:
    def __init__(self, db: Session):
        self.db: Session = db

    def get_organization_settings(self) -> ChatReplySettings | None:
        from app.db.tenant_context import get_tenant_context

        context = get_tenant_context()
        organization_name = context.organization_name if context else "unknown"

        try:
            stmt = select(OrganizationSettings.chatReplySettings).where(
                OrganizationSettings.type == "chatReply",
            )

            result = self.db.execute(stmt).scalar_one_or_none()
            if not result:
                return None

            return ChatReplySettings.model_validate(result)
        except ValidationError as e:
            logger.error(
                "Invalid chat reply settings for %s: %s",
                organization_name,
                e,
            )
            return None
        except Exception as e:
            logger.error(f"Error getting organization settings for {organization_name}: {e}")
            return None

    def get_user_settings(self, user_id: UUID) -> dict[str, Any] | None:
        logger.warning(f"get_user_settings called for user {user_id} but user-level settings are no longer supported")
        return None

    def get_message_template(self, template_id: UUID) -> ChatReplyMessageTemplate | None:
        try:
            stmt = select(ChatReplyMessageTemplate).where(ChatReplyMessageTemplate.id == template_id)
            return self.db.execute(stmt).scalar_one_or_none()
        except Exception as e:
            logger.error(f"Unexpected Error getting message template {template_id}: {e}")
            return None
