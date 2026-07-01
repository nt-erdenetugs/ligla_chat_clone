from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.db.models import ActivityType, ChatActivityActorType, ChatStatus, SenderType
from app.services.receiver.constants import ContentType

if TYPE_CHECKING:
    from app.services.receiver.schemas.message import OngoingMessageRequest


class ChatBase(BaseModel):
    endUserId: str = Field(..., description="Unique identifier for the end user (format: U[0-9a-f]{32})")
    clientUserId: str | None = Field(None, description="Optional client user identifier")
    assignedUserId: UUID | None = Field(None, description="Optional assigned user UUID")
    isManuallyAssigned: bool = Field(False, description="Whether the chat was manually assigned")
    chatStatus: ChatStatus = Field(ChatStatus.PENDING, description="Current status of the chat")
    createdAt: datetime | None = Field(None, description="Creation timestamp")


class ChatCreate(ChatBase):
    pass


class ChatUpdate(ChatBase):
    id: UUID = Field(..., description="Unique identifier of the chat")


class ChatInDBBase(ChatBase):
    id: UUID = Field(...)

    model_config = ConfigDict(from_attributes=True)


class ChatInDB(ChatInDBBase):
    pass


class Chat(ChatInDBBase):
    pass


class ChatMessageBase(BaseModel):
    chatId: UUID = Field(..., description="Reference to the chat this message belongs to")
    senderId: str = Field(..., description="ID of the message sender")
    senderType: SenderType = Field(SenderType.END_USER, description="Type of sender (end user, operator, etc.)")
    type: str = Field(..., description="Type of message (text, image, etc.)")
    content: dict[str, Any] | None = Field(None, description="Plaintext JSONB message content payload")
    contentEncrypted: bytes | None = Field(None, description="Encrypted bytes of the content payload (pgp_sym_encrypt)")
    messageId: str | None = Field(None, description="External message identifier")
    isUnsent: bool = Field(False, description="Whether the message has been unsent")
    isDelivered: bool = Field(..., description="Whether the message has been delivered")
    isEncrypted: bool = Field(False, description="Whether contentEncrypted is populated")
    previewImageUrl: str | None = Field(None, description="URL for preview image")
    contentUrl: str | None = Field(None, description="URL for message content")
    duration: int | None = Field(None, description="Duration for media messages (seconds)")
    latitude: float | None = Field(None, description="Latitude for location messages")
    longitude: float | None = Field(None, description="Longitude for location messages")
    createdAt: datetime | None = Field(None, description="Message creation timestamp")
    quoteToken: str | None = Field(None, description="Token for quoted message")
    quotedMessageId: str | None = Field(None, description="ID of the quoted message")
    markAsReadToken: str | None = Field(None, description="Token for marking message as read")


class ChatMessageCreate(ChatMessageBase):
    @classmethod
    def from_ongoing_message(cls, ongoing_message: "OngoingMessageRequest", chat_id: UUID) -> "ChatMessageCreate":
        # Prepare base content dictionary
        content_data: dict[str, Any] = {"id": ongoing_message.message_id}

        # Initialize base payload
        payload = cls(
            chatId=chat_id,
            senderId=ongoing_message.user_id,
            senderType=SenderType.END_USER,
            type=ongoing_message.content_type,
            content=content_data,  # Will be updated below
            messageId=ongoing_message.message_id,
            isDelivered=True,
            quoteToken=ongoing_message.quote_token if hasattr(ongoing_message, "quote_token") else None,
            quotedMessageId=(
                ongoing_message.quoted_message_id if hasattr(ongoing_message, "quoted_message_id") else None
            ),
            markAsReadToken=(
                ongoing_message.mark_as_read_token if hasattr(ongoing_message, "mark_as_read_token") else None
            ),
        )

        # Populate content and fields based on content type
        if ongoing_message.content_type == ContentType.TEXT:
            content_data["text"] = ongoing_message.text
            if ongoing_message.emojis:
                content_data["emojis"] = [emoji.model_dump() for emoji in ongoing_message.emojis]

        elif ongoing_message.content_type == ContentType.IMAGE:
            payload.contentUrl = ongoing_message.content_url or ongoing_message.image

            # Handle contentUrl in content
            if ongoing_message.content_url:
                content_data["contentUrl"] = ongoing_message.content_url
            if ongoing_message.image:
                content_data["image"] = ongoing_message.image
            if ongoing_message.image_set:
                content_data["imageSet"] = ongoing_message.image_set.model_dump()

            # Set previewImageUrl
            if ongoing_message.preview_image_url:
                payload.previewImageUrl = ongoing_message.preview_image_url
                content_data["previewImageUrl"] = ongoing_message.preview_image_url
            elif payload.contentUrl and "images" in payload.contentUrl:
                preview_url = payload.contentUrl.replace("/images/", "/previews/")
                payload.previewImageUrl = preview_url
                content_data["previewImageUrl"] = preview_url

        elif ongoing_message.content_type == ContentType.VIDEO:
            payload.contentUrl = ongoing_message.content_url
            content_data["contentUrl"] = ongoing_message.content_url

            if ongoing_message.duration is not None:
                payload.duration = ongoing_message.duration
                content_data["duration"] = ongoing_message.duration

            # Set previewImageUrl
            if ongoing_message.preview_image_url:
                payload.previewImageUrl = ongoing_message.preview_image_url
                content_data["previewImageUrl"] = ongoing_message.preview_image_url
            elif ongoing_message.content_url and "images" in ongoing_message.content_url:
                preview_url = ongoing_message.content_url.replace("/images/", "/previews/")
                payload.previewImageUrl = preview_url
                content_data["previewImageUrl"] = preview_url

        elif ongoing_message.content_type == ContentType.AUDIO:
            payload.contentUrl = ongoing_message.content_url
            content_data["contentUrl"] = ongoing_message.content_url

            if ongoing_message.duration is not None:
                payload.duration = ongoing_message.duration
                content_data["duration"] = ongoing_message.duration

        elif ongoing_message.content_type == ContentType.FILE:
            payload.contentUrl = ongoing_message.content_url
            content_data.update(
                {
                    "contentUrl": ongoing_message.content_url,
                    "fileName": ongoing_message.file_name,
                    "fileSize": ongoing_message.file_size,
                }
            )

        elif ongoing_message.content_type == ContentType.LOCATION:
            payload.latitude = ongoing_message.latitude
            payload.longitude = ongoing_message.longitude

            content_data.update(
                {
                    "latitude": ongoing_message.latitude,
                    "longitude": ongoing_message.longitude,
                }
            )
            if ongoing_message.title:
                content_data["title"] = ongoing_message.title
            if ongoing_message.address:
                content_data["address"] = ongoing_message.address

        elif ongoing_message.content_type == ContentType.STICKER:
            content_data.update(
                {
                    "stickerId": ongoing_message.sticker_id,
                    "packageId": ongoing_message.package_id,
                    "stickerResourceType": ongoing_message.sticker_resource_type,
                }
            )
            if ongoing_message.keywords:
                content_data["keywords"] = ongoing_message.keywords
            if ongoing_message.text:
                content_data["text"] = ongoing_message.text

        # Remove None values and set final content
        filtered_content = {k: v for k, v in content_data.items() if v is not None}
        payload.content = filtered_content

        return payload


