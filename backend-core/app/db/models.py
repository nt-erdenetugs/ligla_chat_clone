import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    Float,
    ForeignKeyConstraint,
    Index,
    Integer,
    LargeBinary,
    PrimaryKeyConstraint,
    String,
    Text,
    UniqueConstraint,
    and_,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, foreign, mapped_column, relationship, validates

from app.db.base_class import SCHEMA_TOKEN_TENANT, SharedBase, TenantBase

SURVEY_COLUMNS = {"MAX_CATEGORY_COLUMNS": 25, "MAX_NUMBER_COLUMNS": 15, "MAX_DATETIME_COLUMNS": 15}


class AttributeType(enum.Enum):
    datetime = "datetime"
    time = "time"
    date = "date"
    number = "number"
    string = "string"
    boolean = "boolean"
    selection = "selection"
    calendar = "calendar"


class RoleType(enum.Enum):
    ADMIN = "ADMIN"
    ADMIN_OPERATOR = "ADMIN_OPERATOR"
    MANAGER = "MANAGER"
    MANAGER_OPERATOR = "MANAGER_OPERATOR"
    OPERATOR = "OPERATOR"


class UserStatus(enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    PENDING = "PENDING"
    LOCKED = "LOCKED"


class SenderType(enum.Enum):
    END_USER = "END_USER"
    OPERATOR = "OPERATOR"
    SYSTEM = "SYSTEM"


class ChatStatus(enum.Enum):
    PENDING = "PENDING"
    ADDRESSING = "ADDRESSING"
    DONE = "DONE"


class ActivityType(enum.Enum):
    STATUS_CHANGE = "STATUS_CHANGE"
    USER_CHANGE = "USER_CHANGE"
    TEAMS_CHANGE = "TEAMS_CHANGE"
    END_SESSION = "END_SESSION"
    SESSION_TIMEOUT = "SESSION_TIMEOUT"
    USER_FOLLOWED = "USER_FOLLOWED"
    USER_FOLLOWED_NEW = "USER_FOLLOWED_NEW"
    USER_UNFOLLOWED = "USER_UNFOLLOWED"
    USER_ADDED = "USER_ADDED"


class ChatActivityActorType(enum.Enum):
    USER = "USER"
    SYSTEM = "SYSTEM"


class ContentType(enum.Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    FILE = "file"
    LOCATION = "location"
    STICKER = "sticker"


class ChatReplyScheduleType(enum.Enum):
    MONDAY = "MONDAY"
    TUESDAY = "TUESDAY"
    WEDNESDAY = "WEDNESDAY"
    THURSDAY = "THURSDAY"
    FRIDAY = "FRIDAY"
    SATURDAY = "SATURDAY"
    SUNDAY = "SUNDAY"
    HOLIDAYS = "HOLIDAYS"
    CUSTOM_DATE = "CUSTOM_DATE"


class ChatReplyTimeRangeType(enum.Enum):
    ACTIVE_TIME = "ACTIVE_TIME"
    DEFAULT = "DEFAULT"


class FileStatus(enum.Enum):
    UPLOADING = "UPLOADING"
    PENDING_SCAN = "PENDING_SCAN"
    SCANNED = "SCANNED"
    VIRUS_DETECTED = "VIRUS_DETECTED"
    DELETED = "DELETED"


class FileType(enum.Enum):
    DOCUMENT = "DOCUMENT"
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    AUDIO = "AUDIO"
    ARCHIVE = "ARCHIVE"


class FileFolder(enum.Enum):
    PENDING = "PENDING"
    PROCESSED = "PROCESSED"
    FAILED = "FAILED"


class LogicalOperator(enum.Enum):
    AND = "AND"
    OR = "OR"


class ConditionOperator(enum.Enum):
    EQUAL = "equal"
    NOT_EQUAL = "not_equal"
    INCLUDE = "include"
    NOT_INCLUDE = "not_include"
    REGEX = "regex"
    NULL = "null"
    NOT_NULL = "not_null"
    GT = "gt"
    LT = "lt"
    GTE = "gte"
    LTE = "lte"
    VALUES_MATCH_ANY = "values_match_any"
    VALUES_DO_NOT_MATCH_ANY = "values_do_not_match_any"


class ValueType(enum.Enum):
    STRING = "STRING"
    NUMBER = "NUMBER"
    ARRAY = "ARRAY"
    BOOLEAN = "BOOLEAN"
    DATETIME = "DATETIME"


class SentMethod(enum.Enum):
    PUSH = "push"
    REPLY = "reply"


class MigrationPhase(enum.Enum):
    NOT_STARTED = "NOT_STARTED"
    SCHEMA_CREATED = "SCHEMA_CREATED"
    DATA_COPIED = "DATA_COPIED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


sent_method_enum = Enum(
    SentMethod,
    name="sentmethod",
    schema="public",
    create_type=False,
    native_enum=True,
)

content_type_enum = Enum(
    ContentType,
    name="contenttype",
    schema="public",
    create_type=False,
    native_enum=True,
)

filestatus_enum = Enum(
    FileStatus,
    name="filestatus",
    create_type=False,
    native_enum=True,
)

filetype_enum = Enum(
    FileType,
    name="filetype",
    create_type=False,
    native_enum=True,
)

filefolder_enum = Enum(
    FileFolder,
    name="filefolder",
    create_type=False,
    native_enum=True,
)


class HypervisorUser(SharedBase):
    __tablename__: str = "hypervisorUser"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid(), index=True
    )
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    hashedPassword: Mapped[str] = mapped_column(String, nullable=False)

    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (Index("ix_hypervisorUser_email_lower", func.lower(email)),)

    @validates("email")
    def convert_lower(self, _key: str, value: str) -> str:
        return value.strip().lower()


class Organization(SharedBase):
    __tablename__: str = "organization"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), server_default=func.gen_random_uuid(), unique=True, index=True
    )
    name: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    displayName: Mapped[str] = mapped_column(String, nullable=False)
    apiKey: Mapped[str] = mapped_column(String, nullable=False, server_default="")
    loginLiffId: Mapped[str | None] = mapped_column(String, nullable=True)
    fileUploadLiffId: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    maxOperator: Mapped[int | None] = mapped_column(Integer, nullable=True, server_default="50")
    isActive: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    archivedBy: Mapped[str | None] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    # Computed property for schema name - no database column needed
    @property
    def schema_name(self) -> str:
        """Returns the tenant schema name computed from org UUID: org_{uuid_hex}"""
        return f"org_{str(self.id).replace('-', '').lower()}"

    @validates("name")
    def convert_lower(self, _key: str, value: str) -> str:
        return value.strip().lower()


