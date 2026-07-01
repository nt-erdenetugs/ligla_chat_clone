import enum


class ContentType(enum.StrEnum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    FILE = "file"
    LOCATION = "location"
    STICKER = "sticker"


class MessageType(enum.StrEnum):
    NEW_MESSAGE = "new"
    ONGOING_MESSAGE = "ongoing"
    UNSEND_MESSAGE = "unsend"
    END_SESSION = "end"
    USER_FOLLOW = "follow"
    USER_UNFOLLOW = "unfollow"
    SURVEY = "survey"


class StickerResourceType(enum.StrEnum):
    ANIMATION = "ANIMATION"
    MESSAGE = "MESSAGE"


ALLOWED_MESSAGE_TYPES = {
    MessageType.NEW_MESSAGE,
    MessageType.ONGOING_MESSAGE,
    MessageType.UNSEND_MESSAGE,
    MessageType.END_SESSION,
    MessageType.USER_FOLLOW,
    MessageType.USER_UNFOLLOW,
    MessageType.SURVEY,
}

ALLOWED_CONTENT_TYPES = {
    ContentType.TEXT,
    ContentType.IMAGE,
    ContentType.VIDEO,
    ContentType.AUDIO,
    ContentType.FILE,
    ContentType.LOCATION,
    ContentType.STICKER,
}

# Auto-reply configuration
DEFAULT_AUTO_REPLY_ENABLED = True
AUTO_REPLY_TIMEZONE = "Asia/Tokyo"
