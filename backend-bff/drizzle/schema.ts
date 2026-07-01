import {
  pgTable,
  varchar,
  index,
  unique,
  uuid,
  timestamp,
  foreignKey,
  boolean,
  text,
  integer,
  jsonb,
  doublePrecision,
  uniqueIndex,
  primaryKey,
  check,
  json,
  bigint,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export * from './enums';
import {
  activitytype,
  attributetype,
  chatStatus,
  chatactivityactortype,
  chatstatus,
  conditionoperator,
  contenttype,
  logicaloperator,
  roletype,
  sendertype,
  userstatus,
  valuetype,
} from './enums';

export const alembic_version = pgTable('alembic_version', {
  version_num: varchar({ length: 32 }).primaryKey().notNull(),
});

export const hypervisorUser = pgTable(
  'hypervisorUser',
  {
    id: uuid().primaryKey().notNull(),
    email: varchar().notNull(),
    hashedPassword: varchar().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('ix_hypervisorUser_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
    unique('hypervisorUser_email_key').on(table.email),
  ],
);

export const endUser = pgTable(
  'endUser',
  {
    userId: varchar().primaryKey().notNull(),
    displayName: varchar(),
    pictureUrl: varchar(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
  },
  (table) => [unique('endUser_userId_key').on(table.userId)],
);

export const tags = pgTable(
  'tags',
  {
    id: uuid().primaryKey().notNull(),
    organizationName: varchar().notNull(),
    name: varchar({ length: 256 }).notNull(),
    isActive: boolean().default(true).notNull(),
    archivedBy: varchar(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('idx_tags_name_lower').using('btree', sql`lower((name)::text)`),
    index('ix_tags_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.organizationName],
      foreignColumns: [organization.name],
      name: 'tags_organizationName_fkey',
    }),
  ],
);

export const chatTags = pgTable(
  'chatTags',
  {
    id: uuid().primaryKey().notNull(),
    chatId: uuid().notNull(),
    tagId: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('ix_chatTags_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
      name: 'chatTags_chatId_fkey',
    }),
    foreignKey({
      columns: [table.tagId],
      foreignColumns: [tags.id],
      name: 'chatTags_tagId_fkey',
    }),
  ],
);

export const storeTeam = pgTable(
  'storeTeam',
  {
    id: uuid().primaryKey().notNull(),
    storeId: uuid().notNull(),
    teamId: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('ix_storeTeam_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.storeId],
      foreignColumns: [store.id],
      name: 'storeTeam_storeId_fkey',
    }),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [team.id],
      name: 'storeTeam_teamId_fkey',
    }),
  ],
);

export const chatTeamAssignment = pgTable(
  'chatTeamAssignment',
  {
    id: uuid().primaryKey().notNull(),
    chatId: uuid().notNull(),
    teamId: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('ix_chatTeamAssignment_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
      name: 'chatTeamAssignment_chatId_fkey',
    }),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [team.id],
      name: 'chatTeamAssignment_teamId_fkey',
    }),
  ],
);

export const team = pgTable(
  'team',
  {
    id: uuid().primaryKey().notNull(),
    organizationName: varchar().notNull(),
    name: varchar().notNull(),
    archivedBy: varchar(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
    isDefault: boolean().default(false).notNull(),
    isActive: boolean().default(true).notNull(),
  },
  (table) => [
    index('idx_team_name_lower').using('btree', sql`lower((name)::text)`),
    index('ix_team_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.organizationName],
      foreignColumns: [organization.name],
      name: 'team_organizationName_fkey',
    }),
  ],
);

export const organization = pgTable(
  'organization',
  {
    name: varchar().primaryKey().notNull(),
    displayName: varchar().notNull(),
    description: text(),
    maxOperator: integer().default(50),
    isActive: boolean().default(true).notNull(),
    archivedBy: varchar(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
    loginLiffId: varchar(),
    fileUploadLiffId: varchar(),
    apiKey: varchar().default('').notNull(),
  },
  (table) => [unique('organization_name_key').on(table.name)],
);

export const user = pgTable(
  'user',
  {
    id: uuid().primaryKey().notNull(),
    organizationName: varchar().notNull(),
    pictureUrl: varchar(),
    roleType: roletype().default('OPERATOR').notNull(),
    archivedBy: varchar(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
    displayName: varchar().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationName],
      foreignColumns: [organization.name],
      name: 'user_organizationName_fkey',
    }),
    foreignKey({
      columns: [table.id],
      foreignColumns: [auth.id],
      name: 'fk_user_auth_id',
    }),
  ],
);