class OrganizationMigration(SharedBase):
    __tablename__: str = "organizationMigration"
    __table_args__ = (
        Index(
            "ix_organizationMigration_schemaName_unique",
            "schemaName",
            unique=True,
            postgresql_where=text('"schemaName" IS NOT NULL'),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    organizationName: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    schemaName: Mapped[str | None] = mapped_column(String, index=True)
    currentPhase: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=MigrationPhase.NOT_STARTED.value
    )
    schemaCreatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dataCopiedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    migrationCompletedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lastRevision: Mapped[str | None] = mapped_column(String)
    lastStatus: Mapped[str | None] = mapped_column(String)
    lastError: Mapped[str | None] = mapped_column(Text)
    details: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    startedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    finishedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())


class OrganizationSettings(TenantBase):
    __tablename__: str = "organizationSettings"

    type: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    memberFeedSurveyColumnSettings: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    chatReplySettings: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    syncedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @validates("type")
    def validate_type(self, _key: str, value: str) -> str:
        if value not in ("memberFeed", "survey", "chatReply"):
            raise ValueError("type must be 'memberFeed', 'survey', or 'chatReply'")
        return value


class Store(TenantBase):
    """Store in tenant schema - no org columns needed (schema IS the boundary)"""

    __tablename__: str = "store"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    liglaStoreId: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    typeName: Mapped[str | None] = mapped_column(String, nullable=True)
    areaName: Mapped[str | None] = mapped_column(String, nullable=True)
    note: Mapped[str | None] = mapped_column(String, nullable=True)
    startsAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    endsAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    isActive: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    deletedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    storeTeams: Mapped[list["StoreTeam"]] = relationship(
        "StoreTeam",
        back_populates="store",
        primaryjoin="Store.id == foreign(StoreTeam.storeId)",
    )

    @validates("name")
    def convert_lower(self, _key: str, value: str) -> str:
        return value.strip().lower()


class Team(TenantBase):
    """Team in tenant schema"""

    __tablename__: str = "team"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    isActive: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    isDefault: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    archivedBy: Mapped[str | None] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    storeTeams: Mapped[list["StoreTeam"]] = relationship(
        "StoreTeam",
        back_populates="team",
        cascade="all, delete-orphan",
        primaryjoin="Team.id == foreign(StoreTeam.teamId)",
    )
    userTeams: Mapped[list["UserTeam"]] = relationship(
        "UserTeam",
        back_populates="team",
        cascade="all, delete-orphan",
        primaryjoin="Team.id == foreign(UserTeam.teamId)",
    )
    chatTeamAssignments: Mapped[list["ChatTeamAssignment"]] = relationship(
        "ChatTeamAssignment",
        back_populates="team",
        cascade="all, delete-orphan",
        primaryjoin="Team.id == foreign(ChatTeamAssignment.teamId)",
    )
    teamSetting: Mapped["TeamSetting"] = relationship(
        "TeamSetting",
        back_populates="team",
        uselist=False,
        cascade="all, delete-orphan",
        primaryjoin="Team.id == foreign(TeamSetting.teamId)",
    )

    __table_args__: tuple[Index, dict[str, str]] = (
        Index("idx_team_name_lower", func.lower(name)),
        {"schema": SCHEMA_TOKEN_TENANT},
    )
    chatAssignRules: Mapped[list["ChatAssignRuleTargetTeam"]] = relationship(
        "ChatAssignRuleTargetTeam",
        back_populates="team",
        primaryjoin="Team.id == foreign(ChatAssignRuleTargetTeam.teamId)",
    )

    @validates("name")
    def convert_lower(self, _key: str, value: str) -> str:
        return value.strip().lower()


class TeamSetting(TenantBase):
    """Team settings in tenant schema"""

    __tablename__: str = "teamSetting"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    teamId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, unique=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    team: Mapped["Team"] = relationship(
        "Team",
        back_populates="teamSetting",
        primaryjoin="foreign(TeamSetting.teamId) == Team.id",
    )
    teamChatSetting: Mapped["TeamChatSetting"] = relationship(
        "TeamChatSetting",
        back_populates="teamSetting",
        uselist=False,
        cascade="all, delete-orphan",
        primaryjoin="TeamSetting.id == foreign(TeamChatSetting.teamSettingId)",
    )

    __table_args__ = ({"schema": SCHEMA_TOKEN_TENANT},)


class TeamChatSetting(TenantBase):
    """Team chat settings in tenant schema"""

    __tablename__: str = "teamChatSetting"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    teamSettingId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, unique=True)
    viewAllChatsEnabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    teamSetting: Mapped["TeamSetting"] = relationship(
        "TeamSetting",
        back_populates="teamChatSetting",
        primaryjoin="foreign(TeamChatSetting.teamSettingId) == TeamSetting.id",
    )

    __table_args__ = ({"schema": SCHEMA_TOKEN_TENANT},)


class StoreTeam(TenantBase):
    """Store-Team junction in tenant schema"""

    __tablename__: str = "storeTeam"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    storeId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    teamId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    store: Mapped["Store"] = relationship(
        "Store",
        back_populates="storeTeams",
        primaryjoin="foreign(StoreTeam.storeId) == Store.id",
    )
    team: Mapped["Team"] = relationship(
        "Team",
        back_populates="storeTeams",
        primaryjoin="foreign(StoreTeam.teamId) == Team.id",
    )

    __table_args__ = ({"schema": SCHEMA_TOKEN_TENANT},)


class Auth(SharedBase):
    __tablename__: str = "auth"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    organizationName: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    hashedPassword: Mapped[str] = mapped_column(String, nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())
    status: Mapped[UserStatus] = mapped_column(Enum(UserStatus), nullable=False, server_default=UserStatus.ACTIVE.value)
    mailSentAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    loginAttempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    user: Mapped["User"] = relationship(
        "User",
        back_populates="auth",
        uselist=False,
        cascade="all, delete-orphan",
        primaryjoin="Auth.id == foreign(User.id)",
    )
    resetTokens: Mapped["UserPasswordResetToken"] = relationship(
        "UserPasswordResetToken",
        back_populates="user",
        cascade="all, delete-orphan",
        primaryjoin="Auth.id == foreign(UserPasswordResetToken.userId)",
    )

    @validates("email")
    def convert_lower(self, _key: str, value: str) -> str:
        return value.strip().lower()


