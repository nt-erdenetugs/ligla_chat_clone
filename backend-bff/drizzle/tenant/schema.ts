import { varchar, uniqueIndex, index, uuid, timestamp, integer, foreignKey, text, boolean, jsonb, pgSchema, check, bigint, unique, json, doublePrecision, primaryKey } from "drizzle-orm/pg-core"
import { auth } from "../public/schema"
import { sql } from "drizzle-orm"
import { bytea } from "../types"

export function createTenantTables(schemaName: string) {
  const s = pgSchema(schemaName);

  const activitytype = s.enum("activitytype", ['STATUS_CHANGE', 'USER_CHANGE', 'TEAMS_CHANGE', 'END_SESSION', 'USER_FOLLOWED', 'USER_UNFOLLOWED', 'USER_FOLLOWED_NEW', 'USER_ADDED', 'SESSION_TIMEOUT'])

  const attributetype = s.enum("attributetype", ['string', 'number', 'boolean', 'selection', 'calendar', 'time', 'datetime', 'date'])

  const chatStatus = s.enum("chatStatus", ['PENDING', 'ADDRESSING', 'DONE'])

  const chatactivityactortype = s.enum("chatactivityactortype", ['USER', 'SYSTEM'])

  const chatstatus = s.enum("chatstatus", ['PENDING', 'ADDRESSING', 'DONE'])

  const conditionoperator = s.enum("conditionoperator", ['EQUAL', 'NOT_EQUAL', 'INCLUDE', 'NOT_INCLUDE', 'REGEX', 'NULL', 'NOT_NULL', 'GT', 'LT', 'GTE', 'LTE', 'VALUES_MATCH_ANY', 'VALUES_DO_NOT_MATCH_ANY'])

  const contenttype = s.enum("contenttype", ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'LOCATION', 'STICKER'])

  const filefolder = s.enum("filefolder", ['PENDING', 'PROCESSED', 'FAILED'])

  const filestatus = s.enum("filestatus", ['UPLOADING', 'PENDING_SCAN', 'SCANNED', 'VIRUS_DETECTED', 'DELETED'])

  const filetype = s.enum("filetype", ['DOCUMENT', 'IMAGE', 'VIDEO', 'AUDIO', 'ARCHIVE'])

  const logicaloperator = s.enum("logicaloperator", ['AND', 'OR'])

  const roletype = s.enum("roletype", ['ADMIN', 'ADMIN_OPERATOR', 'MANAGER', 'MANAGER_OPERATOR', 'OPERATOR'])

  const sendertype = s.enum("sendertype", ['END_USER', 'OPERATOR', 'SYSTEM'])

  const sentmethod = s.enum("sentmethod", ['push', 'reply'])

  const userstatus = s.enum("userstatus", ['ACTIVE', 'INACTIVE', 'PENDING', 'LOCKED'])

  const valuetype = s.enum("valuetype", ['STRING', 'NUMBER', 'ARRAY', 'BOOLEAN', 'DATETIME'])

  const chatFile = s.table("chatFile", {
  	id: uuid().primaryKey().notNull(),
  	chatId: uuid().notNull(),
  	uploaderOperatorId: uuid(),
  	uploaderEndUserId: varchar(),
  	fileName: varchar().notNull(),
  	originalFileName: varchar().notNull(),
  	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
  	fileSize: bigint({ mode: "number" }).notNull(),
  	mimeType: varchar().notNull(),
  	fileType: filetype().notNull(),
  	gcsObjectKey: varchar().notNull(),
  	storageFolder: filefolder().default('PENDING').notNull(),
  	status: filestatus().default('UPLOADING').notNull(),
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
  const endUser = s.table("endUser", {
  	userId: varchar().primaryKey().notNull(),
  	displayName: varchar(),
  	pictureUrl: varchar(),
  	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
  }, (table) => [
  	unique("endUser_userId_key").on(table.userId),
  ]);
  const tags = s.table("tags", {
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
  const chatTags = s.table("chatTags", {
  	id: uuid().primaryKey().notNull(),
  	chatId: uuid().notNull(),
  	tagId: uuid().notNull(),
  	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  }, (table) => [
  	index("ix_chatTags_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
  	foreignKey({
  			columns: [table.chatId],
  			foreignColumns: [chat.id],
  			name: "chatTags_chatId_fkey"
  		}),
  	foreignKey({
  			columns: [table.tagId],
  			foreignColumns: [tags.id],
  			name: "chatTags_tagId_fkey"
  		}),
  ]);
  const storeTeam = s.table("storeTeam", {
  	id: uuid().primaryKey().notNull(),
  	storeId: uuid().notNull(),
  	teamId: uuid().notNull(),
  	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  }, (table) => [
  	index("ix_storeTeam_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
  	foreignKey({
  			columns: [table.storeId],
  			foreignColumns: [store.id],
  			name: "storeTeam_storeId_fkey"
  		}),
  	foreignKey({
  			columns: [table.teamId],
  			foreignColumns: [team.id],
  			name: "storeTeam_teamId_fkey"
  		}),
  ]);
  const chatTeamAssignment = s.table("chatTeamAssignment", {
  	id: uuid().primaryKey().notNull(),
  	chatId: uuid().notNull(),
  	teamId: uuid().notNull(),
  	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  }, (table) => [
  	index("ix_chatTeamAssignment_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
  	foreignKey({
  			columns: [table.chatId],
  			foreignColumns: [chat.id],
  			name: "chatTeamAssignment_chatId_fkey"
  		}),
  	foreignKey({
  			columns: [table.teamId],
  			foreignColumns: [team.id],
  			name: "chatTeamAssignment_teamId_fkey"
  		}),
  ]);
  const team = s.table("team", {
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
  const user = s.table("user", {
  	id: uuid().primaryKey().notNull(),
  	pictureUrl: varchar(),
  	roleType: roletype().default('OPERATOR').notNull(),
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
  const note = s.table("note", {
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
  			foreignColumns: [chat.id],
  			name: "note_chatId_fkey"
  		}),
  	foreignKey({
  			columns: [table.userId],
  			foreignColumns: [user.id],
  			name: "note_userId_fkey"
  		}),
  ]);
  const chatAttributeValue = s.table("chatAttributeValue", {
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
  			foreignColumns: [attribute.id],
  			name: "chatAttributeValue_attributeId_fkey"
  		}),
  	foreignKey({
  			columns: [table.chatId],
  			foreignColumns: [chat.id],
  			name: "chatAttributeValue_chatId_fkey"
  		}),
  	foreignKey({
  			columns: [table.userId],
  			foreignColumns: [user.id],
  			name: "chatAttributeValue_userId_fkey"
  		}),
  	unique("chat_attribute_uq").on(table.attributeId, table.chatId),
  ]);
  const chatActivity = s.table("chatActivity", {
  	id: uuid().primaryKey().notNull(),
  	chatId: uuid().notNull(),
  	activityType: activitytype().notNull(),
  	actorType: chatactivityactortype().notNull(),
  	actorId: uuid(),
  	oldStatus: chatstatus(),
  	newStatus: chatstatus(),
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
  			foreignColumns: [chat.id],
  			name: "chatActivity_chatId_fkey"
  		}),
  	foreignKey({
  			columns: [table.actorId],
  			foreignColumns: [user.id],
  			name: "chatActivity_actorId_fkey"
  		}),
  	foreignKey({
  			columns: [table.oldUserId],
  			foreignColumns: [user.id],
  			name: "chatActivity_oldUserId_fkey"
  		}),
  	foreignKey({
  			columns: [table.newUserId],
  			foreignColumns: [user.id],
  			name: "chatActivity_newUserId_fkey"
  		}),
  ]);
  const teamSetting = s.table("teamSetting", {
  	id: uuid().primaryKey().notNull(),
  	teamId: uuid().notNull(),
  	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  }, (table) => [
  	index("ix_teamSetting_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
  	foreignKey({
  			columns: [table.teamId],
  			foreignColumns: [team.id],
  			name: "teamSetting_teamId_fkey"
  		}),
  	unique("teamSetting_teamId_key").on(table.teamId),
  ]);
  const teamChatSetting = s.table("teamChatSetting", {
  	id: uuid().primaryKey().notNull(),
  	teamSettingId: uuid().notNull(),
  	viewAllChatsEnabled: boolean().default(true).notNull(),
  	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
  }, (table) => [
  	index("ix_teamChatSetting_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
  	foreignKey({
  			columns: [table.teamSettingId],
  			foreignColumns: [teamSetting.id],
  			name: "teamChatSetting_teamSettingId_fkey"
  		}),
  	unique("teamChatSetting_teamSettingId_key").on(table.teamSettingId),
  ]);
  const pushSubscription = s.table("pushSubscription", {
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
  			foreignColumns: [user.id],
  			name: "pushSubscription_userId_fkey"
  		}),
  	unique("uq_pushSubscription_endpoint").on(table.endpoint),
  ]);
  const store = s.table("store", {
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
  const chatAssignFilter = s.table("chatAssignFilter", {
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
  const chatAssignRule = s.table("chatAssignRule", {
  	id: uuid().primaryKey().notNull(),
  	name: varchar().notNull(),
  	note: varchar(),
  	isActive: boolean().default(true).notNull(),
  	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
  }, (table) => [
  	index("ix_chatAssignRule_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
  ]);
  const chatAssignRuleTargetTeam = s.table("chatAssignRuleTargetTeam", {
  	id: uuid().primaryKey().notNull(),
  	ruleId: uuid().notNull(),
  	teamId: uuid().notNull(),
  }, (table) => [
  	index("ix_chatAssignRuleTargetTeam_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
  	index("ix_chat_assign_rule_target_rule_team").using("btree", table.ruleId.asc().nullsLast().op("uuid_ops"), table.teamId.asc().nullsLast().op("uuid_ops")),
  	foreignKey({
  			columns: [table.ruleId],
  			foreignColumns: [chatAssignRule.id],
  			name: "chatAssignRuleTargetTeam_ruleId_fkey"
  		}).onDelete("cascade"),
  	foreignKey({
  			columns: [table.teamId],
  			foreignColumns: [team.id],
  			name: "chatAssignRuleTargetTeam_teamId_fkey"
  		}).onDelete("cascade"),
  	unique("uq_chat_assign_rule_team_unique").on(table.ruleId, table.teamId),
  ]);
  const chatAssignFilterGroupItem = s.table("chatAssignFilterGroupItem", {
  	id: uuid().primaryKey().notNull(),
  	groupId: uuid().notNull(),
  	filterId: uuid().notNull(),
  }, (table) => [
  	index("ix_chatAssignFilterGroupItem_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
  	index("ix_fg_item_group_filter").using("btree", table.groupId.asc().nullsLast().op("uuid_ops"), table.filterId.asc().nullsLast().op("uuid_ops")),
  	foreignKey({
  			columns: [table.filterId],
  			foreignColumns: [chatAssignFilter.id],
  			name: "chatAssignFilterGroupItem_filterId_fkey"
  		}).onDelete("cascade"),
  	foreignKey({
  			columns: [table.groupId],
  			foreignColumns: [chatAssignFilterGroup.id],
  			name: "chatAssignFilterGroupItem_groupId_fkey"
  		}).onDelete("cascade"),
  ]);
  const selectOption = s.table("selectOption", {
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
  			foreignColumns: [attribute.id],
  			name: "selectOption_attributeId_fkey"
  		}),
  	unique("uq_attribute_option").on(table.attributeId, table.value),
  ]);
  const attribute = s.table("attribute", {
  	id: uuid().primaryKey().notNull(),
  	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  	name: varchar().notNull(),
  	isActive: boolean().default(true).notNull(),
  	type: attributetype().default('string').notNull(),
  	updatedAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
  	chatId: uuid(),
  	isEncryptionEnabled: boolean().default(false).notNull(),
  }, (table) => [
  	index("idx_attribute_name_lower").using("btree", sql`lower((name)::text)`),
  	index("ix_attribute_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
  	foreignKey({
  			columns: [table.chatId],
  			foreignColumns: [chat.id],
  			name: "attribute_chatid_fkey"
  		}),
  ]);
  const organizationSettings = s.table("organizationSettings", {
  	type: varchar().primaryKey().notNull(),
  	memberFeedSurveyColumnSettings: jsonb().default({}).notNull(),
  	chatReplySettings: jsonb(),
  	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
  	syncedAt: timestamp({ withTimezone: true, mode: 'date' }),
  }, (table) => [
  	check("type_check", sql`(type)::text = ANY ((ARRAY['memberFeed'::character varying, 'survey'::character varying, 'chatReply'::character varying])::text[])`),
  ]);
  const surveyData = s.table("surveyData", {
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
  			foreignColumns: [endUser.userId],
  			name: "surveyData_endUserId_fkey"
  		}),
  ]);
  const memberFeedData = s.table("memberFeedData", {
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
  const chatMessage = s.table("chatMessage", {
  	id: uuid().primaryKey().notNull(),
  	chatId: uuid().notNull(),
  	senderId: varchar({ length: 50 }).notNull(),
  	senderType: sendertype().notNull(),
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
  	type: contenttype().default('TEXT').notNull(),
  	quoteToken: varchar(),
  	quotedMessageId: varchar(),
  	sentMethod: sentmethod(),
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
  			foreignColumns: [chat.id],
  			name: "chatMessage_chatId_fkey"
  		}),
  ]);
  const chatReplyMessageTemplate = s.table("chatReplyMessageTemplate", {
  	id: uuid().primaryKey().notNull(),
  	type: contenttype().notNull(),
  	content: jsonb().notNull(),
  	contentUrl: varchar(),
  	previewImageUrl: varchar(),
  	updatedBy: varchar(),
  	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
  });
  const chat = s.table("chat", {
  	id: uuid().primaryKey().notNull(),
  	endUserId: varchar().notNull(),
  	assignedUserId: uuid(),
  	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  	chatStatus: chatstatus().default('PENDING').notNull(),
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
  			foreignColumns: [endUser.userId],
  			name: "chat_endUserId_fkey"
  		}),
  	foreignKey({
  			columns: [table.assignedUserId],
  			foreignColumns: [user.id],
  			name: "chat_assignedUserId_fkey"
  		}),
  	unique("uq_chat_clientUserId").on(table.clientUserId),
  ]);
  const chatAssignFilterGroup = s.table("chatAssignFilterGroup", {
  	id: uuid().primaryKey().notNull(),
  	ruleId: uuid().notNull(),
  	logicalOperator: logicaloperator().default('AND').notNull(),
  	isRoot: boolean().default(false).notNull(),
  }, (table) => [
  	index("ix_chatAssignFilterGroup_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
  	index("ix_chatAssignFilterGroup_ruleId").using("btree", table.ruleId.asc().nullsLast().op("uuid_ops")),
  	index("ix_filter_group_rule").using("btree", table.ruleId.asc().nullsLast().op("uuid_ops")),
  	uniqueIndex("uq_rule_single_root").using("btree", table.ruleId.asc().nullsLast().op("uuid_ops")).where(sql`("isRoot" = true)`),
  	foreignKey({
  			columns: [table.ruleId],
  			foreignColumns: [chatAssignRule.id],
  			name: "chatAssignFilterGroup_ruleId_fkey"
  		}).onDelete("cascade"),
  	unique("uq_filter_group_id_rule").on(table.id, table.ruleId),
  ]);
  const chatAssignConditionGroup = s.table("chatAssignConditionGroup", {
  	id: uuid().primaryKey().notNull(),
  	filterId: uuid().notNull(),
  	logicalOperator: logicaloperator().default('AND').notNull(),
  	isRoot: boolean().default(false).notNull(),
  }, (table) => [
  	index("ix_chatAssignConditionGroup_filterId").using("btree", table.filterId.asc().nullsLast().op("uuid_ops")),
  	index("ix_chatAssignConditionGroup_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
  	index("ix_condition_group_filter").using("btree", table.filterId.asc().nullsLast().op("uuid_ops")),
  	uniqueIndex("uq_filter_single_root").using("btree", table.filterId.asc().nullsLast().op("uuid_ops")).where(sql`("isRoot" = true)`),
  	foreignKey({
  			columns: [table.filterId],
  			foreignColumns: [chatAssignFilter.id],
  			name: "chatAssignConditionGroup_filterId_fkey"
  		}).onDelete("cascade"),
  	unique("uq_condition_group_id_filter").on(table.filterId, table.id),
  ]);
  const chatAssignCondition = s.table("chatAssignCondition", {
  	id: uuid().primaryKey().notNull(),
  	groupId: uuid().notNull(),
  	field: varchar().notNull(),
  	operator: conditionoperator().notNull(),
  	value: varchar(),
  	valueType: valuetype().notNull(),
  }, (table) => [
  	index("ix_chatAssignCondition_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
  	index("ix_chat_assign_condition_group").using("btree", table.groupId.asc().nullsLast().op("uuid_ops")),
  	foreignKey({
  			columns: [table.groupId],
  			foreignColumns: [chatAssignConditionGroup.id],
  			name: "chatAssignCondition_groupId_fkey"
  		}).onDelete("cascade"),
  ]);
  const userTeam = s.table("userTeam", {
  	teamId: uuid().notNull(),
  	userId: uuid().notNull(),
  	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  }, (table) => [
  	foreignKey({
  			columns: [table.teamId],
  			foreignColumns: [team.id],
  			name: "userTeam_teamId_fkey"
  		}),
  	foreignKey({
  			columns: [table.userId],
  			foreignColumns: [user.id],
  			name: "userTeam_userId_fkey"
  		}),
  	primaryKey({ columns: [table.teamId, table.userId], name: "userTeam_pkey"}),
  ]);
  const chatAttributeValueSelectOption = s.table("chatAttributeValueSelectOption", {
  	selectOptionId: uuid().notNull(),
  	chatAttributeValueId: uuid().notNull(),
  	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  }, (table) => [
  	index("ix_chatAttributeValueSelectOption_chatAttributeValueId").using("btree", table.chatAttributeValueId.asc().nullsLast().op("uuid_ops")),
  	index("ix_chatAttributeValueSelectOption_selectOptionId").using("btree", table.selectOptionId.asc().nullsLast().op("uuid_ops")),
  	foreignKey({
  			columns: [table.chatAttributeValueId],
  			foreignColumns: [chatAttributeValue.id],
  			name: "chatAttributeValueSelectOption_chatAttributeValueId_fkey"
  		}).onDelete("cascade"),
  	foreignKey({
  			columns: [table.selectOptionId],
  			foreignColumns: [selectOption.id],
  			name: "chatAttributeValueSelectOption_selectOptionId_fkey"
  		}).onDelete("cascade"),
  	primaryKey({ columns: [table.chatAttributeValueId, table.selectOptionId], name: "pk_chat_attr_value_select_option"}),
  ]);
  const chatAssignConditionGroupClosure = s.table("chatAssignConditionGroupClosure", {
  	filterId: uuid().notNull(),
  	ancestorGroupId: uuid().notNull(),
  	descendantGroupId: uuid().notNull(),
  	depth: integer().notNull(),
  }, (table) => [
  	index("ix_cl_filter_ancestor_depth").using("btree", table.filterId.asc().nullsLast().op("uuid_ops"), table.ancestorGroupId.asc().nullsLast().op("int4_ops"), table.depth.asc().nullsLast().op("int4_ops")),
  	index("ix_cl_filter_descendant").using("btree", table.filterId.asc().nullsLast().op("uuid_ops"), table.descendantGroupId.asc().nullsLast().op("uuid_ops")),
  	foreignKey({
  			columns: [table.filterId, table.ancestorGroupId],
  			foreignColumns: [chatAssignConditionGroup.id, chatAssignConditionGroup.filterId],
  			name: "fk_cg_cl_ancestor"
  		}).onDelete("cascade"),
  	foreignKey({
  			columns: [table.filterId, table.descendantGroupId],
  			foreignColumns: [chatAssignConditionGroup.id, chatAssignConditionGroup.filterId],
  			name: "fk_cg_cl_descendant"
  		}).onDelete("cascade"),
  	foreignKey({
  			columns: [table.filterId],
  			foreignColumns: [chatAssignFilter.id],
  			name: "chatAssignConditionGroupClosure_filterId_fkey"
  		}).onDelete("cascade"),
  	primaryKey({ columns: [table.ancestorGroupId, table.descendantGroupId], name: "pk_condition_group_closure"}),
  	check("ck_cg_depth_non_negative", sql`depth >= 0`),
  ]);
  const chatAssignFilterGroupClosure = s.table("chatAssignFilterGroupClosure", {
  	ruleId: uuid().notNull(),
  	ancestorGroupId: uuid().notNull(),
  	descendantGroupId: uuid().notNull(),
  	depth: integer().notNull(),
  }, (table) => [
  	index("ix_cl_rule_ancestor_depth").using("btree", table.ruleId.asc().nullsLast().op("uuid_ops"), table.ancestorGroupId.asc().nullsLast().op("int4_ops"), table.depth.asc().nullsLast().op("int4_ops")),
  	index("ix_cl_rule_descendant").using("btree", table.ruleId.asc().nullsLast().op("uuid_ops"), table.descendantGroupId.asc().nullsLast().op("uuid_ops")),
  	foreignKey({
  			columns: [table.ruleId, table.ancestorGroupId],
  			foreignColumns: [chatAssignFilterGroup.id, chatAssignFilterGroup.ruleId],
  			name: "fk_fg_cl_ancestor"
  		}).onDelete("cascade"),
  	foreignKey({
  			columns: [table.ruleId, table.descendantGroupId],
  			foreignColumns: [chatAssignFilterGroup.id, chatAssignFilterGroup.ruleId],
  			name: "fk_fg_cl_descendant"
  		}).onDelete("cascade"),
  	foreignKey({
  			columns: [table.ruleId],
  			foreignColumns: [chatAssignRule.id],
  			name: "chatAssignFilterGroupClosure_ruleId_fkey"
  		}).onDelete("cascade"),
  	primaryKey({ columns: [table.ancestorGroupId, table.descendantGroupId], name: "pk_filter_group_closure"}),
  	check("ck_fg_depth_non_negative", sql`depth >= 0`),
  ]);
  const chatUserRead = s.table("chatUserRead", {
  	chatId: uuid().notNull(),
  	userId: uuid().notNull(),
  	readTimestamp: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
  }, (table) => [
  	index("idx_chat_user_read_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
  	foreignKey({
  			columns: [table.chatId],
  			foreignColumns: [chat.id],
  			name: "chatUserRead_chatId_fkey"
  		}).onDelete("cascade"),
  	foreignKey({
  			columns: [table.userId],
  			foreignColumns: [user.id],
  			name: "chatUserRead_userId_fkey"
  		}).onDelete("cascade"),
  	primaryKey({ columns: [table.chatId, table.userId], name: "chatUserRead_pkey"}),
  ]);

  return {
    chatFile,
    endUser,
    tags,
    chatTags,
    storeTeam,
    chatTeamAssignment,
    team,
    user,
    note,
    chatAttributeValue,
    chatActivity,
    teamSetting,
    teamChatSetting,
    pushSubscription,
    store,
    chatAssignFilter,
    chatAssignRule,
    chatAssignRuleTargetTeam,
    chatAssignFilterGroupItem,
    selectOption,
    attribute,
    organizationSettings,
    surveyData,
    memberFeedData,
    chatMessage,
    chatReplyMessageTemplate,
    chat,
    chatAssignFilterGroup,
    chatAssignConditionGroup,
    chatAssignCondition,
    userTeam,
    chatAttributeValueSelectOption,
    chatAssignConditionGroupClosure,
    chatAssignFilterGroupClosure,
    chatUserRead,
  };
}

export type TenantTables = ReturnType<typeof createTenantTables>;