export const userPasswordResetToken = pgTable(
  'userPasswordResetToken',
  {
    userId: uuid().primaryKey().notNull(),
    token: varchar().notNull(),
    expiresAt: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [auth.id],
      name: 'fk_userPasswordResetToken_userId',
    }),
  ],
);

export const note = pgTable(
  'note',
  {
    id: uuid().primaryKey().notNull(),
    organizationName: varchar().notNull(),
    userId: uuid().notNull(),
    chatId: uuid().notNull(),
    noteValue: text().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
    isActive: boolean().default(true).notNull(),
  },
  (table) => [
    index('ix_note_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
      name: 'note_chatId_fkey',
    }),
    foreignKey({
      columns: [table.organizationName],
      foreignColumns: [organization.name],
      name: 'note_organizationName_fkey',
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'note_userId_fkey',
    }),
  ],
);

export const chatAttributeValue = pgTable(
  'chatAttributeValue',
  {
    id: uuid().primaryKey().notNull(),
    userId: uuid().notNull(),
    chatId: uuid().notNull(),
    attributeId: uuid().notNull(),
    value: varchar().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('ix_chatAttributeValue_attributeId').using(
      'btree',
      table.attributeId.asc().nullsLast().op('uuid_ops'),
    ),
    index('ix_chatAttributeValue_chatId').using(
      'btree',
      table.chatId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.attributeId],
      foreignColumns: [attribute.id],
      name: 'chatAttributeValue_attributeId_fkey',
    }),
    foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
      name: 'chatAttributeValue_chatId_fkey',
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'chatAttributeValue_userId_fkey',
    }),
    unique('chat_attribute_uq').on(table.chatId, table.attributeId),
  ],
);

export const chatActivity = pgTable(
  'chatActivity',
  {
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
  },
  (table) => [
    index('idx_chat_activity_chat_created').using(
      'btree',
      table.chatId.asc().nullsLast().op('timestamptz_ops'),
      table.createdAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_chat_activity_type_created').using(
      'btree',
      table.activityType.asc().nullsLast().op('timestamptz_ops'),
      table.createdAt.asc().nullsLast().op('enum_ops'),
    ),
    index('ix_chatActivity_chatId').using('btree', table.chatId.asc().nullsLast().op('uuid_ops')),
    index('ix_chatActivity_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
      name: 'chatActivity_chatId_fkey',
    }),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [user.id],
      name: 'chatActivity_actorId_fkey',
    }),
    foreignKey({
      columns: [table.oldUserId],
      foreignColumns: [user.id],
      name: 'chatActivity_oldUserId_fkey',
    }),
    foreignKey({
      columns: [table.newUserId],
      foreignColumns: [user.id],
      name: 'chatActivity_newUserId_fkey',
    }),
  ],
);

export const teamSetting = pgTable(
  'teamSetting',
  {
    id: uuid().primaryKey().notNull(),
    teamId: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('ix_teamSetting_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [team.id],
      name: 'teamSetting_teamId_fkey',
    }),
    unique('teamSetting_teamId_key').on(table.teamId),
  ],
);

export const teamChatSetting = pgTable(
  'teamChatSetting',
  {
    id: uuid().primaryKey().notNull(),
    teamSettingId: uuid().notNull(),
    viewAllChatsEnabled: boolean().default(true).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('ix_teamChatSetting_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.teamSettingId],
      foreignColumns: [teamSetting.id],
      name: 'teamChatSetting_teamSettingId_fkey',
    }),
    unique('teamChatSetting_teamSettingId_key').on(table.teamSettingId),
  ],
);

export const chatMessage = pgTable(
  'chatMessage',
  {
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
  },
  (table) => [
    index('idx_chat_message_chat_created').using(
      'btree',
      table.chatId.asc().nullsLast().op('timestamptz_ops'),
      table.createdAt.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_chat_message_content').using('gin', table.content.asc().nullsLast().op('jsonb_ops')),
    index('idx_chat_message_sender').using(
      'btree',
      table.senderId.asc().nullsLast().op('text_ops'),
    ),
    index('idx_chat_message_type').using('btree', table.type.asc().nullsLast().op('enum_ops')),
    index('idx_chat_message_unsent').using(
      'btree',
      table.isUnsent.asc().nullsLast().op('bool_ops'),
    ),
    index('ix_chatMessage_chatId').using('btree', table.chatId.asc().nullsLast().op('uuid_ops')),
    index('ix_chatMessage_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
    index('ix_chatMessage_messageId').using(
      'btree',
      table.messageId.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
      name: 'chatMessage_chatId_fkey',
    }),
  ],
);

export const pushSubscription = pgTable(
  'pushSubscription',
  {
    id: uuid().primaryKey().notNull(),
    userId: uuid().notNull(),
    endpoint: varchar().notNull(),
    p256dh: varchar().notNull(),
    auth: varchar().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    token: varchar().notNull(),
  },
  (table) => [
    index('ix_pushSubscription_endpoint').using(
      'btree',
      table.endpoint.asc().nullsLast().op('text_ops'),
    ),
    index('ix_pushSubscription_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'pushSubscription_userId_fkey',
    }),
    unique('uq_pushSubscription_endpoint').on(table.endpoint),
  ],
);

