import { pgTable, varchar, uniqueIndex, index, uuid, timestamp, integer, foreignKey, text, boolean, jsonb, pgSchema, check, bigint, unique, json, doublePrecision, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { bytea } from "../types"

export const tenant_template = pgSchema("tenant_template");
export const conditionoperator = pgEnum("conditionoperator", ['EQUAL', 'NOT_EQUAL', 'INCLUDE', 'NOT_INCLUDE', 'REGEX', 'NULL', 'NOT_NULL', 'GT', 'LT', 'GTE', 'LTE', 'VALUES_MATCH_ANY', 'VALUES_DO_NOT_MATCH_ANY'])
export const contenttype = pgEnum("contenttype", ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'LOCATION', 'STICKER'])
export const logicaloperator = pgEnum("logicaloperator", ['AND', 'OR'])
export const userstatus = pgEnum("userstatus", ['ACTIVE', 'INACTIVE', 'PENDING', 'LOCKED'])
export const valuetype = pgEnum("valuetype", ['STRING', 'NUMBER', 'ARRAY', 'BOOLEAN', 'DATETIME'])
export const activitytypeInTenant_template = tenant_template.enum("activitytype", ['STATUS_CHANGE', 'USER_CHANGE', 'TEAMS_CHANGE', 'END_SESSION', 'USER_FOLLOWED', 'USER_UNFOLLOWED', 'USER_FOLLOWED_NEW', 'USER_ADDED', 'SESSION_TIMEOUT'])
export const attributetypeInTenant_template = tenant_template.enum("attributetype", ['string', 'number', 'boolean', 'selection', 'calendar', 'time', 'datetime', 'date'])
export const chatStatusInTenant_template = tenant_template.enum("chatStatus", ['PENDING', 'ADDRESSING', 'DONE'])
export const chatactivityactortypeInTenant_template = tenant_template.enum("chatactivityactortype", ['USER', 'SYSTEM'])
export const chatstatusInTenant_template = tenant_template.enum("chatstatus", ['PENDING', 'ADDRESSING', 'DONE'])
export const conditionoperatorInTenant_template = tenant_template.enum("conditionoperator", ['EQUAL', 'NOT_EQUAL', 'INCLUDE', 'NOT_INCLUDE', 'REGEX', 'NULL', 'NOT_NULL', 'GT', 'LT', 'GTE', 'LTE', 'VALUES_MATCH_ANY', 'VALUES_DO_NOT_MATCH_ANY'])
export const contenttypeInTenant_template = tenant_template.enum("contenttype", ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'LOCATION', 'STICKER'])
export const filefolderInTenant_template = tenant_template.enum("filefolder", ['PENDING', 'PROCESSED', 'FAILED'])
export const filestatusInTenant_template = tenant_template.enum("filestatus", ['UPLOADING', 'PENDING_SCAN', 'SCANNED', 'VIRUS_DETECTED', 'DELETED'])
export const filetypeInTenant_template = tenant_template.enum("filetype", ['DOCUMENT', 'IMAGE', 'VIDEO', 'AUDIO', 'ARCHIVE'])
export const logicaloperatorInTenant_template = tenant_template.enum("logicaloperator", ['AND', 'OR'])
export const roletypeInTenant_template = tenant_template.enum("roletype", ['ADMIN', 'ADMIN_OPERATOR', 'MANAGER', 'MANAGER_OPERATOR', 'OPERATOR'])
export const sendertypeInTenant_template = tenant_template.enum("sendertype", ['END_USER', 'OPERATOR', 'SYSTEM'])
export const sentmethodInTenant_template = tenant_template.enum("sentmethod", ['push', 'reply'])
export const userstatusInTenant_template = tenant_template.enum("userstatus", ['ACTIVE', 'INACTIVE', 'PENDING', 'LOCKED'])
export const valuetypeInTenant_template = tenant_template.enum("valuetype", ['STRING', 'NUMBER', 'ARRAY', 'BOOLEAN', 'DATETIME'])


export const alembic_version = pgTable("alembic_version", {
	version_num: varchar({ length: 32 }).primaryKey().notNull(),
});

export const hypervisorUser = pgTable("hypervisorUser", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: varchar().notNull(),
	hashedPassword: varchar().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
}, (table) => [
	uniqueIndex("hypervisorUser_email_key").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("ix_hypervisorUser_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
]);