class ChatMessageUpdate(ChatMessageBase):
    id: UUID = Field(...)


class ChatMessageInDBBase(ChatMessageBase):
    id: UUID = Field(...)

    model_config = ConfigDict(from_attributes=True)


class ChatMessageInDB(ChatMessageInDBBase):
    pass


class ChatMessage(ChatMessageInDBBase):
    pass


# ChatTeamAssignment schemas
class ChatTeamAssignmentBase(BaseModel):
    chatId: UUID = Field(..., description="Reference to the chat")
    teamId: UUID = Field(..., description="Reference to the team")


class ChatTeamAssignmentCreate(ChatTeamAssignmentBase):
    pass


class ChatTeamAssignmentUpdate(ChatTeamAssignmentBase):
    id: UUID = Field(...)


class ChatTeamAssignmentInDBBase(ChatTeamAssignmentBase):
    id: UUID = Field(...)

    model_config = ConfigDict(from_attributes=True)


class ChatTeamAssignmentInDB(ChatTeamAssignmentInDBBase):
    pass


class ChatTeamAssignment(ChatTeamAssignmentInDBBase):
    pass


# ChatActivity schemas
class ChatActivityBase(BaseModel):
    chatId: UUID = Field(..., description="Reference to the chat")
    activityType: ActivityType = Field(..., description="Type of activity performed")
    actorType: ChatActivityActorType = Field(..., description="Type of actor performing the activity")
    oldUserId: UUID | None = Field(None, description="Previous user ID (for assignment changes)")
    newUserId: UUID | None = Field(None, description="New user ID (for assignment changes)")
    newUserName: str | None = Field(None, description="Name of the new user")
    oldTeamIds: str | None = Field(None, description="Previous team IDs (comma-separated)")
    newTeamIds: str | None = Field(None, description="New team IDs (comma-separated)")
    oldTeamNames: str | None = Field(None, description="Previous team names (comma-separated)")
    newTeamNames: str | None = Field(None, description="New team names (comma-separated)")


class ChatActivityCreate(ChatActivityBase):
    pass


class ChatActivityUpdate(ChatActivityBase):
    id: UUID = Field(...)


# Chat Delete schemas
class ChatDeleteResponse(BaseModel):
    success: bool = Field(..., description="Whether the delete operation was successful")
    chatId: UUID = Field(..., description="ID of the deleted chat")
    message: str = Field(..., description="Status message")
    deletedMessagesCount: int = Field(0, description="Number of messages deleted")
    deletedActivitiesCount: int = Field(0, description="Number of activities deleted")
    deletedNotesCount: int = Field(0, description="Number of notes deleted")
    deletedAttributesCount: int = Field(0, description="Number of attributes deleted")
    deletedTagsCount: int = Field(0, description="Number of tags deleted")
    deletedTeamAssignmentsCount: int = Field(0, description="Number of team assignments deleted")
    endUserDeleted: bool = Field(False, description="Whether the end user was deleted")
    deletedSurveyCount: int = Field(0, description="Number of survey records deleted")