export const chatReplyMessageTemplate = pgTable(
  'chatReplyMessageTemplate',
  {
    id: uuid().primaryKey().notNull(),
    type: contenttype().notNull(),
    content: jsonb().notNull(),
    contentUrl: varchar(),
    previewImageUrl: varchar(),
    organizationName: varchar().notNull(),
    updatedBy: varchar(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationName],
      foreignColumns: [organization.name],
      name: 'chatReplyMessageTemplate_organizationName_fkey',
    }).onDelete('cascade'),
  ],
);

export const chat = pgTable(
  'chat',
  {
    id: uuid().primaryKey().notNull(),
    endUserId: varchar().notNull(),
    assignedUserId: uuid(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    chatStatus: chatStatus().default('PENDING').notNull(),
    organizationName: varchar().notNull(),
    isManuallyAssigned: boolean().default(false).notNull(),
    latestMessageTimestamp: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
    latestActivityAt: timestamp({ withTimezone: true, mode: 'date' }),
    latestReadTimestamp: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
    sessionActive: boolean().default(true).notNull(),
    isUserBlocked: boolean().default(false).notNull(),
    clientUserId: varchar({ length: 255 }),
  },
  (table) => [
    index('ix_chat_clientUserId').using(
      'btree',
      table.clientUserId.asc().nullsLast().op('text_ops'),
    ),
    index('ix_chat_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.endUserId],
      foreignColumns: [endUser.userId],
      name: 'chat_endUserId_fkey',
    }),
    foreignKey({
      columns: [table.organizationName],
      foreignColumns: [organization.name],
      name: 'chat_organizationName_fkey',
    }),
    foreignKey({
      columns: [table.assignedUserId],
      foreignColumns: [user.id],
      name: 'chat_assignedUserId_fkey',
    }),
    unique('uq_orgName_clientUserId').on(table.organizationName, table.clientUserId),
  ],
);

export const store = pgTable(
  'store',
  {
    id: uuid().primaryKey().notNull(),
    organizationName: varchar().notNull(),
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
  },
  (table) => [
    index('ix_store_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.organizationName],
      foreignColumns: [organization.name],
      name: 'store_organizationName_fkey',
    }),
  ],
);

export const chatAssignFilter = pgTable(
  'chatAssignFilter',
  {
    id: uuid().primaryKey().notNull(),
    organizationName: varchar().notNull(),
    name: varchar().notNull(),
    targetTable: varchar().notNull(),
    note: varchar(),
    isActive: boolean().default(true).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('ix_chatAssignFilter_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
    index('ix_chat_assign_filter_org_name').using(
      'btree',
      table.organizationName.asc().nullsLast().op('text_ops'),
      table.isActive.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.organizationName],
      foreignColumns: [organization.name],
      name: 'chatAssignFilter_organizationName_fkey',
    }).onDelete('cascade'),
  ],
);

export const chatAssignRule = pgTable(
  'chatAssignRule',
  {
    id: uuid().primaryKey().notNull(),
    organizationName: varchar().notNull(),
    name: varchar().notNull(),
    note: varchar(),
    isActive: boolean().default(true).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('ix_chatAssignRule_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
    index('ix_chat_assign_rule_org_name').using(
      'btree',
      table.organizationName.asc().nullsLast().op('text_ops'),
      table.isActive.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.organizationName],
      foreignColumns: [organization.name],
      name: 'chatAssignRule_organizationName_fkey',
    }).onDelete('cascade'),
  ],
);

