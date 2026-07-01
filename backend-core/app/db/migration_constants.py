PUBLIC_SCHEMA = "public"
PUBLIC_OLD_SCHEMA = "public_old"

SHARED_TABLES = {
    "hypervisorUser",
    "organization",
    "organizationMigration",
    "auth",
    "userPasswordResetToken",
}

TENANT_TABLES = {
    "organizationSettings",
    "store",
    "team",
    "teamSetting",
    "teamChatSetting",
    "storeTeam",
    "user",
    "userTeam",
    "pushSubscription",
    "note",
    "attribute",
    "selectOption",
    "chatAttributeValueSelectOption",
    "chatAttributeValue",
    "tags",
    "chatTags",
    "chat",
    "chatFile",
    "chatUserRead",  # Added for read tracking feature
    "endUser",
    "chatMessage",
    "chatTeamAssignment",
    "chatActivity",
    "surveyData",
    "chatReplyMessageTemplate",
    "memberFeedData",
    "chatAssignRule",
    "chatAssignRuleTargetTeam",
    "chatAssignFilterGroupClosure",
    "chatAssignFilterGroup",
    "chatAssignFilterGroupItem",
    "chatAssignFilter",
    "chatAssignConditionGroupClosure",
    "chatAssignConditionGroup",
    "chatAssignCondition",
}

# Legacy tenant tables from old migrations
# These tables exist in old migrations but have been removed from current models.
# They should be created in tenant schemas when running old migrations.
LEGACY_TENANT_TABLES = {
    "attributeValue",  # Migration 83f43c3b9825 - replaced with chatAttributeValue
    "chatAssignee",  # Migration 0de5574ff322 - removed in later migration
    "organizationMemberFeedColumnAlias",
    "organizationMemberFeedSetting",
    "organizationSurveyColumnAlias",
    "organizationSurveySetting",
    "chatReplySetting",
    "chatReplySchedule",
    "chatReplyScheduleCustomDate",
    "chatReplyScheduleTimeRange",
    "chatReplySettingMessage",
    "organizationChatReplySetting",
    "userChatReplySetting",
}


# Validation helpers
def validate_table_classification():
    shared_tenant_overlap = SHARED_TABLES & TENANT_TABLES
    if shared_tenant_overlap:
        raise ValueError(f"Tables cannot be both shared and tenant-specific: {shared_tenant_overlap}")

    shared_legacy_overlap = SHARED_TABLES & LEGACY_TENANT_TABLES
    if shared_legacy_overlap:
        raise ValueError(f"Tables cannot be both shared and legacy tenant: {shared_legacy_overlap}")


# Fast O(1) set-intersection check — safe and intentional at import time
validate_table_classification()
