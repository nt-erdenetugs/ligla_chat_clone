import uuid
from typing import Annotated, Any

from fastapi import Body
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, field_validator, model_validator

from app.common.utils import validate_line_user_id
from app.services.receiver.constants import ContentType, MessageType, StickerResourceType
from app.services.receiver.schemas.survey import SurveyDataBase


def coerce_to_str(v: Any) -> str:
    if isinstance(v, int | bool):
        return str(v)
    return v


def coerce_to_optional_str(v: Any) -> str | None:
    if v is None:
        return None
    if isinstance(v, int | bool):
        return str(v)
    return v


CoercedStr = Annotated[str, BeforeValidator(coerce_to_str)]
CoercedOptionalStr = Annotated[str | None, BeforeValidator(coerce_to_optional_str)]


class BaseMessageRequest(BaseModel):
    message_type: MessageType = Field(..., alias="messageType")
    client_name: CoercedStr = Field(..., alias="clientName")
    organization_id: uuid.UUID | None = Field(None, alias="organizationId")
    user_id: CoercedStr = Field(..., alias="userId")
    timestamp: int = Field(...)
    is_unblocked: bool | None = Field(None, alias="isUnblocked")

    model_config = ConfigDict(populate_by_name=True, extra="allow")

    @field_validator("user_id")
    @classmethod
    def validate_user_id(cls, v: str) -> str:
        if validate_line_user_id(v):
            return v
        raise ValueError(f"Invalid user_id format: {v}")


class Profile(BaseModel):
    display_name: CoercedStr = Field(default="Anonymous User", alias="displayName")
    picture_url: CoercedOptionalStr = Field(None, alias="pictureUrl")

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def handle_validation_errors(cls, data: Any) -> dict[str, Any]:
        if not isinstance(data, dict):
            return {"displayName": "Anonymous User", "pictureUrl": None}

        result: dict[str, str | None] = {}
        result["displayName"] = data.get("displayName", "Anonymous User")
        result["pictureUrl"] = data.get("pictureUrl")

        return result


class Favorites(BaseModel):
    operator_id: uuid.UUID | None = Field(None, alias="operatorId")
    store_ids: list[int] | None = Field(default_factory=list, alias="storeIds")

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def handle_validation_errors(cls, data: Any) -> dict[str, Any]:
        if not isinstance(data, dict):
            return {"operatorId": None, "storeIds": []}

        result: dict[str, Any] = {}

        operator_id = data.get("operatorId")
        if isinstance(operator_id, str):
            try:
                uuid.UUID(operator_id.strip())
                result["operatorId"] = operator_id.strip()
            except ValueError:
                result["operatorId"] = None
        else:
            result["operatorId"] = operator_id

        store_ids = data.get("storeIds", [])
        if isinstance(store_ids, list):
            result["storeIds"] = [value for value in store_ids if isinstance(value, int)]
        else:
            result["storeIds"] = []

        return result


class ImageSet(BaseModel):
    id: CoercedStr = Field(...)
    index: int = Field(...)
    total: int = Field(...)

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def handle_validation_errors(cls, data: Any) -> dict[str, Any]:
        if not isinstance(data, dict):
            return {"id": "", "index": 0, "total": 0}

        result: dict[str, Any] = {}
        result["id"] = data.get("id", "")

        index = data.get("index", 0)
        result["index"] = index if isinstance(index, int) else 0

        total = data.get("total", 0)
        result["total"] = total if isinstance(total, int) else 0

        return result


class Emojis(BaseModel):
    index: int = Field(...)
    length: int = Field(...)
    product_id: CoercedStr = Field(..., alias="productId")
    emoji_id: CoercedStr = Field(..., alias="emojiId")

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def handle_validation_errors(cls, data: Any) -> dict[str, Any]:
        if not isinstance(data, dict):
            return {"index": 0, "length": 0, "productId": "", "emojiId": ""}

        result: dict[str, Any] = {}

        index = data.get("index", 0)
        result["index"] = index if isinstance(index, int) else 0

        length = data.get("length", 0)
        result["length"] = length if isinstance(length, int) else 0

        result["productId"] = data.get("productId", "")
        result["emojiId"] = data.get("emojiId", "")

        return result