export const chatAssignConditionGroup = pgTable(
  'chatAssignConditionGroup',
  {
    id: uuid().primaryKey().notNull(),
    filterId: uuid().notNull(),
    logicalOperator: logicaloperator().default('AND').notNull(),
    isRoot: boolean().default(false).notNull(),
  },
  (table) => [
    index('ix_chatAssignConditionGroup_filterId').using(
      'btree',
      table.filterId.asc().nullsLast().op('uuid_ops'),
    ),
    index('ix_chatAssignConditionGroup_id').using(
      'btree',
      table.id.asc().nullsLast().op('uuid_ops'),
    ),
    index('ix_condition_group_filter').using(
      'btree',
      table.filterId.asc().nullsLast().op('uuid_ops'),
    ),
    uniqueIndex('uq_filter_single_root')
      .using('btree', table.filterId.asc().nullsLast().op('uuid_ops'))
      .where(sql`("isRoot" = true)`),
    foreignKey({
      columns: [table.filterId],
      foreignColumns: [chatAssignFilter.id],
      name: 'chatAssignConditionGroup_filterId_fkey',
    }).onDelete('cascade'),
    unique('uq_condition_group_id_filter').on(table.id, table.filterId),
  ],
);

export const chatAssignFilterGroup = pgTable(
  'chatAssignFilterGroup',
  {
    id: uuid().primaryKey().notNull(),
    ruleId: uuid().notNull(),
    logicalOperator: logicaloperator().default('AND').notNull(),
    isRoot: boolean().default(false).notNull(),
  },
  (table) => [
    index('ix_chatAssignFilterGroup_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
    index('ix_chatAssignFilterGroup_ruleId').using(
      'btree',
      table.ruleId.asc().nullsLast().op('uuid_ops'),
    ),
    index('ix_filter_group_rule').using('btree', table.ruleId.asc().nullsLast().op('uuid_ops')),
    uniqueIndex('uq_rule_single_root')
      .using('btree', table.ruleId.asc().nullsLast().op('uuid_ops'))
      .where(sql`("isRoot" = true)`),
    foreignKey({
      columns: [table.ruleId],
      foreignColumns: [chatAssignRule.id],
      name: 'chatAssignFilterGroup_ruleId_fkey',
    }).onDelete('cascade'),
    unique('uq_filter_group_id_rule').on(table.id, table.ruleId),
  ],
);

export const chatAssignRuleTargetTeam = pgTable(
  'chatAssignRuleTargetTeam',
  {
    id: uuid().primaryKey().notNull(),
    ruleId: uuid().notNull(),
    teamId: uuid().notNull(),
  },
  (table) => [
    index('ix_chatAssignRuleTargetTeam_id').using(
      'btree',
      table.id.asc().nullsLast().op('uuid_ops'),
    ),
    index('ix_chat_assign_rule_target_rule_team').using(
      'btree',
      table.ruleId.asc().nullsLast().op('uuid_ops'),
      table.teamId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.ruleId],
      foreignColumns: [chatAssignRule.id],
      name: 'chatAssignRuleTargetTeam_ruleId_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [team.id],
      name: 'chatAssignRuleTargetTeam_teamId_fkey',
    }).onDelete('cascade'),
    unique('uq_chat_assign_rule_team_unique').on(table.ruleId, table.teamId),
  ],
);

export const chatAssignCondition = pgTable(
  'chatAssignCondition',
  {
    id: uuid().primaryKey().notNull(),
    groupId: uuid().notNull(),
    field: varchar().notNull(),
    operator: conditionoperator().notNull(),
    value: varchar(),
    valueType: valuetype().notNull(),
  },
  (table) => [
    index('ix_chatAssignCondition_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
    index('ix_chat_assign_condition_group').using(
      'btree',
      table.groupId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.groupId],
      foreignColumns: [chatAssignConditionGroup.id],
      name: 'chatAssignCondition_groupId_fkey',
    }).onDelete('cascade'),
  ],
);

export const chatAssignFilterGroupItem = pgTable(
  'chatAssignFilterGroupItem',
  {
    id: uuid().primaryKey().notNull(),
    groupId: uuid().notNull(),
    filterId: uuid().notNull(),
  },
  (table) => [
    index('ix_chatAssignFilterGroupItem_id').using(
      'btree',
      table.id.asc().nullsLast().op('uuid_ops'),
    ),
    index('ix_fg_item_group_filter').using(
      'btree',
      table.groupId.asc().nullsLast().op('uuid_ops'),
      table.filterId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.filterId],
      foreignColumns: [chatAssignFilter.id],
      name: 'chatAssignFilterGroupItem_filterId_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.groupId],
      foreignColumns: [chatAssignFilterGroup.id],
      name: 'chatAssignFilterGroupItem_groupId_fkey',
    }).onDelete('cascade'),
  ],
);