class User(TenantBase):
    """User in tenant schema - linked to Auth in public schema via cross-schema FK"""

    __tablename__: str = "user"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    displayName: Mapped[str] = mapped_column(String, nullable=False)
    senderName: Mapped[str | None] = mapped_column(String, nullable=True)
    pictureUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    roleType: Mapped[RoleType] = mapped_column(
        Enum(RoleType, schema="public"), nullable=False, server_default=RoleType.OPERATOR.value
    )
    archivedBy: Mapped[str | None] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    userTeams: Mapped[list["UserTeam"]] = relationship(
        "UserTeam",
        back_populates="user",
        cascade="all, delete-orphan",
        primaryjoin="User.id == foreign(UserTeam.userId)",
    )
    notes: Mapped[list["Note"]] = relationship(
        "Note",
        back_populates="user",
        cascade="all, delete-orphan",
        primaryjoin="User.id == foreign(Note.userId)",
    )
    chat: Mapped[list["Chat"]] = relationship(
        "Chat",
        back_populates="user",
        primaryjoin="User.id == foreign(Chat.assignedUserId)",
    )
    chatActivities: Mapped[list["ChatActivity"]] = relationship(
        "ChatActivity",
        back_populates="actor",
        foreign_keys="[ChatActivity.actorId]",
        primaryjoin="User.id == foreign(ChatActivity.actorId)",
        passive_deletes=True,
    )
    chatAttributeValues: Mapped[list["ChatAttributeValue"]] = relationship(
        "ChatAttributeValue",
        back_populates="user",
        cascade="all, delete-orphan",
        primaryjoin="User.id == foreign(ChatAttributeValue.userId)",
    )
    pushSubscriptions: Mapped[list["PushSubscription"]] = relationship(
        "PushSubscription",
        back_populates="user",
        cascade="all, delete-orphan",
        primaryjoin="User.id == foreign(PushSubscription.userId)",
    )
    auth: Mapped["Auth"] = relationship(
        "Auth",
        back_populates="user",
        primaryjoin="foreign(User.id) == Auth.id",
    )
    chatUserReads: Mapped[list["ChatUserRead"]] = relationship(
        "ChatUserRead",
        back_populates="user",
        cascade="all, delete-orphan",
        primaryjoin="User.id == foreign(ChatUserRead.userId)",
    )


class UserTeam(TenantBase):
    """User-Team junction in tenant schema"""

    __tablename__: str = "userTeam"

    userId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, nullable=False)
    teamId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    team: Mapped["Team"] = relationship(
        "Team",
        back_populates="userTeams",
        primaryjoin="foreign(UserTeam.teamId) == Team.id",
    )
    user: Mapped["User"] = relationship(
        "User",
        back_populates="userTeams",
        primaryjoin="foreign(UserTeam.userId) == User.id",
    )


class UserPasswordResetToken(SharedBase):
    """Password reset tokens in public schema (shared across all tenants)"""

    __tablename__: str = "userPasswordResetToken"

    userId: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        nullable=False,
    )
    token: Mapped[str] = mapped_column(String, nullable=False)
    expiresAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user: Mapped["Auth"] = relationship(
        "Auth",
        back_populates="resetTokens",
        primaryjoin="foreign(UserPasswordResetToken.userId) == Auth.id",
    )


class PushSubscription(TenantBase):
    """Push subscriptions in tenant schema"""

    __tablename__: str = "pushSubscription"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    userId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    endpoint: Mapped[str] = mapped_column(String, nullable=False, index=True)
    p256dh: Mapped[str] = mapped_column(String, nullable=False)
    auth: Mapped[str] = mapped_column(String, nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    token: Mapped[str] = mapped_column(String, nullable=False)

    user: Mapped["User"] = relationship(
        "User",
        back_populates="pushSubscriptions",
        primaryjoin="foreign(PushSubscription.userId) == User.id",
    )

    __table_args__ = (Index("idx_push_subscription_user_id", "userId"), {"schema": SCHEMA_TOKEN_TENANT})


class Note(TenantBase):
    """Notes in tenant schema"""

    __tablename__: str = "note"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    userId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    chatId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    noteValue: Mapped[str] = mapped_column(Text, nullable=False)
    noteValueEncrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    isActive: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    isEncrypted: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    user: Mapped["User"] = relationship(
        "User",
        back_populates="notes",
        primaryjoin="foreign(Note.userId) == User.id",
    )
    chat: Mapped["Chat"] = relationship(
        "Chat",
        back_populates="notes",
        primaryjoin="foreign(Note.chatId) == Chat.id",
    )

    __table_args__ = (
        Index("idx_note_chat_active", "chatId", postgresql_where=text('"isActive" = true')),
        {"schema": SCHEMA_TOKEN_TENANT},
    )


class Attribute(TenantBase):
    """Attributes in tenant schema"""

    __tablename__: str = "attribute"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    chatId: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[AttributeType] = mapped_column(
        Enum(AttributeType, schema="public"), nullable=False, server_default=AttributeType.string.value
    )
    isActive: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    isEncryptionEnabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    chat: Mapped["Chat"] = relationship(
        "Chat",
        back_populates="attributes",
        primaryjoin="foreign(Attribute.chatId) == Chat.id",
    )
    chatAttributeValues: Mapped[list["ChatAttributeValue"]] = relationship(
        "ChatAttributeValue",
        back_populates="attribute",
        primaryjoin="Attribute.id == foreign(ChatAttributeValue.attributeId)",
    )

    selectOptions: Mapped[list["SelectOption"]] = relationship(
        "SelectOption",
        back_populates="attribute",
        primaryjoin="Attribute.id == foreign(SelectOption.attributeId)",
    )

    __table_args__: tuple[Index, dict[str, str]] = (
        Index("idx_attribute_name_lower", func.lower(name)),
        {"schema": SCHEMA_TOKEN_TENANT},
    )


class SelectOption(TenantBase):
    __tablename__: str = "selectOption"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    attributeId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    value: Mapped[str] = mapped_column(String, nullable=False)
    label: Mapped[str | None] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())
    attribute: Mapped["Attribute"] = relationship(
        "Attribute",
        back_populates="selectOptions",
        primaryjoin="foreign(SelectOption.attributeId) == Attribute.id",
    )
    chatAttributeValueSelectOptions: Mapped[list["ChatAttributeValueSelectOption"]] = relationship(
        "ChatAttributeValueSelectOption",
        back_populates="selectOption",
        cascade="all, delete-orphan",
        primaryjoin="SelectOption.id == foreign(ChatAttributeValueSelectOption.selectOptionId)",
    )

    __table_args__ = (
        UniqueConstraint("attributeId", "value", name="uq_attribute_option"),
        {"schema": SCHEMA_TOKEN_TENANT},
    )