export const auth = pgTable("auth", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationName: varchar(),
	email: varchar().notNull(),
	hashedPassword: varchar().notNull(),
	status: userstatus().default('ACTIVE').notNull(),
	mailSentAt: timestamp({ withTimezone: true, mode: 'date' }),
	loginAttempts: integer().default(0).notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("auth_email_key").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("ix_auth_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	index("ix_auth_organization_name").using("btree", table.organizationName.asc().nullsLast().op("text_ops")),
]);

export const userPasswordResetToken = pgTable("userPasswordResetToken", {
	userId: uuid().primaryKey().notNull(),
	token: varchar().notNull(),
	expiresAt: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [auth.id],
			name: "fk_userPasswordResetToken_userId"
		}),
]);

export const organization = pgTable("organization", {
	name: varchar().primaryKey().notNull(),
	displayName: varchar().notNull(),
	description: text(),
	maxOperator: integer().default(50),
	isActive: boolean().default(true).notNull(),
	archivedBy: varchar(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
	apiKey: varchar().notNull(),
	id: uuid().defaultRandom().notNull(),
	liffId: varchar(),
	loginLiffId: varchar(),
	fileUploadLiffId: varchar(),
}, (table) => [
	uniqueIndex("ix_organization_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("organization_name_key").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

export const organizationMigration = pgTable("organizationMigration", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationName: varchar(),
	schemaName: varchar(),
	currentPhase: varchar({ length: 20 }).default('NOT_STARTED').notNull(),
	schemaCreatedAt: timestamp({ withTimezone: true, mode: 'date' }),
	dataCopiedAt: timestamp({ withTimezone: true, mode: 'date' }),
	migrationCompletedAt: timestamp({ withTimezone: true, mode: 'date' }),
	lastRevision: varchar(),
	lastStatus: varchar(),
	lastError: text(),
	details: jsonb(),
	startedAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	finishedAt: timestamp({ withTimezone: true, mode: 'date' }),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
}, (table) => [
	uniqueIndex("ix_organizationMigration_schemaName_unique").using("btree", table.schemaName.asc().nullsLast().op("text_ops")).where(sql`("schemaName" IS NOT NULL)`),
	index("ix_public_organizationMigration_organizationName").using("btree", table.organizationName.asc().nullsLast().op("text_ops")),
	index("ix_public_organizationMigration_schemaName").using("btree", table.schemaName.asc().nullsLast().op("text_ops")),
]);

export const chatFileInTenant_template = tenant_template.table("chatFile", {
	id: uuid().primaryKey().notNull(),
	chatId: uuid().notNull(),
	uploaderOperatorId: uuid(),
	uploaderEndUserId: varchar(),
	fileName: varchar().notNull(),
	originalFileName: varchar().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	fileSize: bigint({ mode: "number" }).notNull(),
	mimeType: varchar().notNull(),
	fileType: filetypeInTenant_template().notNull(),
	gcsObjectKey: varchar().notNull(),
	storageFolder: filefolderInTenant_template().default('PENDING').notNull(),
	status: filestatusInTenant_template().default('UPLOADING').notNull(),
	scanResult: jsonb(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
	deletedAt: timestamp({ withTimezone: true, mode: 'date' }),
	deletedBy: varchar(),
}, (table) => [
	index("ix_tenant_template_chatFile_chatId").using("btree", table.chatId.asc().nullsLast().op("uuid_ops")),
	index("ix_tenant_template_chatFile_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	index("ix_tenant_template_chatFile_uploaderEndUserId").using("btree", table.uploaderEndUserId.asc().nullsLast().op("text_ops")),
	index("ix_tenant_template_chatFile_uploaderOperatorId").using("btree", table.uploaderOperatorId.asc().nullsLast().op("uuid_ops")),
	check("check_exactly_one_uploader", sql`((("uploaderOperatorId" IS NOT NULL))::integer + (("uploaderEndUserId" IS NOT NULL))::integer) = 1`),
]);

export const alembic_versionInTenant_template = tenant_template.table("alembic_version", {
	version_num: varchar({ length: 32 }).primaryKey().notNull(),
});

export const endUserInTenant_template = tenant_template.table("endUser", {
	userId: varchar().primaryKey().notNull(),
	displayName: varchar(),
	pictureUrl: varchar(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
}, (table) => [
	unique("endUser_userId_key").on(table.userId),
]);

export const tagsInTenant_template = tenant_template.table("tags", {
	id: uuid().primaryKey().notNull(),
	name: varchar({ length: 256 }).notNull(),
	isActive: boolean().default(true).notNull(),
	archivedBy: varchar(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
}, (table) => [
	index("idx_tags_name_lower").using("btree", sql`lower((name)::text)`),
	index("ix_tags_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
]);

export const chatTagsInTenant_template = tenant_template.table("chatTags", {
	id: uuid().primaryKey().notNull(),
	chatId: uuid().notNull(),
	tagId: uuid().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
	index("ix_chatTags_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chatInTenant_template.id],
			name: "chatTags_chatId_fkey"
		}),
	foreignKey({
			columns: [table.tagId],
			foreignColumns: [tagsInTenant_template.id],
			name: "chatTags_tagId_fkey"
		}),
]);

export const storeTeamInTenant_template = tenant_template.table("storeTeam", {
	id: uuid().primaryKey().notNull(),
	storeId: uuid().notNull(),
	teamId: uuid().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
	index("ix_storeTeam_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.storeId],
			foreignColumns: [storeInTenant_template.id],
			name: "storeTeam_storeId_fkey"
		}),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teamInTenant_template.id],
			name: "storeTeam_teamId_fkey"
		}),
]);

export const chatTeamAssignmentInTenant_template = tenant_template.table("chatTeamAssignment", {
	id: uuid().primaryKey().notNull(),
	chatId: uuid().notNull(),
	teamId: uuid().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
	index("ix_chatTeamAssignment_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chatInTenant_template.id],
			name: "chatTeamAssignment_chatId_fkey"
		}),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teamInTenant_template.id],
			name: "chatTeamAssignment_teamId_fkey"
		}),
]);