export const selectOption = pgTable(
  'selectOption',
  {
    id: uuid().primaryKey().notNull(),
    attributeId: uuid().notNull(),
    value: varchar().notNull(),
    label: varchar(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('ix_selectOption_attributeId').using(
      'btree',
      table.attributeId.asc().nullsLast().op('uuid_ops'),
    ),
    index('ix_selectOption_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.attributeId],
      foreignColumns: [attribute.id],
      name: 'selectOption_attributeId_fkey',
    }),
    unique('uq_attribute_option').on(table.attributeId, table.value),
  ],
);

export const attribute = pgTable(
  'attribute',
  {
    id: uuid().primaryKey().notNull(),
    organizationName: varchar().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    name: varchar().notNull(),
    isActive: boolean().default(true).notNull(),
    type: attributetype().default('string').notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
    chatId: uuid(),
    isEncryptionEnabled: boolean().default(false).notNull(),
  },
  (table) => [
    index('idx_attribute_name_lower').using('btree', sql`lower((name)::text)`),
    index('ix_attribute_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.organizationName],
      foreignColumns: [organization.name],
      name: 'attribute_organizationName_fkey',
    }),
    foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
      name: 'attribute_chatid_fkey',
    }),
  ],
);

export const auth = pgTable(
  'auth',
  {
    id: uuid().primaryKey().notNull(),
    organizationName: varchar().notNull(),
    email: varchar().notNull(),
    hashedPassword: varchar().notNull(),
    status: userstatus().default('ACTIVE').notNull(),
    mailSentAt: timestamp({ withTimezone: true, mode: 'date' }),
    loginAttempts: integer().default(0).notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('ix_auth_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.organizationName],
      foreignColumns: [organization.name],
      name: 'auth_organizationName_fkey',
    }),
    unique('auth_email_key').on(table.email),
  ],
);

export const userTeam = pgTable(
  'userTeam',
  {
    teamId: uuid().notNull(),
    userId: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [team.id],
      name: 'userTeam_teamId_fkey',
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'userTeam_userId_fkey',
    }),
    primaryKey({ columns: [table.teamId, table.userId], name: 'userTeam_pkey' }),
  ],
);

export const chatAttributeValueSelectOption = pgTable(
  'chatAttributeValueSelectOption',
  {
    selectOptionId: uuid().notNull(),
    chatAttributeValueId: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('ix_chatAttributeValueSelectOption_chatAttributeValueId').using(
      'btree',
      table.chatAttributeValueId.asc().nullsLast().op('uuid_ops'),
    ),
    index('ix_chatAttributeValueSelectOption_selectOptionId').using(
      'btree',
      table.selectOptionId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.chatAttributeValueId],
      foreignColumns: [chatAttributeValue.id],
      name: 'chatAttributeValueSelectOption_chatAttributeValueId_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.selectOptionId],
      foreignColumns: [selectOption.id],
      name: 'chatAttributeValueSelectOption_selectOptionId_fkey',
    }).onDelete('cascade'),
    primaryKey({
      columns: [table.selectOptionId, table.chatAttributeValueId],
      name: 'pk_chat_attr_value_select_option',
    }),
  ],
);

export const chatAssignConditionGroupClosure = pgTable(
  'chatAssignConditionGroupClosure',
  {
    filterId: uuid().notNull(),
    ancestorGroupId: uuid().notNull(),
    descendantGroupId: uuid().notNull(),
    depth: integer().notNull(),
  },
  (table) => [
    index('ix_cl_filter_ancestor_depth').using(
      'btree',
      table.filterId.asc().nullsLast().op('int4_ops'),
      table.ancestorGroupId.asc().nullsLast().op('int4_ops'),
      table.depth.asc().nullsLast().op('int4_ops'),
    ),
    index('ix_cl_filter_descendant').using(
      'btree',
      table.filterId.asc().nullsLast().op('uuid_ops'),
      table.descendantGroupId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.filterId, table.ancestorGroupId],
      foreignColumns: [chatAssignConditionGroup.id, chatAssignConditionGroup.filterId],
      name: 'fk_cg_cl_ancestor',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.filterId, table.descendantGroupId],
      foreignColumns: [chatAssignConditionGroup.id, chatAssignConditionGroup.filterId],
      name: 'fk_cg_cl_descendant',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.filterId],
      foreignColumns: [chatAssignFilter.id],
      name: 'chatAssignConditionGroupClosure_filterId_fkey',
    }).onDelete('cascade'),
    primaryKey({
      columns: [table.ancestorGroupId, table.descendantGroupId],
      name: 'pk_condition_group_closure',
    }),
    check('ck_cg_depth_non_negative', sql`depth >= 0`),
  ],
);