class ChatAttributeValueSelectOption(TenantBase):
    __tablename__: str = "chatAttributeValueSelectOption"
    selectOptionId: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        nullable=False,
        index=True,
    )
    chatAttributeValueId: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        nullable=False,
        index=True,
    )
    chatAttributeValue: Mapped["ChatAttributeValue"] = relationship(
        "ChatAttributeValue",
        back_populates="selectOption",
        passive_deletes=True,
        primaryjoin="foreign(ChatAttributeValueSelectOption.chatAttributeValueId) == ChatAttributeValue.id",
    )
    selectOption: Mapped["SelectOption"] = relationship(
        "SelectOption",
        back_populates="chatAttributeValueSelectOptions",
        passive_deletes=True,
        primaryjoin="foreign(ChatAttributeValueSelectOption.selectOptionId) == SelectOption.id",
    )
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        PrimaryKeyConstraint("selectOptionId", "chatAttributeValueId", name="pk_chat_attr_value_select_option"),
    )


class ChatAttributeValue(TenantBase):
    __tablename__: str = "chatAttributeValue"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    userId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    chatId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    attributeId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    value: Mapped[str] = mapped_column(String, nullable=False)
    valueEncrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    isEncrypted: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    attribute: Mapped["Attribute"] = relationship(
        "Attribute",
        back_populates="chatAttributeValues",
        primaryjoin="foreign(ChatAttributeValue.attributeId) == Attribute.id",
    )
    user: Mapped["User"] = relationship(
        "User",
        back_populates="chatAttributeValues",
        primaryjoin="foreign(ChatAttributeValue.userId) == User.id",
    )
    selectOption: Mapped[list["ChatAttributeValueSelectOption"]] = relationship(
        "ChatAttributeValueSelectOption",
        back_populates="chatAttributeValue",
        cascade="all, delete-orphan",
        primaryjoin="ChatAttributeValue.id == foreign(ChatAttributeValueSelectOption.chatAttributeValueId)",
    )

    __table_args__ = ({"schema": SCHEMA_TOKEN_TENANT},)


class Tags(TenantBase):
    """Tags in tenant schema"""

    __tablename__: str = "tags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    isActive: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    archivedBy: Mapped[str | None] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    chatTags: Mapped[list["ChatTags"]] = relationship(
        "ChatTags",
        back_populates="tag",
        primaryjoin="Tags.id == foreign(ChatTags.tagId)",
    )

    __table_args__: tuple[Index, dict[str, str]] = (
        Index("idx_tags_name_lower", func.lower(name)),
        {"schema": SCHEMA_TOKEN_TENANT},
    )


class ChatTags(TenantBase):
    __tablename__: str = "chatTags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    chatId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    tagId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    chat: Mapped["Chat"] = relationship(
        "Chat",
        back_populates="chatTags",
        primaryjoin="foreign(ChatTags.chatId) == Chat.id",
    )
    tag: Mapped["Tags"] = relationship(
        "Tags",
        back_populates="chatTags",
        primaryjoin="foreign(ChatTags.tagId) == Tags.id",
    )


class Chat(TenantBase):
    """Chat in tenant schema - linked to tenant EndUser"""

    __tablename__: str = "chat"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    endUserId: Mapped[str] = mapped_column(String, nullable=False)
    clientUserId: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    assignedUserId: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    isManuallyAssigned: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    chatStatus: Mapped[ChatStatus] = mapped_column(
        Enum(ChatStatus, name="chatStatus", schema="public"), nullable=False, server_default=ChatStatus.PENDING.value
    )
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    latestMessageTimestamp: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=func.now(), nullable=True
    )
    latestReadTimestamp: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=func.now(), nullable=True
    )
    latestActivityAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sessionActive: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    isUserBlocked: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    chatMessages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage",
        back_populates="chat",
        cascade="all, delete-orphan",
        primaryjoin="Chat.id == foreign(ChatMessage.chatId)",
    )
    chatTeamAssignments: Mapped[list["ChatTeamAssignment"]] = relationship(
        "ChatTeamAssignment",
        back_populates="chat",
        cascade="all, delete-orphan",
        primaryjoin="Chat.id == foreign(ChatTeamAssignment.chatId)",
    )
    chatTags: Mapped[list["ChatTags"]] = relationship(
        "ChatTags",
        back_populates="chat",
        cascade="all, delete-orphan",
        primaryjoin="Chat.id == foreign(ChatTags.chatId)",
    )
    notes: Mapped[list["Note"]] = relationship(
        "Note",
        back_populates="chat",
        cascade="all, delete-orphan",
        primaryjoin="Chat.id == foreign(Note.chatId)",
    )
    attributes: Mapped[list["Attribute"]] = relationship(
        "Attribute",
        back_populates="chat",
        cascade="all, delete-orphan",
        primaryjoin="Chat.id == foreign(Attribute.chatId)",
    )
    user: Mapped["User"] = relationship(
        "User",
        back_populates="chat",
        primaryjoin="foreign(Chat.assignedUserId) == User.id",
    )
    endUser: Mapped["EndUser"] = relationship(
        "EndUser",
        back_populates="chat",
        uselist=False,
        primaryjoin="foreign(Chat.endUserId) == EndUser.userId",
    )
    activities: Mapped[list["ChatActivity"]] = relationship(
        "ChatActivity",
        back_populates="chat",
        cascade="all, delete-orphan",
        primaryjoin="Chat.id == foreign(ChatActivity.chatId)",
    )
    chatUserReads: Mapped[list["ChatUserRead"]] = relationship(
        "ChatUserRead",
        back_populates="chat",
        cascade="all, delete-orphan",
        primaryjoin="Chat.id == foreign(ChatUserRead.chatId)",
    )
    chatFiles: Mapped[list["ChatFile"]] = relationship(
        "ChatFile",
        back_populates="chat",
        cascade="all, delete-orphan",
        primaryjoin="Chat.id == foreign(ChatFile.chatId)",
    )

    __table_args__ = ({"schema": SCHEMA_TOKEN_TENANT},)