export const teamInTenant_template = tenant_template.table("team", {
	id: uuid().primaryKey().notNull(),
	name: varchar().notNull(),
	archivedBy: varchar(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
	isDefault: boolean().default(false).notNull(),
	isActive: boolean().default(true).notNull(),
}, (table) => [
	index("idx_team_name_lower").using("btree", sql`lower((name)::text)`),
	index("ix_team_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
]);

export const userInTenant_template = tenant_template.table("user", {
	id: uuid().primaryKey().notNull(),
	pictureUrl: varchar(),
	roleType: roletypeInTenant_template().default('OPERATOR').notNull(),
	archivedBy: varchar(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
	displayName: varchar().notNull(),
	senderName: varchar(),
}, (table) => [
	foreignKey({
			columns: [table.id],
			foreignColumns: [auth.id],
			name: "fk_user_auth_id"
		}),
]);

export const noteInTenant_template = tenant_template.table("note", {
	id: uuid().primaryKey().notNull(),
	userId: uuid().notNull(),
	chatId: uuid().notNull(),
	noteValue: text().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
	isActive: boolean().default(true).notNull(),
	noteValueEncrypted: bytea("noteValueEncrypted"),
	isEncrypted: boolean().default(false).notNull(),
}, (table) => [
	index("idx_note_chat_active").using("btree", table.chatId.asc().nullsLast().op("uuid_ops")).where(sql`("isActive" = true)`),
	index("ix_note_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chatInTenant_template.id],
			name: "note_chatId_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userInTenant_template.id],
			name: "note_userId_fkey"
		}),
]);

export const chatAttributeValueInTenant_template = tenant_template.table("chatAttributeValue", {
	id: uuid().primaryKey().notNull(),
	userId: uuid().notNull(),
	chatId: uuid().notNull(),
	attributeId: uuid().notNull(),
	value: varchar().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
	valueEncrypted: bytea("valueEncrypted"),
	isEncrypted: boolean().default(false).notNull(),
}, (table) => [
	index("ix_chatAttributeValue_attributeId").using("btree", table.attributeId.asc().nullsLast().op("uuid_ops")),
	index("ix_chatAttributeValue_chatId").using("btree", table.chatId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.attributeId],
			foreignColumns: [attributeInTenant_template.id],
			name: "chatAttributeValue_attributeId_fkey"
		}),
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chatInTenant_template.id],
			name: "chatAttributeValue_chatId_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userInTenant_template.id],
			name: "chatAttributeValue_userId_fkey"
		}),
	unique("chat_attribute_uq").on(table.attributeId, table.chatId),
]);