export const chatAssignFilterGroupClosure = pgTable(
  'chatAssignFilterGroupClosure',
  {
    ruleId: uuid().notNull(),
    ancestorGroupId: uuid().notNull(),
    descendantGroupId: uuid().notNull(),
    depth: integer().notNull(),
  },
  (table) => [
    index('ix_cl_rule_ancestor_depth').using(
      'btree',
      table.ruleId.asc().nullsLast().op('int4_ops'),
      table.ancestorGroupId.asc().nullsLast().op('int4_ops'),
      table.depth.asc().nullsLast().op('int4_ops'),
    ),
    index('ix_cl_rule_descendant').using(
      'btree',
      table.ruleId.asc().nullsLast().op('uuid_ops'),
      table.descendantGroupId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.ruleId, table.ancestorGroupId],
      foreignColumns: [chatAssignFilterGroup.id, chatAssignFilterGroup.ruleId],
      name: 'fk_fg_cl_ancestor',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.ruleId, table.descendantGroupId],
      foreignColumns: [chatAssignFilterGroup.id, chatAssignFilterGroup.ruleId],
      name: 'fk_fg_cl_descendant',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.ruleId],
      foreignColumns: [chatAssignRule.id],
      name: 'chatAssignFilterGroupClosure_ruleId_fkey',
    }).onDelete('cascade'),
    primaryKey({
      columns: [table.ancestorGroupId, table.descendantGroupId],
      name: 'pk_filter_group_closure',
    }),
    check('ck_fg_depth_non_negative', sql`depth >= 0`),
  ],
);

export const surveyData = pgTable(
  'surveyData',
  {
    organizationName: varchar({ length: 255 }).notNull(),
    endUserId: varchar({ length: 255 }).notNull(),
    clientUserId: varchar({ length: 255 }),
    userSurvey: json().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('ix_surveyData_client_user').using(
      'btree',
      table.clientUserId.asc().nullsLast().op('text_ops'),
    ),
    index('ix_surveyData_end_user').using(
      'btree',
      table.endUserId.asc().nullsLast().op('text_ops'),
    ),
    index('ix_surveyData_org').using(
      'btree',
      table.organizationName.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.endUserId],
      foreignColumns: [endUser.userId],
      name: 'surveyData_endUserId_fkey',
    }),
    foreignKey({
      columns: [table.organizationName],
      foreignColumns: [organization.name],
      name: 'surveyData_organizationName_fkey',
    }).onDelete('cascade'),
    primaryKey({
      columns: [table.organizationName, table.endUserId],
      name: 'uq_surveyData_org_user',
    }),
  ],
);

export const organizationSettings = pgTable(
  'organizationSettings',
  {
    organizationName: varchar().notNull(),
    type: varchar().notNull(),
    memberFeedSurveyColumnSettings: jsonb(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
    syncedAt: timestamp({ withTimezone: true, mode: 'date' }),
    chatReplySettings: jsonb(),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationName],
      foreignColumns: [organization.name],
      name: 'organizationSettings_organizationName_fkey',
    }).onDelete('cascade'),
    primaryKey({
      columns: [table.organizationName, table.type],
      name: 'organizationSettings_pkey',
    }),
    check(
      'type_check',
      sql`(type)::text = ANY ((ARRAY['memberFeed'::character varying, 'survey'::character varying, 'chatReply'::character varying])::text[])`,
    ),
  ],
);

export const chatUserRead = pgTable(
  'chatUserRead',
  {
    chatId: uuid().notNull(),
    userId: uuid().notNull(),
    organizationName: varchar().notNull(),
    readTimestamp: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('idx_chat_user_read_org_chat').using(
      'btree',
      table.organizationName.asc().nullsLast().op('uuid_ops'),
      table.chatId.asc().nullsLast().op('text_ops'),
    ),
    index('idx_chat_user_read_user').using('btree', table.userId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
      name: 'chatUserRead_chatId_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.organizationName],
      foreignColumns: [organization.name],
      name: 'chatUserRead_organizationName_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'chatUserRead_userId_fkey',
    }).onDelete('cascade'),
    primaryKey({ columns: [table.chatId, table.userId], name: 'chatUserRead_pkey' }),
  ],
);

export * from './tables/partitioned';