class ChatMessage(TenantBase):
    """Chat messages in tenant schema"""

    __tablename__: str = "chatMessage"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    chatId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    senderId: Mapped[str] = mapped_column(String, nullable=False)
    senderType: Mapped[str] = mapped_column(Enum(SenderType, schema="public"), nullable=False)
    type: Mapped[ContentType] = mapped_column(content_type_enum, nullable=False)
    content: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    contentEncrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    messageId: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    isUnsent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    isDelivered: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    isEncrypted: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)
    previewImageUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    contentUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    duration: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latitude: Mapped[Decimal] = mapped_column(Float, nullable=True)
    longitude: Mapped[Decimal] = mapped_column(Float, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    quoteToken: Mapped[str | None] = mapped_column(String, nullable=True)
    quotedMessageId: Mapped[str | None] = mapped_column(String, nullable=True)
    sentMethod: Mapped[SentMethod | None] = mapped_column(sent_method_enum, nullable=True)
    deliveryDetails: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    markAsReadToken: Mapped[str | None] = mapped_column(String, nullable=True)

    chat: Mapped["Chat"] = relationship(
        "Chat",
        back_populates="chatMessages",
        primaryjoin="foreign(ChatMessage.chatId) == Chat.id",
    )

    __table_args__ = (
        Index("idx_chat_message_chat_created", "chatId", "createdAt"),
        Index("idx_chat_message_sender", "senderId"),
        Index("idx_chat_message_type", "type"),
        Index("idx_chat_message_unsent", "isUnsent"),
        Index(
            "idx_cm_delivered_enduser_chat_created",
            "chatId",
            "createdAt",
            postgresql_where=text('"isDelivered" = true AND "senderType" = \'END_USER\''),
        ),
        {"schema": SCHEMA_TOKEN_TENANT},
    )


class ChatTeamAssignment(TenantBase):
    __tablename__: str = "chatTeamAssignment"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    chatId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    teamId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    chat: Mapped["Chat"] = relationship(
        "Chat",
        back_populates="chatTeamAssignments",
        primaryjoin="foreign(ChatTeamAssignment.chatId) == Chat.id",
    )
    team: Mapped["Team"] = relationship(
        "Team",
        back_populates="chatTeamAssignments",
        primaryjoin="foreign(ChatTeamAssignment.teamId) == Team.id",
    )


class ChatUserRead(TenantBase):
    """Chat read status per user - in tenant schema"""

    __tablename__: str = "chatUserRead"

    chatId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    userId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    readTimestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    chat: Mapped["Chat"] = relationship(
        "Chat",
        back_populates="chatUserReads",
        primaryjoin="foreign(ChatUserRead.chatId) == Chat.id",
    )
    user: Mapped["User"] = relationship(
        "User",
        back_populates="chatUserReads",
        primaryjoin="foreign(ChatUserRead.userId) == User.id",
    )

    __table_args__ = (Index("idx_chat_user_read_user", "userId"), {"schema": SCHEMA_TOKEN_TENANT})


class ChatActivity(TenantBase):
    __tablename__: str = "chatActivity"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    chatId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    activityType: Mapped[str] = mapped_column(Enum(ActivityType, schema="public"), nullable=False)
    actorType: Mapped[str] = mapped_column(Enum(ChatActivityActorType, schema="public"), nullable=False)
    actorId: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    actorUserName: Mapped[str | None] = mapped_column(String, nullable=True)

    oldStatus: Mapped[ChatStatus | None] = mapped_column(
        Enum(ChatStatus, name="chatStatus", schema="public"), nullable=True
    )
    newStatus: Mapped[ChatStatus | None] = mapped_column(
        Enum(ChatStatus, name="chatStatus", schema="public"), nullable=True
    )

    oldUserId: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    newUserId: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    oldUserName: Mapped[str | None] = mapped_column(String, nullable=True)
    newUserName: Mapped[str | None] = mapped_column(String, nullable=True)

    oldTeamIds: Mapped[str | None] = mapped_column(String, nullable=True)
    newTeamIds: Mapped[str | None] = mapped_column(String, nullable=True)
    oldTeamNames: Mapped[str | None] = mapped_column(String, nullable=True)
    newTeamNames: Mapped[str | None] = mapped_column(String, nullable=True)

    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    chat: Mapped["Chat"] = relationship(
        "Chat",
        back_populates="activities",
        primaryjoin="foreign(ChatActivity.chatId) == Chat.id",
    )
    actor: Mapped["User"] = relationship(
        "User",
        foreign_keys=[actorId],
        back_populates="chatActivities",
        primaryjoin="foreign(ChatActivity.actorId) == User.id",
    )

    __table_args__ = (
        Index("idx_chat_activity_chat_created", "chatId", "createdAt"),
        Index("idx_chat_activity_type_created", "activityType", "createdAt"),
        {"schema": SCHEMA_TOKEN_TENANT},
    )


class SurveyData(TenantBase):
    __tablename__: str = "surveyData"

    endUserId: Mapped[str] = mapped_column(String(255), primary_key=True, nullable=False)
    clientUserId: Mapped[str | None] = mapped_column(String(255), nullable=True)
    userSurvey: Mapped[Any] = mapped_column(JSON, nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        Index("ix_surveyData_end_user", "endUserId"),
        Index("ix_surveyData_client_user", "clientUserId"),
        {"schema": SCHEMA_TOKEN_TENANT},
    )


class EndUser(TenantBase):
    __tablename__: str = "endUser"
    __table_args__ = ({"schema": SCHEMA_TOKEN_TENANT},)

    userId: Mapped[str] = mapped_column(String, primary_key=True, nullable=False, unique=True)
    displayName: Mapped[str | None] = mapped_column(String, nullable=True)
    pictureUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    chat: Mapped["Chat"] = relationship(
        "Chat",
        back_populates="endUser",
        uselist=False,
        primaryjoin="EndUser.userId == foreign(Chat.endUserId)",
    )


class ChatReplyMessageTemplate(TenantBase):
    __tablename__: str = "chatReplyMessageTemplate"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[ContentType] = mapped_column(content_type_enum, nullable=False)
    content: Mapped[Any] = mapped_column(JSONB, nullable=False)
    contentUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    previewImageUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    updatedBy: Mapped[str | None] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())