class NewMessageRequest(BaseMessageRequest):
    message_type: MessageType = Field(MessageType.NEW_MESSAGE, alias="messageType")
    client_user_id: CoercedOptionalStr = Field(alias="clientUserId", default=None)
    profile: Profile | None = Field(None)
    favorites: Favorites | None = Field(None)
    additions: SurveyDataBase | None = Field(None)
    auto_reply: bool | None = Field(
        default=None,
        description="Enable/disable auto-reply for this chat initialization. Default: True (enabled)",
        alias="autoReply",
    )


class OngoingMessageRequest(BaseMessageRequest):
    message_type: MessageType = Field(MessageType.ONGOING_MESSAGE, alias="messageType")
    message_id: CoercedStr = Field(..., alias="messageId")
    content_type: ContentType = Field(..., alias="contentType")
    auto_reply: bool = Field(
        default=True,
        description="Enable/disable auto-reply for this ongoing message. Default: True (enabled)",
        alias="auto_reply",
    )

    # Optional fields that may be present in different message types
    quote_token: CoercedOptionalStr = Field(None, alias="quoteToken")
    quoted_message_id: CoercedOptionalStr = Field(None, alias="quotedMessageId")
    mark_as_read_token: CoercedOptionalStr = Field(None, alias="markAsReadToken")
    text: CoercedOptionalStr = Field(default=None)
    emojis: list[Emojis] | None = Field(default=None)

    content_url: CoercedOptionalStr = Field(None, alias="contentUrl")
    image: CoercedOptionalStr = Field(default=None)
    image_set: ImageSet | None = Field(None, alias="imageSet")
    preview_image_url: CoercedOptionalStr = Field(None, alias="previewImageUrl")

    duration: int | None = Field(default=None)

    file_name: CoercedOptionalStr = Field(None, alias="fileName")
    file_size: int | None = Field(None, alias="fileSize")

    title: CoercedOptionalStr = Field(default=None)
    address: CoercedOptionalStr = Field(default=None)
    latitude: float | None = Field(default=None)
    longitude: float | None = Field(default=None)

    sticker_id: CoercedOptionalStr = Field(None, alias="stickerId")
    package_id: CoercedOptionalStr = Field(None, alias="packageId")
    sticker_resource_type: StickerResourceType | None = Field(None, alias="stickerResourceType")
    keywords: list[str] | None = Field(default=None)

    @field_validator("message_id")
    @classmethod
    def validate_message_id(cls, v: str) -> str:
        if not v or v.strip() == "":
            raise ValueError("messageId cannot be empty")
        return v.strip()

    @model_validator(mode="after")
    def validate_content_fields(self) -> "OngoingMessageRequest":
        content_type = self.content_type

        if content_type == ContentType.TEXT:
            if not self.text:
                raise ValueError(f"Field 'text' is required for {content_type} messages")

        elif content_type == ContentType.IMAGE:
            if not self.content_url and not self.image:
                raise ValueError(f"Field 'content_url' or 'image' is required for {content_type} messages")

        # VIDEO: requires content_url
        elif content_type == ContentType.VIDEO:
            if not self.content_url:
                raise ValueError(f"Field 'content_url' is required for {content_type} messages")

        # AUDIO: requires content_url
        elif content_type == ContentType.AUDIO:
            if not self.content_url:
                raise ValueError(f"Field 'content_url' is required for {content_type} messages")

        # FILE: requires content_url and file_name
        elif content_type == ContentType.FILE:
            if not self.content_url:
                raise ValueError(f"Field 'content_url' is required for {content_type} messages")
            if not self.file_name:
                raise ValueError(f"Field 'file_name' is required for {content_type} messages")

        # LOCATION: requires latitude and longitude
        elif content_type == ContentType.LOCATION:
            if self.latitude is None or self.longitude is None:
                raise ValueError(f"Fields 'latitude' and 'longitude' are required for {content_type} messages")

        elif content_type == ContentType.STICKER:
            if not self.sticker_id:
                raise ValueError(f"Field 'sticker_id' is required for {content_type} messages")
            if not self.package_id:
                raise ValueError(f"Field 'package_id' is required for {content_type} messages")

        return self


