import enum


class ChatDataSyncType(enum.StrEnum):
    TAG_SETTINGS = "tag-settings"
    USER_TAGS = "user-tags"
    ATTRIBUTE_SETTINGS = "attribute-settings"
    USER_ATTRIBUTES = "user-attributes"