class MemberFeedData(TenantBase):
    __tablename__: str = "memberFeedData"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clientUserId: Mapped[str] = mapped_column(String(255), nullable=False)
    lineUserId: Mapped[str | None] = mapped_column(String(255), nullable=True)

    category1: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category3: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category4: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category5: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category6: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category7: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category8: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category9: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category10: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category11: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category12: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category13: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category14: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category15: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category16: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category17: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category18: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category19: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category20: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category21: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category22: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category23: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category24: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category25: Mapped[str | None] = mapped_column(String(255), nullable=True)

    number1: Mapped[int | None] = mapped_column(Integer, nullable=True)
    number2: Mapped[int | None] = mapped_column(Integer, nullable=True)
    number3: Mapped[int | None] = mapped_column(Integer, nullable=True)
    number4: Mapped[int | None] = mapped_column(Integer, nullable=True)
    number5: Mapped[int | None] = mapped_column(Integer, nullable=True)
    number6: Mapped[int | None] = mapped_column(Integer, nullable=True)
    number7: Mapped[int | None] = mapped_column(Integer, nullable=True)
    number8: Mapped[int | None] = mapped_column(Integer, nullable=True)
    number9: Mapped[int | None] = mapped_column(Integer, nullable=True)
    number10: Mapped[int | None] = mapped_column(Integer, nullable=True)
    number11: Mapped[int | None] = mapped_column(Integer, nullable=True)
    number12: Mapped[int | None] = mapped_column(Integer, nullable=True)
    number13: Mapped[int | None] = mapped_column(Integer, nullable=True)
    number14: Mapped[int | None] = mapped_column(Integer, nullable=True)
    number15: Mapped[int | None] = mapped_column(Integer, nullable=True)

    datetime1: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    datetime2: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    datetime3: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    datetime4: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    datetime5: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    datetime6: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    datetime7: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    datetime8: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    datetime9: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    datetime10: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    datetime11: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    datetime12: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    datetime13: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    datetime14: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    datetime15: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    importedAt: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )  # From BigQuery - MUST match partition schema
    syncedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        Index("ix_memberFeedData_client_user", "clientUserId"),
        {"schema": SCHEMA_TOKEN_TENANT},
    )


class ChatAssignRule(TenantBase):
    __tablename__: str = "chatAssignRule"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    note: Mapped[str | None] = mapped_column(String, nullable=True)
    isActive: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())
    targetTeams: Mapped[list["ChatAssignRuleTargetTeam"]] = relationship(
        "ChatAssignRuleTargetTeam",
        back_populates="rule",
        cascade="all, delete-orphan",
        primaryjoin="ChatAssignRule.id == foreign(ChatAssignRuleTargetTeam.ruleId)",
    )
    groups: Mapped[list["ChatAssignFilterGroup"]] = relationship(
        "ChatAssignFilterGroup",
        back_populates="rule",
        cascade="all, delete-orphan",
        primaryjoin="ChatAssignRule.id == foreign(ChatAssignFilterGroup.ruleId)",
    )
    rootGroup: Mapped["ChatAssignFilterGroup"] = relationship(
        "ChatAssignFilterGroup",
        primaryjoin=lambda: and_(
            ChatAssignRule.id == foreign(ChatAssignFilterGroup.ruleId),
            ChatAssignFilterGroup.isRoot.is_(True),
        ),
        uselist=False,
        viewonly=True,
    )

    __table_args__: tuple[dict[str, str]] = ({"schema": SCHEMA_TOKEN_TENANT},)


class ChatAssignRuleTargetTeam(TenantBase):
    __tablename__: str = "chatAssignRuleTargetTeam"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    ruleId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    teamId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    rule: Mapped["ChatAssignRule"] = relationship(
        "ChatAssignRule",
        back_populates="targetTeams",
        primaryjoin="foreign(ChatAssignRuleTargetTeam.ruleId) == ChatAssignRule.id",
    )
    team: Mapped["Team"] = relationship(
        "Team",
        back_populates="chatAssignRules",
        primaryjoin="foreign(ChatAssignRuleTargetTeam.teamId) == Team.id",
    )

    __table_args__: tuple[UniqueConstraint, Index, dict[str, str]] = (
        UniqueConstraint("ruleId", "teamId", name="uq_chat_assign_rule_team_unique"),
        Index("ix_chat_assign_rule_target_rule_team", "ruleId", "teamId"),
        {"schema": SCHEMA_TOKEN_TENANT},
    )


