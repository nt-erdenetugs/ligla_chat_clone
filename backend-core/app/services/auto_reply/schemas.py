from pydantic import BaseModel, ConfigDict, Field

from app.db.models import ChatReplyScheduleType, ChatReplyTimeRangeType


class ChatReplyScheduleTimeRange(BaseModel):
    startTime: str
    endTime: str
    timeRangeType: ChatReplyTimeRangeType

    model_config = ConfigDict(extra="forbid")


class ChatReplySchedule(BaseModel):
    scheduleType: ChatReplyScheduleType
    timeRanges: list[ChatReplyScheduleTimeRange]
    customDates: list[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class ChatReplySettingMessage(BaseModel):
    timeRangeType: ChatReplyTimeRangeType
    templateId: str

    model_config = ConfigDict(extra="forbid")


class ChatReplySettings(BaseModel):
    isActive: bool
    updatedBy: str | None
    schedules: list[ChatReplySchedule]
    messages: list[ChatReplySettingMessage]

    model_config = ConfigDict(extra="forbid")