export const chatActivityInTenant_template = tenant_template.table("chatActivity", {
	id: uuid().primaryKey().notNull(),
	chatId: uuid().notNull(),
	activityType: activitytypeInTenant_template().notNull(),
	actorType: chatactivityactortypeInTenant_template().notNull(),
	actorId: uuid(),
	oldStatus: chatstatusInTenant_template(),
	newStatus: chatstatusInTenant_template(),
	oldUserId: uuid(),
	newUserId: uuid(),
	oldUserName: varchar(),
	newUserName: varchar(),
	oldTeamIds: varchar(),
	newTeamIds: varchar(),
	oldTeamNames: varchar(),
	newTeamNames: varchar(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	actorUserName: varchar(),
}, (table) => [
	index("idx_chat_activity_chat_created").using("btree", table.chatId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_chat_activity_type_created").using("btree", table.activityType.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("enum_ops")),
	index("ix_chatActivity_chatId").using("btree", table.chatId.asc().nullsLast().op("uuid_ops")),
	index("ix_chatActivity_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chatInTenant_template.id],
			name: "chatActivity_chatId_fkey"
		}),
	foreignKey({
			columns: [table.actorId],
			foreignColumns: [userInTenant_template.id],
			name: "chatActivity_actorId_fkey"
		}),
	foreignKey({
			columns: [table.oldUserId],
			foreignColumns: [userInTenant_template.id],
			name: "chatActivity_oldUserId_fkey"
		}),
	foreignKey({
			columns: [table.newUserId],
			foreignColumns: [userInTenant_template.id],
			name: "chatActivity_newUserId_fkey"
		}),
]);

export const teamSettingInTenant_template = tenant_template.table("teamSetting", {
	id: uuid().primaryKey().notNull(),
	teamId: uuid().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
	index("ix_teamSetting_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teamInTenant_template.id],
			name: "teamSetting_teamId_fkey"
		}),
	unique("teamSetting_teamId_key").on(table.teamId),
]);

export const teamChatSettingInTenant_template = tenant_template.table("teamChatSetting", {
	id: uuid().primaryKey().notNull(),
	teamSettingId: uuid().notNull(),
	viewAllChatsEnabled: boolean().default(true).notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
}, (table) => [
	index("ix_teamChatSetting_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.teamSettingId],
			foreignColumns: [teamSettingInTenant_template.id],
			name: "teamChatSetting_teamSettingId_fkey"
		}),
	unique("teamChatSetting_teamSettingId_key").on(table.teamSettingId),
]);

export const pushSubscriptionInTenant_template = tenant_template.table("pushSubscription", {
	id: uuid().primaryKey().notNull(),
	userId: uuid().notNull(),
	endpoint: varchar().notNull(),
	p256dh: varchar().notNull(),
	auth: varchar().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	token: varchar().notNull(),
}, (table) => [
	index("ix_pushSubscription_endpoint").using("btree", table.endpoint.asc().nullsLast().op("text_ops")),
	index("ix_pushSubscription_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userInTenant_template.id],
			name: "pushSubscription_userId_fkey"
		}),
	unique("uq_pushSubscription_endpoint").on(table.endpoint),
]);

