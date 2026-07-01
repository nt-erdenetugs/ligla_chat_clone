import json
import logging
import uuid
from datetime import datetime
from typing import Any
from uuid import UUID

import pytz
from sqlalchemy.orm import Session

from app.common.errors import AutoReplyError, raise_error
from app.db.models import Chat, ChatMessage, ChatReplyMessageTemplate, ChatReplyTimeRangeType, ContentType, SenderType
from app.db.tenant_context import get_tenant_context
from app.services.auto_reply.holiday_calculator import JapaneseHolidayCalculator
from app.services.auto_reply.repository import AutoReplyRepository
from app.services.auto_reply.schemas import ChatReplySchedule, ChatReplyScheduleType, ChatReplySettings
from app.services.auto_reply.text_processor import TextProcessor
from app.services.encryption import EncryptionService
from app.services.receiver import repository, schemas
from app.services.receiver.constants import AUTO_REPLY_TIMEZONE

logger = logging.getLogger(__name__)
JAPAN_TZ = pytz.timezone(AUTO_REPLY_TIMEZONE)

schedule_priority_order = {
    ChatReplyScheduleType.CUSTOM_DATE: 0,
    ChatReplyScheduleType.HOLIDAYS: 1,
    ChatReplyScheduleType.MONDAY: 2,
    ChatReplyScheduleType.TUESDAY: 2,
    ChatReplyScheduleType.WEDNESDAY: 2,
    ChatReplyScheduleType.THURSDAY: 2,
    ChatReplyScheduleType.FRIDAY: 2,
    ChatReplyScheduleType.SATURDAY: 2,
    ChatReplyScheduleType.SUNDAY: 2,
}

weekday_map = {
    0: ChatReplyScheduleType.MONDAY,
    1: ChatReplyScheduleType.TUESDAY,
    2: ChatReplyScheduleType.WEDNESDAY,
    3: ChatReplyScheduleType.THURSDAY,
    4: ChatReplyScheduleType.FRIDAY,
    5: ChatReplyScheduleType.SATURDAY,
    6: ChatReplyScheduleType.SUNDAY,
}