class ChatAssignFilterGroupClosure(TenantBase):
    __tablename__: str = "chatAssignFilterGroupClosure"

    ruleId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    ancestorGroupId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    descendantGroupId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    depth: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__: tuple[
        PrimaryKeyConstraint, CheckConstraint, ForeignKeyConstraint, ForeignKeyConstraint, Index, Index, dict[str, str]
    ] = (
        PrimaryKeyConstraint("ancestorGroupId", "descendantGroupId", name="pk_filter_group_closure"),
        CheckConstraint("depth >= 0", name="ck_fg_depth_non_negative"),
        ForeignKeyConstraint(
            ["ancestorGroupId", "ruleId"],
            [f"{SCHEMA_TOKEN_TENANT}.chatAssignFilterGroup.id", f"{SCHEMA_TOKEN_TENANT}.chatAssignFilterGroup.ruleId"],
            ondelete="CASCADE",
            name="fk_fg_cl_ancestor",
        ),
        ForeignKeyConstraint(
            ["descendantGroupId", "ruleId"],
            [f"{SCHEMA_TOKEN_TENANT}.chatAssignFilterGroup.id", f"{SCHEMA_TOKEN_TENANT}.chatAssignFilterGroup.ruleId"],
            ondelete="CASCADE",
            name="fk_fg_cl_descendant",
        ),
        Index("ix_cl_rule_ancestor_depth", "ruleId", "ancestorGroupId", "depth"),
        Index("ix_cl_rule_descendant", "ruleId", "descendantGroupId"),
        {"schema": SCHEMA_TOKEN_TENANT},
    )

    ancestor: Mapped["ChatAssignFilterGroup"] = relationship(
        "ChatAssignFilterGroup",
        primaryjoin="and_(ChatAssignFilterGroupClosure.ancestorGroupId==ChatAssignFilterGroup.id, ChatAssignFilterGroupClosure.ruleId==ChatAssignFilterGroup.ruleId)",
        back_populates="asAncestor",
        foreign_keys=[ancestorGroupId, ruleId],
        viewonly=True,
    )

    descendant: Mapped["ChatAssignFilterGroup"] = relationship(
        "ChatAssignFilterGroup",
        primaryjoin="and_(ChatAssignFilterGroupClosure.descendantGroupId==ChatAssignFilterGroup.id, ChatAssignFilterGroupClosure.ruleId==ChatAssignFilterGroup.ruleId)",
        back_populates="asDescendant",
        foreign_keys=[descendantGroupId, ruleId],
        viewonly=True,
    )


class ChatAssignFilterGroup(TenantBase):
    __tablename__: str = "chatAssignFilterGroup"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    ruleId: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    logicalOperator: Mapped[LogicalOperator] = mapped_column(
        Enum(LogicalOperator), nullable=False, server_default=LogicalOperator.AND.value
    )
    isRoot: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    rule: Mapped["ChatAssignRule"] = relationship(
        "ChatAssignRule",
        back_populates="groups",
        primaryjoin="foreign(ChatAssignFilterGroup.ruleId) == ChatAssignRule.id",
    )
    filters: Mapped[list["ChatAssignFilterGroupItem"]] = relationship(
        "ChatAssignFilterGroupItem",
        back_populates="group",
        cascade="all, delete-orphan",
        primaryjoin="ChatAssignFilterGroup.id == foreign(ChatAssignFilterGroupItem.groupId)",
    )

    asAncestor: Mapped[list["ChatAssignFilterGroupClosure"]] = relationship(
        "ChatAssignFilterGroupClosure",
        foreign_keys=lambda: [
            ChatAssignFilterGroupClosure.ancestorGroupId,
            ChatAssignFilterGroupClosure.ruleId,
        ],
        back_populates="ancestor",
        cascade="all, delete-orphan",
        overlaps="asDescendant,descendant",
    )

    asDescendant: Mapped[list["ChatAssignFilterGroupClosure"]] = relationship(
        "ChatAssignFilterGroupClosure",
        foreign_keys=lambda: [
            ChatAssignFilterGroupClosure.descendantGroupId,
            ChatAssignFilterGroupClosure.ruleId,
        ],
        back_populates="descendant",
        cascade="all, delete-orphan",
        overlaps="asAncestor,ancestor",
    )
    __table_args__: tuple[Index, UniqueConstraint, Index, dict[str, str]] = (
        Index("uq_rule_single_root", "ruleId", unique=True, postgresql_where=text("isRoot = true")),
        UniqueConstraint("id", "ruleId", name="uq_filter_group_id_rule"),
        Index("ix_filter_group_rule", "ruleId"),
        {"schema": SCHEMA_TOKEN_TENANT},
    )


class ChatAssignFilterGroupItem(TenantBase):
    __tablename__: str = "chatAssignFilterGroupItem"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    groupId: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    filterId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    group: Mapped["ChatAssignFilterGroup"] = relationship(
        "ChatAssignFilterGroup",
        back_populates="filters",
        primaryjoin="foreign(ChatAssignFilterGroupItem.groupId) == ChatAssignFilterGroup.id",
    )

    __table_args__: tuple[Index, dict[str, str]] = (
        Index("ix_fg_item_group_filter", "groupId", "filterId"),
        {"schema": SCHEMA_TOKEN_TENANT},
    )


class ChatAssignFilter(TenantBase):
    __tablename__: str = "chatAssignFilter"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    targetTable: Mapped[str] = mapped_column(String, nullable=False)
    note: Mapped[str | None] = mapped_column(String, nullable=True)
    isActive: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())
    groups: Mapped[list["ChatAssignConditionGroup"]] = relationship(
        "ChatAssignConditionGroup",
        back_populates="filter",
        cascade="all, delete-orphan",
        primaryjoin="ChatAssignFilter.id == foreign(ChatAssignConditionGroup.filterId)",
    )
    rootGroup: Mapped["ChatAssignConditionGroup"] = relationship(
        "ChatAssignConditionGroup",
        primaryjoin=lambda: and_(
            ChatAssignFilter.id == foreign(ChatAssignConditionGroup.filterId),
            ChatAssignConditionGroup.isRoot.is_(True),
        ),
        uselist=False,
        viewonly=True,
    )

    __table_args__: tuple[dict[str, str]] = ({"schema": SCHEMA_TOKEN_TENANT},)