export const storeInTenant_template = tenant_template.table("store", {
	id: uuid().primaryKey().notNull(),
	liglaStoreId: integer().notNull(),
	name: varchar().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
	deletedAt: timestamp({ withTimezone: true, mode: 'date' }),
	isActive: boolean().default(true).notNull(),
	note: varchar(),
	typeName: varchar(),
	areaName: varchar(),
	startsAt: timestamp({ withTimezone: true, mode: 'date' }),
	endsAt: timestamp({ withTimezone: true, mode: 'date' }),
}, (table) => [
	index("ix_store_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
]);

export const chatAssignFilterInTenant_template = tenant_template.table("chatAssignFilter", {
	id: uuid().primaryKey().notNull(),
	name: varchar().notNull(),
	targetTable: varchar().notNull(),
	note: varchar(),
	isActive: boolean().default(true).notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
}, (table) => [
	index("ix_chatAssignFilter_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
]);

export const chatAssignRuleInTenant_template = tenant_template.table("chatAssignRule", {
	id: uuid().primaryKey().notNull(),
	name: varchar().notNull(),
	note: varchar(),
	isActive: boolean().default(true).notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
}, (table) => [
	index("ix_chatAssignRule_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
]);

export const chatAssignRuleTargetTeamInTenant_template = tenant_template.table("chatAssignRuleTargetTeam", {
	id: uuid().primaryKey().notNull(),
	ruleId: uuid().notNull(),
	teamId: uuid().notNull(),
}, (table) => [
	index("ix_chatAssignRuleTargetTeam_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	index("ix_chat_assign_rule_target_rule_team").using("btree", table.ruleId.asc().nullsLast().op("uuid_ops"), table.teamId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.ruleId],
			foreignColumns: [chatAssignRuleInTenant_template.id],
			name: "chatAssignRuleTargetTeam_ruleId_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teamInTenant_template.id],
			name: "chatAssignRuleTargetTeam_teamId_fkey"
		}).onDelete("cascade"),
	unique("uq_chat_assign_rule_team_unique").on(table.ruleId, table.teamId),
]);

export const chatAssignFilterGroupItemInTenant_template = tenant_template.table("chatAssignFilterGroupItem", {
	id: uuid().primaryKey().notNull(),
	groupId: uuid().notNull(),
	filterId: uuid().notNull(),
}, (table) => [
	index("ix_chatAssignFilterGroupItem_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	index("ix_fg_item_group_filter").using("btree", table.groupId.asc().nullsLast().op("uuid_ops"), table.filterId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.filterId],
			foreignColumns: [chatAssignFilterInTenant_template.id],
			name: "chatAssignFilterGroupItem_filterId_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.groupId],
			foreignColumns: [chatAssignFilterGroupInTenant_template.id],
			name: "chatAssignFilterGroupItem_groupId_fkey"
		}).onDelete("cascade"),
]);

export const selectOptionInTenant_template = tenant_template.table("selectOption", {
	id: uuid().primaryKey().notNull(),
	attributeId: uuid().notNull(),
	value: varchar().notNull(),
	label: varchar(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
}, (table) => [
	index("ix_selectOption_attributeId").using("btree", table.attributeId.asc().nullsLast().op("uuid_ops")),
	index("ix_selectOption_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.attributeId],
			foreignColumns: [attributeInTenant_template.id],
			name: "selectOption_attributeId_fkey"
		}),
	unique("uq_attribute_option").on(table.attributeId, table.value),
]);

export const attributeInTenant_template = tenant_template.table("attribute", {
	id: uuid().primaryKey().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	name: varchar().notNull(),
	isActive: boolean().default(true).notNull(),
	type: attributetypeInTenant_template().default('string').notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	chatId: uuid(),
	isEncryptionEnabled: boolean().default(false).notNull(),
}, (table) => [
	index("idx_attribute_name_lower").using("btree", sql`lower((name)::text)`),
	index("ix_attribute_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chatInTenant_template.id],
			name: "attribute_chatid_fkey"
		}),
]);

export const organizationSettingsInTenant_template = tenant_template.table("organizationSettings", {
	type: varchar().primaryKey().notNull(),
	memberFeedSurveyColumnSettings: jsonb().default({}).notNull(),
	chatReplySettings: jsonb(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
	syncedAt: timestamp({ withTimezone: true, mode: 'date' }),
}, (table) => [
	check("type_check", sql`(type)::text = ANY ((ARRAY['memberFeed'::character varying, 'survey'::character varying, 'chatReply'::character varying])::text[])`),
]);

export const surveyDataInTenant_template = tenant_template.table("surveyData", {
	endUserId: varchar({ length: 255 }).primaryKey().notNull(),
	clientUserId: varchar({ length: 255 }),
	userSurvey: json().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
}, (table) => [
	index("ix_surveyData_client_user").using("btree", table.clientUserId.asc().nullsLast().op("text_ops")),
	index("ix_surveyData_end_user").using("btree", table.endUserId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.endUserId],
			foreignColumns: [endUserInTenant_template.userId],
			name: "surveyData_endUserId_fkey"
		}),
]);