class AutoReplyService:
    def __init__(
        self, db: Session, encryption_service: EncryptionService, organization_id: str, organization_name: str
    ):
        self.db = db
        self.encryption_service = encryption_service
        self.organization_id = organization_id
        self.organization_name = organization_name
        self.repository: AutoReplyRepository = AutoReplyRepository(db)
        self.text_processor: TextProcessor = TextProcessor()
        self.holiday_calculator: JapaneseHolidayCalculator = JapaneseHolidayCalculator()

    def should_send_auto_reply(self, chat: Chat, assigned_user_id: UUID | None = None) -> bool:
        settings = self._get_settings(assigned_user_id)
        if not settings or not settings.isActive:
            return False

        return self._is_within_schedule(settings)

    def generate_auto_reply_message(self, chat: Chat, assigned_user_id: UUID | None = None) -> dict[str, Any] | None:
        settings = self._get_settings(assigned_user_id)
        if not settings:
            return None

        time_range_type = self._get_time_range_type(settings)
        template = self._get_template(settings, time_range_type)
        if not template:
            return None

        content = self.text_processor.process_message_content(template.content)
        if not content:
            return None

        return {
            "type": template.type,
            "content": content,
            "contentUrl": template.contentUrl,
            "previewImageUrl": template.previewImageUrl,
        }

    def should_close_chat(self, chat: Chat, assigned_user_id: UUID | None = None) -> bool | None:
        settings = self._get_settings(assigned_user_id)
        if not settings:
            return None
        time_range_type = self._get_time_range_type(settings)
        return time_range_type != ChatReplyTimeRangeType.ACTIVE_TIME

    def _get_settings(self, user_id: UUID | None = None) -> ChatReplySettings | None:
        # User-level settings are no longer supported
        if user_id:
            logger.debug(f"User-level settings requested for user {user_id} but are no longer supported")

        return self.repository.get_organization_settings()

    def _is_within_schedule(self, settings: ChatReplySettings) -> bool:
        """
        Check if a schedule is configured for today.
        Returns True if a schedule exists for the current day (auto-reply will be sent).
        The actual message (ACTIVE_TIME vs DEFAULT) is determined by _get_time_range_type.
        """
        current_time = datetime.now(JAPAN_TZ)
        schedules = settings.schedules

        if not schedules:
            return True

        for schedule in schedules:
            if self._is_schedule_active_today(schedule, current_time):
                return True

        return False

    def _get_time_range_type(self, settings: ChatReplySettings) -> ChatReplyTimeRangeType:
        current_time = datetime.now(JAPAN_TZ)
        current_time_str = current_time.strftime("%H:%M")

        schedules = settings.schedules
        schedules_sorted = sorted(
            schedules,
            key=lambda s: schedule_priority_order.get(s.scheduleType, 99),
        )

        for schedule in schedules_sorted:
            if self._is_schedule_active_today(schedule, current_time):
                time_ranges = schedule.timeRanges

                for time_range in time_ranges:
                    if self._is_time_in_range(
                        current_time_str,
                        time_range.startTime,
                        time_range.endTime,
                    ):
                        return time_range.timeRangeType

                return ChatReplyTimeRangeType.DEFAULT

        return ChatReplyTimeRangeType.DEFAULT

    def _is_schedule_active_today(self, schedule: ChatReplySchedule, current_time: datetime) -> bool:
        current_date = current_time.date()
        current_weekday = current_time.weekday()

        schedule_type = schedule.scheduleType

        if schedule_type == weekday_map.get(current_weekday):
            return True

        if schedule_type == ChatReplyScheduleType.HOLIDAYS and self.holiday_calculator.is_holiday(current_date):
            return True

        if schedule_type == ChatReplyScheduleType.CUSTOM_DATE:
            custom_dates = schedule.customDates
            for date_str in custom_dates:
                try:
                    # Parse ISO timestamp string
                    custom_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                    if custom_date.astimezone(JAPAN_TZ).date() == current_date:
                        return True
                except (ValueError, AttributeError) as e:
                    logger.warning(f"Invalid custom date format: {date_str}, error: {e}")
                    continue

        return False

    def _is_time_in_range(self, current_time_str: str, start_time: str, end_time: str) -> bool:
        try:
            current = datetime.strptime(current_time_str, "%H:%M").time()
            start = datetime.strptime(start_time, "%H:%M").time()
            end = datetime.strptime(end_time, "%H:%M").time()

            if start > end:
                return current >= start or current <= end
            else:
                return start <= current <= end
        except Exception:
            return False

    def _get_template(
        self,
        settings: ChatReplySettings,
        time_range_type: ChatReplyTimeRangeType,
    ) -> ChatReplyMessageTemplate | None:
        messages = settings.messages

        # Find message with matching time_range_type
        message = next((m for m in messages if m.timeRangeType == time_range_type), None)

        if not message:
            return None

        # Get template ID and fetch template
        template_id_str = message.templateId
        if not template_id_str:
            return None

        try:
            template_id = UUID(template_id_str)
            return self.repository.get_message_template(template_id)
        except (ValueError, AttributeError) as e:
            logger.error(f"Invalid template ID format: {template_id_str}, error: {e}")
            return None

    def _get_system_sender_id(self) -> str:
        context = get_tenant_context()
        if not context or not context.organization_name:
            raise ValueError("Organization name not available in tenant context")
        org_namespace = uuid.UUID("6ba7b813-9dad-11d1-80b4-00c04fd430c8")
        org_uuid = uuid.uuid5(org_namespace, context.organization_name)
        return f"S{org_uuid.hex}"

    def _extract_text_from_message_data(self, auto_reply_data: dict[str, Any] | None, chat: Chat) -> str | None:
        if not auto_reply_data:
            logger.warning(
                "Auto-reply generation returned no data",
                extra={
                    "chat_id": str(chat.id),
                    "assigned_user_id": str(chat.assignedUserId) if chat.assignedUserId else None,
                },
            )
            return None

        text_content = auto_reply_data.get("content", {}).get("text", "")
        if not text_content:
            logger.error(
                "Auto-reply data missing text content",
                extra={
                    "chat_id": str(chat.id),
                    "has_content_key": "content" in auto_reply_data,
                    "content_keys": list(auto_reply_data.get("content", {}).keys()),
                },
            )
            return None

        return text_content

    def create_message(self, chat: Chat, text: str) -> ChatMessage | None:
        sender_id = self._get_system_sender_id()
        message_id = str(uuid.uuid4())

        logger.debug(
            "Creating auto-reply message",
            extra={
                "chat_id": str(chat.id),
                "sender_id": sender_id,
                "message_id": message_id,
                "text_length": len(text),
                "using_system_sender": not bool(chat.assignedUserId),
            },
        )

        content_data = {"id": message_id, "text": text}
        # TODO(JIRA-922): drop the contentEncrypted dual-write; the encryption trigger
        # derives it from content.
        encrypted_content = self.encryption_service.encrypt_value(
            self.db,
            json.dumps(content_data),
            self.organization_id,
        )

        auto_reply_message = schemas.ChatMessageCreate(
            chatId=chat.id,
            senderId=sender_id,
            senderType=SenderType.SYSTEM,
            type=ContentType.TEXT,
            content=content_data,
            contentEncrypted=encrypted_content,
            messageId=message_id,
            isDelivered=False,
            isEncrypted=True,
        )

        created_message = repository.chat_message.create_chat_message(self.db, auto_reply_message)

        if not created_message:
            logger.error(
                "Failed to persist auto-reply message to database",
                extra={"chat_id": str(chat.id), "message_id": message_id},
            )
            return None

        logger.debug(
            "Auto-reply message persisted successfully",
            extra={"chat_id": str(chat.id), "message_id": message_id, "db_message_id": str(created_message.id)},
        )

        return created_message

    async def prepare_auto_reply(self, chat: Chat) -> tuple[ChatMessage | None, bool | None]:
        context = get_tenant_context()
        organization_name = context.organization_name if context else "unknown"

        logger.debug(
            "Evaluating auto-reply conditions",
            extra={
                "chat_id": str(chat.id),
                "organization": organization_name,
                "assigned_user_id": str(chat.assignedUserId) if chat.assignedUserId else None,
            },
        )

        should_send = self.should_send_auto_reply(chat=chat, assigned_user_id=chat.assignedUserId)
        logger.debug(
            "Auto-reply eligibility checked",
            extra={
                "chat_id": str(chat.id),
                "should_send": should_send,
                "assigned_user_id": str(chat.assignedUserId) if chat.assignedUserId else None,
            },
        )

        if not should_send:
            logger.debug("Auto-reply conditions not met", extra={"chat_id": str(chat.id)})
            return None, None

        auto_reply_data = self.generate_auto_reply_message(chat=chat, assigned_user_id=chat.assignedUserId)
        auto_reply_text = self._extract_text_from_message_data(auto_reply_data, chat)

        if not auto_reply_text:
            logger.warning(
                "Auto-reply text generation failed or returned empty",
                extra={"chat_id": str(chat.id), "organization": organization_name},
            )
            return None, None

        logger.debug(
            "Auto-reply text generated successfully",
            extra={"chat_id": str(chat.id), "text_length": len(auto_reply_text)},
        )

        message = self.create_message(chat, auto_reply_text)
        if not message:
            raise_error(AutoReplyError("Failed to create auto-reply message", chat_id=str(chat.id)))

        close_chat = self.should_close_chat(chat, chat.assignedUserId)
        logger.debug(
            "Auto-reply message created",
            extra={
                "chat_id": str(chat.id),
                "message_id": message.messageId,
                "will_close_chat": close_chat,
            },
        )

        return message, close_chat