class ChatAssignConditionGroupClosure(TenantBase):
    __tablename__: str = "chatAssignConditionGroupClosure"

    filterId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    ancestorGroupId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    descendantGroupId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    depth: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__: tuple[
        PrimaryKeyConstraint, CheckConstraint, ForeignKeyConstraint, ForeignKeyConstraint, Index, Index, dict[str, str]
    ] = (
        PrimaryKeyConstraint("ancestorGroupId", "descendantGroupId", name="pk_condition_group_closure"),
        CheckConstraint("depth >= 0", name="ck_cg_depth_non_negative"),
        ForeignKeyConstraint(
            ["ancestorGroupId", "filterId"],
            [
                f"{SCHEMA_TOKEN_TENANT}.chatAssignConditionGroup.id",
                f"{SCHEMA_TOKEN_TENANT}.chatAssignConditionGroup.filterId",
            ],
            ondelete="CASCADE",
            name="fk_cc_gcl_ancestor",
        ),
        ForeignKeyConstraint(
            ["descendantGroupId", "filterId"],
            [
                f"{SCHEMA_TOKEN_TENANT}.chatAssignConditionGroup.id",
                f"{SCHEMA_TOKEN_TENANT}.chatAssignConditionGroup.filterId",
            ],
            ondelete="CASCADE",
            name="fk_cc_gcl_descendant",
        ),
        Index("ix_cl_filter_ancestor_depth", "filterId", "ancestorGroupId", "depth"),
        Index("ix_cl_filter_descendant", "filterId", "descendantGroupId"),
        {"schema": SCHEMA_TOKEN_TENANT},
    )

    ancestor: Mapped["ChatAssignConditionGroup"] = relationship(
        "ChatAssignConditionGroup",
        primaryjoin="and_(ChatAssignConditionGroupClosure.ancestorGroupId==ChatAssignConditionGroup.id, ChatAssignConditionGroupClosure.filterId==ChatAssignConditionGroup.filterId)",
        back_populates="asAncestor",
        foreign_keys=[ancestorGroupId, filterId],
        viewonly=True,
    )
    descendant: Mapped["ChatAssignConditionGroup"] = relationship(
        "ChatAssignConditionGroup",
        primaryjoin="and_(ChatAssignConditionGroupClosure.descendantGroupId==ChatAssignConditionGroup.id, ChatAssignConditionGroupClosure.filterId==ChatAssignConditionGroup.filterId)",
        back_populates="asDescendant",
        foreign_keys=[descendantGroupId, filterId],
        viewonly=True,
    )


class ChatAssignConditionGroup(TenantBase):
    __tablename__: str = "chatAssignConditionGroup"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    filterId: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    logicalOperator: Mapped[LogicalOperator] = mapped_column(
        Enum(LogicalOperator), nullable=False, server_default=LogicalOperator.AND.value
    )
    isRoot: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    filter: Mapped["ChatAssignFilter"] = relationship(
        "ChatAssignFilter",
        back_populates="groups",
        primaryjoin="foreign(ChatAssignConditionGroup.filterId) == ChatAssignFilter.id",
    )
    conditions: Mapped[list["ChatAssignCondition"]] = relationship(
        "ChatAssignCondition",
        back_populates="group",
        cascade="all, delete-orphan",
        primaryjoin="ChatAssignConditionGroup.id == foreign(ChatAssignCondition.groupId)",
    )

    asAncestor: Mapped[list["ChatAssignConditionGroupClosure"]] = relationship(
        "ChatAssignConditionGroupClosure",
        foreign_keys=lambda: [
            ChatAssignConditionGroupClosure.ancestorGroupId,
            ChatAssignConditionGroupClosure.filterId,
        ],
        back_populates="ancestor",
        cascade="all, delete-orphan",
        overlaps="asDescendant,descendant",
    )

    asDescendant: Mapped[list["ChatAssignConditionGroupClosure"]] = relationship(
        "ChatAssignConditionGroupClosure",
        foreign_keys=lambda: [
            ChatAssignConditionGroupClosure.descendantGroupId,
            ChatAssignConditionGroupClosure.filterId,
        ],
        back_populates="descendant",
        cascade="all, delete-orphan",
        overlaps="asAncestor,ancestor",
    )
    __table_args__: tuple[Index, UniqueConstraint, Index, dict[str, str]] = (
        Index("uq_filter_single_root", "filterId", unique=True, postgresql_where=text("isRoot = true")),
        UniqueConstraint("id", "filterId", name="uq_condition_group_id_filter"),
        Index("ix_condition_group_filter", "filterId"),
        {"schema": SCHEMA_TOKEN_TENANT},
    )


class ChatAssignCondition(TenantBase):
    __tablename__: str = "chatAssignCondition"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    groupId: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    field: Mapped[str] = mapped_column(String, nullable=False)
    operator: Mapped[ConditionOperator] = mapped_column(Enum(ConditionOperator), nullable=False)
    value: Mapped[str | None] = mapped_column(String, nullable=True)
    valueType: Mapped[ValueType] = mapped_column(Enum(ValueType), nullable=False)

    group: Mapped["ChatAssignConditionGroup"] = relationship(
        "ChatAssignConditionGroup",
        back_populates="conditions",
        primaryjoin="foreign(ChatAssignCondition.groupId) == ChatAssignConditionGroup.id",
    )

    __table_args__: tuple[Index, dict[str, str]] = (
        Index("ix_chat_assign_condition_group", "groupId"),
        {"schema": SCHEMA_TOKEN_TENANT},
    )


class ChatFile(TenantBase):
    __tablename__: str = "chatFile"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    chatId: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    uploaderOperatorId: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    uploaderEndUserId: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    fileName: Mapped[str] = mapped_column(String, nullable=False)
    originalFileName: Mapped[str] = mapped_column(String, nullable=False)
    fileSize: Mapped[int] = mapped_column(BigInteger, nullable=False)
    mimeType: Mapped[str] = mapped_column(String, nullable=False)
    fileType: Mapped[FileType] = mapped_column(filetype_enum, nullable=False)
    gcsObjectKey: Mapped[str] = mapped_column(String, nullable=False)
    storageFolder: Mapped[FileFolder] = mapped_column(
        filefolder_enum, nullable=False, server_default=FileFolder.PENDING.value
    )
    status: Mapped[FileStatus] = mapped_column(
        filestatus_enum, nullable=False, server_default=FileStatus.UPLOADING.value
    )
    scanResult: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())
    deletedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deletedBy: Mapped[str | None] = mapped_column(String, nullable=True)

    chat: Mapped["Chat"] = relationship(
        "Chat",
        back_populates="chatFiles",
        primaryjoin="foreign(ChatFile.chatId) == Chat.id",
    )
    uploaderOperator: Mapped["User | None"] = relationship(
        "User",
        primaryjoin="foreign(ChatFile.uploaderOperatorId) == User.id",
    )
    uploaderEndUser: Mapped["EndUser | None"] = relationship(
        "EndUser",
        primaryjoin="foreign(ChatFile.uploaderEndUserId) == EndUser.userId",
    )

    __table_args__ = (
        CheckConstraint(
            '(("uploaderOperatorId" IS NOT NULL)::int + ("uploaderEndUserId" IS NOT NULL)::int) = 1',
            name="check_exactly_one_uploader",
        ),
        {"schema": SCHEMA_TOKEN_TENANT},
    )