export const memberFeedDataInTenant_template = tenant_template.table("memberFeedData", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	clientUserId: varchar({ length: 255 }).notNull(),
	lineUserId: varchar({ length: 255 }),
	category1: varchar({ length: 255 }),
	category2: varchar({ length: 255 }),
	category3: varchar({ length: 255 }),
	category4: varchar({ length: 255 }),
	category5: varchar({ length: 255 }),
	category6: varchar({ length: 255 }),
	category7: varchar({ length: 255 }),
	category8: varchar({ length: 255 }),
	category9: varchar({ length: 255 }),
	category10: varchar({ length: 255 }),
	category11: varchar({ length: 255 }),
	category12: varchar({ length: 255 }),
	category13: varchar({ length: 255 }),
	category14: varchar({ length: 255 }),
	category15: varchar({ length: 255 }),
	category16: varchar({ length: 255 }),
	category17: varchar({ length: 255 }),
	category18: varchar({ length: 255 }),
	category19: varchar({ length: 255 }),
	category20: varchar({ length: 255 }),
	category21: varchar({ length: 255 }),
	category22: varchar({ length: 255 }),
	category23: varchar({ length: 255 }),
	category24: varchar({ length: 255 }),
	category25: varchar({ length: 255 }),
	number1: integer(),
	number2: integer(),
	number3: integer(),
	number4: integer(),
	number5: integer(),
	number6: integer(),
	number7: integer(),
	number8: integer(),
	number9: integer(),
	number10: integer(),
	number11: integer(),
	number12: integer(),
	number13: integer(),
	number14: integer(),
	number15: integer(),
	datetime1: timestamp({ withTimezone: true, mode: 'date' }),
	datetime2: timestamp({ withTimezone: true, mode: 'date' }),
	datetime3: timestamp({ withTimezone: true, mode: 'date' }),
	datetime4: timestamp({ withTimezone: true, mode: 'date' }),
	datetime5: timestamp({ withTimezone: true, mode: 'date' }),
	datetime6: timestamp({ withTimezone: true, mode: 'date' }),
	datetime7: timestamp({ withTimezone: true, mode: 'date' }),
	datetime8: timestamp({ withTimezone: true, mode: 'date' }),
	datetime9: timestamp({ withTimezone: true, mode: 'date' }),
	datetime10: timestamp({ withTimezone: true, mode: 'date' }),
	datetime11: timestamp({ withTimezone: true, mode: 'date' }),
	datetime12: timestamp({ withTimezone: true, mode: 'date' }),
	datetime13: timestamp({ withTimezone: true, mode: 'date' }),
	datetime14: timestamp({ withTimezone: true, mode: 'date' }),
	datetime15: timestamp({ withTimezone: true, mode: 'date' }),
	importedAt: timestamp({ withTimezone: true, mode: 'date' }),
	syncedAt: timestamp({ withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
}, (table) => [
	index("ix_memberFeedData_client_user").using("btree", table.clientUserId.asc().nullsLast().op("text_ops")),
]);

export const chatMessageInTenant_template = tenant_template.table("chatMessage", {
	id: uuid().primaryKey().notNull(),
	chatId: uuid().notNull(),
	senderId: varchar({ length: 50 }).notNull(),
	senderType: sendertypeInTenant_template().notNull(),
	content: jsonb().notNull(),
	previewImageUrl: varchar(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	isDelivered: boolean().notNull(),
	messageId: varchar(),
	isUnsent: boolean().default(false).notNull(),
	contentUrl: varchar(),
	duration: integer(),
	latitude: doublePrecision(),
	longitude: doublePrecision(),
	type: contenttypeInTenant_template().default('TEXT').notNull(),
	quoteToken: varchar(),
	quotedMessageId: varchar(),
	sentMethod: sentmethodInTenant_template(),
	deliveryDetails: jsonb(),
	markAsReadToken: varchar(),
	contentEncrypted: bytea("contentEncrypted"),
	isEncrypted: boolean().default(false).notNull(),
}, (table) => [
	index("idx_chat_message_chat_created").using("btree", table.chatId.asc().nullsLast().op("uuid_ops"), table.createdAt.asc().nullsLast().op("uuid_ops")),
	index("idx_chat_message_content").using("gin", table.content.asc().nullsLast().op("jsonb_ops")),
	index("idx_chat_message_sender").using("btree", table.senderId.asc().nullsLast().op("text_ops")),
	index("idx_chat_message_type").using("btree", table.type.asc().nullsLast().op("enum_ops")),
	index("idx_chat_message_unsent").using("btree", table.isUnsent.asc().nullsLast().op("bool_ops")),
	index("ix_chatMessage_chatId").using("btree", table.chatId.asc().nullsLast().op("uuid_ops")),
	index("ix_chatMessage_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	index("ix_chatMessage_messageId").using("btree", table.messageId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chatInTenant_template.id],
			name: "chatMessage_chatId_fkey"
		}),
]);

export const chatReplyMessageTemplateInTenant_template = tenant_template.table("chatReplyMessageTemplate", {
	id: uuid().primaryKey().notNull(),
	type: contenttypeInTenant_template().notNull(),
	content: jsonb().notNull(),
	contentUrl: varchar(),
	previewImageUrl: varchar(),
	updatedBy: varchar(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
});

export const chatInTenant_template = tenant_template.table("chat", {
	id: uuid().primaryKey().notNull(),
	endUserId: varchar().notNull(),
	assignedUserId: uuid(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	chatStatus: chatstatusInTenant_template().default('PENDING').notNull(),
	isManuallyAssigned: boolean().default(false).notNull(),
	latestMessageTimestamp: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	latestActivityAt: timestamp({ withTimezone: true, mode: 'date' }),
	latestReadTimestamp: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	sessionActive: boolean().default(true).notNull(),
	isUserBlocked: boolean().default(false).notNull(),
	clientUserId: varchar({ length: 255 }),
}, (table) => [
	index("ix_chat_clientUserId").using("btree", table.clientUserId.asc().nullsLast().op("text_ops")),
	index("ix_chat_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.endUserId],
			foreignColumns: [endUserInTenant_template.userId],
			name: "chat_endUserId_fkey"
		}),
	foreignKey({
			columns: [table.assignedUserId],
			foreignColumns: [userInTenant_template.id],
			name: "chat_assignedUserId_fkey"
		}),
	unique("uq_chat_clientUserId").on(table.clientUserId),
]);

export const chatAssignFilterGroupInTenant_template = tenant_template.table("chatAssignFilterGroup", {
	id: uuid().primaryKey().notNull(),
	ruleId: uuid().notNull(),
	logicalOperator: logicaloperatorInTenant_template().default('AND').notNull(),
	isRoot: boolean().default(false).notNull(),
}, (table) => [
	index("ix_chatAssignFilterGroup_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	index("ix_chatAssignFilterGroup_ruleId").using("btree", table.ruleId.asc().nullsLast().op("uuid_ops")),
	index("ix_filter_group_rule").using("btree", table.ruleId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("uq_rule_single_root").using("btree", table.ruleId.asc().nullsLast().op("uuid_ops")).where(sql`("isRoot" = true)`),
	foreignKey({
			columns: [table.ruleId],
			foreignColumns: [chatAssignRuleInTenant_template.id],
			name: "chatAssignFilterGroup_ruleId_fkey"
		}).onDelete("cascade"),
	unique("uq_filter_group_id_rule").on(table.id, table.ruleId),
]);

export const chatAssignConditionGroupInTenant_template = tenant_template.table("chatAssignConditionGroup", {
	id: uuid().primaryKey().notNull(),
	filterId: uuid().notNull(),
	logicalOperator: logicaloperatorInTenant_template().default('AND').notNull(),
	isRoot: boolean().default(false).notNull(),
}, (table) => [
	index("ix_chatAssignConditionGroup_filterId").using("btree", table.filterId.asc().nullsLast().op("uuid_ops")),
	index("ix_chatAssignConditionGroup_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	index("ix_condition_group_filter").using("btree", table.filterId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("uq_filter_single_root").using("btree", table.filterId.asc().nullsLast().op("uuid_ops")).where(sql`("isRoot" = true)`),
	foreignKey({
			columns: [table.filterId],
			foreignColumns: [chatAssignFilterInTenant_template.id],
			name: "chatAssignConditionGroup_filterId_fkey"
		}).onDelete("cascade"),
	unique("uq_condition_group_id_filter").on(table.filterId, table.id),
]);

export const chatAssignConditionInTenant_template = tenant_template.table("chatAssignCondition", {
	id: uuid().primaryKey().notNull(),
	groupId: uuid().notNull(),
	field: varchar().notNull(),
	operator: conditionoperatorInTenant_template().notNull(),
	value: varchar(),
	valueType: valuetypeInTenant_template().notNull(),
}, (table) => [
	index("ix_chatAssignCondition_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	index("ix_chat_assign_condition_group").using("btree", table.groupId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.groupId],
			foreignColumns: [chatAssignConditionGroupInTenant_template.id],
			name: "chatAssignCondition_groupId_fkey"
		}).onDelete("cascade"),
]);

export const userTeamInTenant_template = tenant_template.table("userTeam", {
	teamId: uuid().notNull(),
	userId: uuid().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teamInTenant_template.id],
			name: "userTeam_teamId_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userInTenant_template.id],
			name: "userTeam_userId_fkey"
		}),
	primaryKey({ columns: [table.teamId, table.userId], name: "userTeam_pkey"}),
]);

export const chatAttributeValueSelectOptionInTenant_template = tenant_template.table("chatAttributeValueSelectOption", {
	selectOptionId: uuid().notNull(),
	chatAttributeValueId: uuid().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
	index("ix_chatAttributeValueSelectOption_chatAttributeValueId").using("btree", table.chatAttributeValueId.asc().nullsLast().op("uuid_ops")),
	index("ix_chatAttributeValueSelectOption_selectOptionId").using("btree", table.selectOptionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.chatAttributeValueId],
			foreignColumns: [chatAttributeValueInTenant_template.id],
			name: "chatAttributeValueSelectOption_chatAttributeValueId_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.selectOptionId],
			foreignColumns: [selectOptionInTenant_template.id],
			name: "chatAttributeValueSelectOption_selectOptionId_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.chatAttributeValueId, table.selectOptionId], name: "pk_chat_attr_value_select_option"}),
]);

export const chatAssignConditionGroupClosureInTenant_template = tenant_template.table("chatAssignConditionGroupClosure", {
	filterId: uuid().notNull(),
	ancestorGroupId: uuid().notNull(),
	descendantGroupId: uuid().notNull(),
	depth: integer().notNull(),
}, (table) => [
	index("ix_cl_filter_ancestor_depth").using("btree", table.filterId.asc().nullsLast().op("uuid_ops"), table.ancestorGroupId.asc().nullsLast().op("int4_ops"), table.depth.asc().nullsLast().op("int4_ops")),
	index("ix_cl_filter_descendant").using("btree", table.filterId.asc().nullsLast().op("uuid_ops"), table.descendantGroupId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.filterId, table.ancestorGroupId],
			foreignColumns: [chatAssignConditionGroupInTenant_template.id, chatAssignConditionGroupInTenant_template.filterId],
			name: "fk_cg_cl_ancestor"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.filterId, table.descendantGroupId],
			foreignColumns: [chatAssignConditionGroupInTenant_template.id, chatAssignConditionGroupInTenant_template.filterId],
			name: "fk_cg_cl_descendant"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.filterId],
			foreignColumns: [chatAssignFilterInTenant_template.id],
			name: "chatAssignConditionGroupClosure_filterId_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.ancestorGroupId, table.descendantGroupId], name: "pk_condition_group_closure"}),
	check("ck_cg_depth_non_negative", sql`depth >= 0`),
]);

