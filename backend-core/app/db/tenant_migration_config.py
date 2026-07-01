from __future__ import annotations

from dataclasses import dataclass

# Table name constants
END_USER_TABLE = "endUser"
MEMBER_FEED_TABLE = "memberFeedData"
CHAT_TABLE = "chat"
SURVEY_DATA_TABLE = "surveyData"

# Organization column names
ORG_ID_COLS = ("organizationId", "organization_id")
ORG_NAME_COL = "organizationName"


@dataclass(frozen=True)
class TableSpec:
    name: str
    org_column: str = "organizationName"
    # For child tables that don't have org column directly
    # Specify: (parent_table, fk_column, parent_org_column)
    # Use empty string for parent_org_column if it cascades from another join table
    join_parent: tuple[str, str, str] | None = None
    # If True, the FK is in the parent table pointing to this table
    # e.g., organizationChatReplySetting.chatReplySettingId -> chatReplySetting.id
    reverse_join: bool = False
    # Column name in this table for reverse join (defaults to "id")
    join_child_column: str = "id"


TENANT_TABLES: list[TableSpec] = [
    # Tables with direct organizationName column
    TableSpec("user"),
    TableSpec("team"),
    TableSpec("store"),
    TableSpec("tags"),
    # CRITICAL: endUser MUST come BEFORE chat to satisfy FK constraints
    # endUser is populated using UNION of chat.endUserId + surveyData.endUserId from public_old
    # This prevents FK violations when chat table is migrated (chat.endUserId -> endUser.userId)
    # Special handler: copy_enduser_with_union() in migration.py (queries public_old, not tenant)
    TableSpec(
        "endUser",
        org_column="",
        join_parent=("chat", "endUserId", "organizationName"),
        reverse_join=True,
        join_child_column="userId",
    ),
    TableSpec("chat"),
    TableSpec("surveyData"),
    TableSpec("note"),
    # memberFeedData: source (public_old) has organizationName, target (tenant) doesn't
    # Filter by organizationName in source, but don't copy it to target
    # Also filter out NULL organizationName values (causes partition errors)
    TableSpec(
        "memberFeedData",
        org_column="organizationName",
    ),
    TableSpec("chatReplyMessageTemplate"),
    TableSpec("chatAssignRule"),
    TableSpec("chatAssignFilter"),
    TableSpec("organizationSettings"),
    # Tables that join through parent table
    TableSpec("teamSetting", join_parent=("team", "teamId", "organizationName")),
    TableSpec("chatAssignRuleTargetTeam", join_parent=("chatAssignRule", "ruleId", "organizationName")),
    TableSpec("chatAssignFilterGroup", join_parent=("chatAssignRule", "ruleId", "organizationName")),
    TableSpec("chatAssignFilterGroupClosure", join_parent=("chatAssignRule", "ruleId", "organizationName")),
    TableSpec("chatAssignFilterGroupItem", join_parent=("chatAssignFilterGroup", "groupId", "")),
    TableSpec("chatAssignConditionGroup", join_parent=("chatAssignFilter", "filterId", "organizationName")),
    TableSpec("chatAssignConditionGroupClosure", join_parent=("chatAssignFilter", "filterId", "organizationName")),
    TableSpec("chatAssignCondition", join_parent=("chatAssignConditionGroup", "groupId", "")),
    TableSpec("chatMessage", join_parent=("chat", "chatId", "organizationName")),
    TableSpec("chatUserRead", join_parent=("chat", "chatId", "organizationName")),
    TableSpec("chatActivity", join_parent=("chat", "chatId", "organizationName")),
    TableSpec("chatTeamAssignment", join_parent=("chat", "chatId", "organizationName")),
    TableSpec("chatTags", join_parent=("chat", "chatId", "organizationName")),
    # attribute must come BEFORE chatAttributeValue (FK dependency)
    TableSpec("attribute"),
    TableSpec("selectOption", join_parent=("attribute", "attributeId", "organizationName")),
    TableSpec("chatAttributeValue", join_parent=("chat", "chatId", "organizationName")),
    TableSpec(
        "chatAttributeValueSelectOption", join_parent=("chatAttributeValue", "chatAttributeValueId", "")
    ),  # Cascades
    TableSpec("storeTeam", join_parent=("store", "storeId", "organizationName")),
    TableSpec("userTeam", join_parent=("team", "teamId", "organizationName")),
    TableSpec("teamChatSetting", join_parent=("teamSetting", "teamSettingId", "")),  # Cascades from teamSetting
    TableSpec("pushSubscription", join_parent=("user", "userId", "organizationName")),
    # chatReplySetting-related tables removed (no longer in the schema)
    # userPasswordResetToken removed - not a tenant table (contains auth data)
]


TABLE_EXCLUDE_COLS: dict[str, set[str]] = {
    "memberFeedData": {"id"},  # organizationName needed for partitioned table
    "organizationSettings": {"organizationName"},  # organizationName removed in tenant schema (schema = org boundary)
}

COLUMN_REMAP: dict[str, dict[str, str]] = {
    # Note: store table columns are already in camelCase in both schemas (typeName, areaName, etc.)
    # No remapping needed
    "attribute": {
        "chatId": "chat_id",
    },
    "memberFeedData": {
        "id": "__gen_random_uuid__",
    },
}