class UnsendMessageRequest(BaseMessageRequest):
    message_type: MessageType = Field(MessageType.UNSEND_MESSAGE, alias="messageType")
    message_id: CoercedStr = Field(..., alias="messageId")


class EndSessionRequest(BaseMessageRequest):
    message_type: MessageType = Field(MessageType.END_SESSION, alias="messageType")
    is_timeout: bool | None = Field(None, alias="isTimeout")


class UserSurveyRequest(BaseMessageRequest):
    message_type: MessageType = Field(MessageType.SURVEY, alias="messageType")
    additions: SurveyDataBase = Field(...)


class MessageResponse(BaseModel):
    clientName: str | None = Field(None, alias="clientName")
    message: str | None = Field(default=None)
    endUserId: str | None = Field(None, alias="endUserId")
    chatId: str = Field(..., alias="chatId")
    isAutoReplyMessage: bool = Field(default=False, alias="isAutoReplyMessage")
    closeChat: bool | None = Field(default=False, alias="closeChat")
    messageId: str | None = Field(None, alias="messageId")


MessageRequest = Annotated[
    NewMessageRequest
    | OngoingMessageRequest
    | UnsendMessageRequest
    | EndSessionRequest
    | UserSurveyRequest
    | BaseMessageRequest,
    Body(
        openapi_examples={
            "new": {
                "summary": "New message type example",
                "description": "A new message request with profile, favorites, and additions.",
                "value": {
                    "messageType": MessageType.NEW_MESSAGE,
                    "clientName": "ligla_chat",
                    "clientUserId": "USER001",
                    "userId": "U8189cf6745fc0d808977bdb0b9f22995",
                    "timestamp": 1699868901,
                    "autoReply": True,
                    "profile": {
                        "displayName": "Test User",
                        "pictureUrl": "https://example.com/profile.jpg",
                    },
                    "favorites": {"operatorId": "", "storeIds": [1, 2, 3]},
                    "additions": {"category_1": "TEXT", "category_25": "", "number_1": "0", "number_20": None},
                },
            },
            "user_added": {
                "summary": "User added event example",
                "description": "A new message request with profile, favorites, and additions. But auto reply is false.",
                "value": {
                    "messageType": MessageType.NEW_MESSAGE,
                    "clientName": "ligla_chat",
                    "clientUserId": "USER001",
                    "userId": "U8189cf6745fc0d808977bdb0b9f22995",
                    "timestamp": 1699868901,
                    "autoReply": False,
                    "profile": {
                        "displayName": "Test User",
                        "pictureUrl": "https://example.com/profile.jpg",
                    },
                    "favorites": {"operatorId": "", "storeIds": [1, 2, 3]},
                    "additions": {"category_1": "TEXT", "category_25": "", "number_1": "0", "number_20": None},
                },
            },
            "end": {
                "summary": "End session type example",
                "description": "A session end request.",
                "value": {
                    "messageType": MessageType.END_SESSION,
                    "clientName": "ligla_chat",
                    "userId": "U8189cf6745fc0d808977bdb0b9f22995",
                    "timestamp": 1699868901,
                    "isTimeout": True,
                },
            },
            "follow": {
                "summary": "Follow chat example (new friend)",
                "description": "A follow event when a new user follows the account.",
                "value": {
                    "messageType": MessageType.USER_FOLLOW,
                    "clientName": "ligla_chat",
                    "userId": "U8189cf6745fc0d808977bdb0b9f22995",
                    "timestamp": 1699868901,
                    "isUnblocked": False,
                },
            },
            "unblock": {
                "summary": "Unblock chat example",
                "description": "A follow event when a user unblocks the account.",
                "value": {
                    "messageType": MessageType.USER_FOLLOW,
                    "clientName": "ligla_chat",
                    "userId": "U8189cf6745fc0d808977bdb0b9f22995",
                    "timestamp": 1699868901,
                    "isUnblocked": True,
                },
            },
            "unfollow": {
                "summary": "Unfollow chat example",
                "description": "A unfollow chat session request.",
                "value": {
                    "messageType": MessageType.USER_UNFOLLOW,
                    "clientName": "ligla_chat",
                    "userId": "U8189cf6745fc0d808977bdb0b9f22995",
                    "timestamp": 1699868901,
                },
            },
            "ongoing_text": {
                "summary": "Ongoing text message example",
                "description": "An ongoing message with text content.",
                "value": {
                    "messageType": MessageType.ONGOING_MESSAGE,
                    "clientName": "ligla_chat",
                    "timestamp": 1699868901,
                    "userId": "U8189cf6745fc0d808977bdb0b9f22995",
                    "messageId": "1234567890",
                    "quoteToken": "q3Plxr4AgKd...",
                    "contentType": ContentType.TEXT,
                    "text": "Hi there! Can you help me with my order? (love)",
                    "autoReply": True,
                    "emojis": [{"index": 42, "length": 6, "productId": "5ac1bfd5040ab15980c9b435", "emojiId": "001"}],
                    "quotedMessageId": "yHAz4Ua2wx7...",
                },
            },
            "ongoing_image": {
                "summary": "Ongoing image message example",
                "description": "An ongoing message with a single image.",
                "value": {
                    "messageType": MessageType.ONGOING_MESSAGE,
                    "clientName": "ligla_chat",
                    "timestamp": 1699868901,
                    "userId": "U8189cf6745fc0d808977bdb0b9f22995",
                    "messageId": "444573844083572737",
                    "quoteToken": "q3Plxr4AgKd...",
                    "contentType": ContentType.IMAGE,
                    "contentUrl": "https://i.pravatar.cc/150?img=17",
                    "image": "https://i.pravatar.cc/150?img=17",
                },
            },
            "ongoing_image_set": {
                "summary": "Ongoing image set message example",
                "description": "An ongoing message with multiple images.",
                "value": {
                    "messageType": MessageType.ONGOING_MESSAGE,
                    "clientName": "ligla_chat",
                    "timestamp": 1699868901,
                    "userId": "U8189cf6745fc0d808977bdb0b9f22995",
                    "messageId": "444573844083572737",
                    "quoteToken": "yHAz4Ua2wx7...",
                    "contentType": ContentType.IMAGE,
                    "contentUrl": "gs://ligla-chat-data-stg/ligla_chat/images/U8189cf6745fc0d808977bdb0b9f22995/E005D41A7288F41B65593ED38FF6E9834B046AB36A37921A56BC236F13A91855/1-444573844083572737-1699868901.jpg",
                    "imageSet": {
                        "id": "E005D41A7288F41B65593ED38FF6E9834B046AB36A37921A56BC236F13A91855",
                        "index": 1,
                        "total": 2,
                    },
                },
            },
            "ongoing_video": {
                "summary": "Ongoing video message example",
                "description": "An ongoing message with video content.",
                "value": {
                    "messageType": MessageType.ONGOING_MESSAGE,
                    "clientName": "ligla_chat",
                    "timestamp": 1699868901,
                    "userId": "U8189cf6745fc0d808977bdb0b9f22995",
                    "messageId": "444573844083572737",
                    "quoteToken": "q3Plxr4AgKd...",
                    "contentType": ContentType.VIDEO,
                    "contentUrl": "gs://ligla-chat-data-stg/ligla_chat/videos/U8189cf6745fc0d808977bdb0b9f22995/444573844083572737-1699868901.mp4",
                    "duration": 60000,
                },
            },
            "ongoing_audio": {
                "summary": "Ongoing audio message example",
                "description": "An ongoing message with audio content.",
                "value": {
                    "messageType": MessageType.ONGOING_MESSAGE,
                    "clientName": "ligla_chat",
                    "timestamp": 1699868901,
                    "userId": "U8189cf6745fc0d808977bdb0b9f22995",
                    "messageId": "444573844083572737",
                    "contentType": ContentType.AUDIO,
                    "contentUrl": "gs://ligla-chat-data-stg/ligla_chat/audios/U8189cf6745fc0d808977bdb0b9f22995/444573844083572737-1699868901.m4a",
                    "duration": 60000,
                },
            },
            "ongoing_file": {
                "summary": "Ongoing file message example",
                "description": "An ongoing message with file content.",
                "value": {
                    "messageType": MessageType.ONGOING_MESSAGE,
                    "clientName": "ligla_chat",
                    "timestamp": 1699868901,
                    "userId": "U8189cf6745fc0d808977bdb0b9f22995",
                    "messageId": "444573844083572737",
                    "contentType": ContentType.FILE,
                    "contentUrl": "gs://ligla-chat-data-stg/ligla_chat/files/U8189cf6745fc0d808977bdb0b9f22995/444573844083572737-1699868901.txt",
                    "fileName": "file.txt",
                    "fileSize": 2138,
                },
            },
            "ongoing_location": {
                "summary": "Ongoing location message example",
                "description": "An ongoing message with location content.",
                "value": {
                    "messageType": MessageType.ONGOING_MESSAGE,
                    "clientName": "ligla_chat",
                    "timestamp": 1699868901,
                    "userId": "U8189cf6745fc0d808977bdb0b9f22995",
                    "messageId": "444573844083572737",
                    "contentType": ContentType.LOCATION,
                    "title": "my location",
                    "address": "日本、〒102-8282 東京都千代田区紀尾井町1番3号",
                    "latitude": 35.67966,
                    "longitude": 139.73669,
                },
            },
            "ongoing_sticker_animation": {
                "summary": "Ongoing animation sticker message example",
                "description": "An ongoing message with animation sticker content.",
                "value": {
                    "messageType": MessageType.ONGOING_MESSAGE,
                    "clientName": "ligla_chat",
                    "timestamp": 1699868901,
                    "userId": "U8189cf6745fc0d808977bdb0b9f22995",
                    "messageId": "444573844083572737",
                    "contentType": ContentType.STICKER,
                    "quoteToken": "q3Plxr4AgKd...",
                    "stickerId": "52002738",
                    "packageId": "11537",
                    "stickerResourceType": StickerResourceType.ANIMATION,
                    "keywords": ["cony", "sally", "Staring", "hi", "whatsup", "line", "howdy"],
                    "quotedMessageId": "yHAz4Ua2wx7...",
                },
            },
            "ongoing_sticker_message": {
                "summary": "Ongoing message sticker example",
                "description": "An ongoing message with message sticker content.",
                "value": {
                    "messageType": MessageType.ONGOING_MESSAGE,
                    "clientName": "ligla_chat",
                    "timestamp": 1699868901,
                    "userId": "U8189cf6745fc0d808977bdb0b9f22995",
                    "messageId": "444573844083572737",
                    "contentType": ContentType.STICKER,
                    "quoteToken": "q3Plxr4AgKd...",
                    "stickerId": "738839",
                    "packageId": "12287",
                    "stickerResourceType": StickerResourceType.MESSAGE,
                    "keywords": ["Anticipation", "Sparkle", "Straight face", "Staring", "Thinking"],
                    "text": "今週末\n一緒に\n遊ぼうよ！",
                    "quotedMessageId": "yHAz4Ua2wx7...",
                },
            },
            "unsend": {
                "summary": "Unsend message example",
                "description": "A request to unsend a previously sent message.",
                "value": {
                    "messageType": MessageType.UNSEND_MESSAGE,
                    "clientName": "ligla_chat",
                    "timestamp": 1699868901,
                    "userId": "U8189cf6745fc0d808977bdb0b9f22995",
                    "messageId": "123456789012345678",
                },
            },
            "survey": {
                "summary": "User survey example",
                "description": "A user survey request with  additions.",
                "value": {
                    "messageType": MessageType.SURVEY,
                    "clientName": "ligla_chat",
                    "userId": "U8189cf6745fc0d808977bdb0b9f22995",
                    "timestamp": 1699868901,
                    "additions": {
                        "category_1": "TEXT",
                        "category_25": "",
                        "number_1": "0",
                        "number_20": 32,
                        "datetime_1": "2025_03_03",
                    },
                },
            },
        }
    ),
]