export const chatAssignFilterGroupClosureInTenant_template = tenant_template.table("chatAssignFilterGroupClosure", {
	ruleId: uuid().notNull(),
	ancestorGroupId: uuid().notNull(),
	descendantGroupId: uuid().notNull(),
	depth: integer().notNull(),
}, (table) => [
	index("ix_cl_rule_ancestor_depth").using("btree", table.ruleId.asc().nullsLast().op("uuid_ops"), table.ancestorGroupId.asc().nullsLast().op("int4_ops"), table.depth.asc().nullsLast().op("int4_ops")),
	index("ix_cl_rule_descendant").using("btree", table.ruleId.asc().nullsLast().op("uuid_ops"), table.descendantGroupId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.ruleId, table.ancestorGroupId],
			foreignColumns: [chatAssignFilterGroupInTenant_template.id, chatAssignFilterGroupInTenant_template.ruleId],
			name: "fk_fg_cl_ancestor"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.ruleId, table.descendantGroupId],
			foreignColumns: [chatAssignFilterGroupInTenant_template.id, chatAssignFilterGroupInTenant_template.ruleId],
			name: "fk_fg_cl_descendant"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.ruleId],
			foreignColumns: [chatAssignRuleInTenant_template.id],
			name: "chatAssignFilterGroupClosure_ruleId_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.ancestorGroupId, table.descendantGroupId], name: "pk_filter_group_closure"}),
	check("ck_fg_depth_non_negative", sql`depth >= 0`),
]);

export const chatUserReadInTenant_template = tenant_template.table("chatUserRead", {
	chatId: uuid().notNull(),
	userId: uuid().notNull(),
	readTimestamp: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
}, (table) => [
	index("idx_chat_user_read_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chatInTenant_template.id],
			name: "chatUserRead_chatId_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userInTenant_template.id],
			name: "chatUserRead_userId_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.chatId, table.userId], name: "chatUserRead_pkey"}),
]);
