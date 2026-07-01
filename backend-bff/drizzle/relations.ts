import { relations } from 'drizzle-orm/relations';
import {
  organization,
  tags,
  chat,
  chatTags,
  store,
  storeTeam,
  team,
  chatTeamAssignment,
  user,
  auth,
  userPasswordResetToken,
  note,
  attribute,
  chatAttributeValue,
  chatActivity,
  teamSetting,
  teamChatSetting,
  chatMessage,
  pushSubscription,
  chatReplyMessageTemplate,
  endUser,
  chatAssignFilter,
  chatAssignRule,
  chatAssignConditionGroup,
  chatAssignFilterGroup,
  chatAssignRuleTargetTeam,
  chatAssignCondition,
  chatAssignFilterGroupItem,
  selectOption,
  userTeam,
  chatAttributeValueSelectOption,
  chatAssignConditionGroupClosure,
  chatAssignFilterGroupClosure,
  surveyData,
  organizationSettings,
  chatUserRead,
} from './schema';

export const tagsRelations = relations(tags, ({ one, many }) => ({
  organization: one(organization, {
    fields: [tags.organizationName],
    references: [organization.name],
  }),
  chatTags: many(chatTags),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  tags: many(tags),
  teams: many(team),
  users: many(user),
  notes: many(note),
  chatReplyMessageTemplates: many(chatReplyMessageTemplate),
  chats: many(chat),
  stores: many(store),
  chatAssignFilters: many(chatAssignFilter),
  chatAssignRules: many(chatAssignRule),
  attributes: many(attribute),
  auths: many(auth),
  surveyData: many(surveyData),
  organizationSettings: many(organizationSettings),
  chatUserReads: many(chatUserRead),
}));

export const chatTagsRelations = relations(chatTags, ({ one }) => ({
  chat: one(chat, {
    fields: [chatTags.chatId],
    references: [chat.id],
  }),
  tag: one(tags, {
    fields: [chatTags.tagId],
    references: [tags.id],
  }),
}));

export const chatRelations = relations(chat, ({ one, many }) => ({
  chatTags: many(chatTags),
  chatTeamAssignments: many(chatTeamAssignment),
  notes: many(note),
  chatAttributeValues: many(chatAttributeValue),
  chatActivities: many(chatActivity),
  chatMessages: many(chatMessage),
  endUser: one(endUser, {
    fields: [chat.endUserId],
    references: [endUser.userId],
  }),
  organization: one(organization, {
    fields: [chat.organizationName],
    references: [organization.name],
  }),
  user: one(user, {
    fields: [chat.assignedUserId],
    references: [user.id],
  }),
  attributes: many(attribute),
  chatUserReads: many(chatUserRead),
}));

export const storeTeamRelations = relations(storeTeam, ({ one }) => ({
  store: one(store, {
    fields: [storeTeam.storeId],
    references: [store.id],
  }),
  team: one(team, {
    fields: [storeTeam.teamId],
    references: [team.id],
  }),
}));

export const storeRelations = relations(store, ({ one, many }) => ({
  storeTeams: many(storeTeam),
  organization: one(organization, {
    fields: [store.organizationName],
    references: [organization.name],
  }),
}));

export const teamRelations = relations(team, ({ one, many }) => ({
  storeTeams: many(storeTeam),
  chatTeamAssignments: many(chatTeamAssignment),
  organization: one(organization, {
    fields: [team.organizationName],
    references: [organization.name],
  }),
  teamSetting: one(teamSetting),
  chatAssignRuleTargetTeams: many(chatAssignRuleTargetTeam),
  userTeams: many(userTeam),
}));

export const chatTeamAssignmentRelations = relations(chatTeamAssignment, ({ one }) => ({
  chat: one(chat, {
    fields: [chatTeamAssignment.chatId],
    references: [chat.id],
  }),
  team: one(team, {
    fields: [chatTeamAssignment.teamId],
    references: [team.id],
  }),
}));

export const userRelations = relations(user, ({ one, many }) => ({
  organization: one(organization, {
    fields: [user.organizationName],
    references: [organization.name],
  }),
  auth: one(auth, {
    fields: [user.id],
    references: [auth.id],
  }),
  notes: many(note),
  chatAttributeValues: many(chatAttributeValue),
  chatActivities_actorId: many(chatActivity, {
    relationName: 'chatActivity_actorId_user_id',
  }),
  chatActivities_oldUserId: many(chatActivity, {
    relationName: 'chatActivity_oldUserId_user_id',
  }),
  chatActivities_newUserId: many(chatActivity, {
    relationName: 'chatActivity_newUserId_user_id',
  }),
  pushSubscriptions: many(pushSubscription),
  chats: many(chat),
  userTeams: many(userTeam),
  chatUserReads: many(chatUserRead),
}));

export const authRelations = relations(auth, ({ one, many }) => ({
  user: one(user),
  userPasswordResetToken: one(userPasswordResetToken),
  organization: one(organization, {
    fields: [auth.organizationName],
    references: [organization.name],
  }),
}));

export const userPasswordResetTokenRelations = relations(userPasswordResetToken, ({ one }) => ({
  auth: one(auth, {
    fields: [userPasswordResetToken.userId],
    references: [auth.id],
  }),
}));

export const noteRelations = relations(note, ({ one }) => ({
  chat: one(chat, {
    fields: [note.chatId],
    references: [chat.id],
  }),
  organization: one(organization, {
    fields: [note.organizationName],
    references: [organization.name],
  }),
  user: one(user, {
    fields: [note.userId],
    references: [user.id],
  }),
}));

export const chatAttributeValueRelations = relations(chatAttributeValue, ({ one, many }) => ({
  attribute: one(attribute, {
    fields: [chatAttributeValue.attributeId],
    references: [attribute.id],
  }),
  chat: one(chat, {
    fields: [chatAttributeValue.chatId],
    references: [chat.id],
  }),
  user: one(user, {
    fields: [chatAttributeValue.userId],
    references: [user.id],
  }),
  chatAttributeValueSelectOptions: many(chatAttributeValueSelectOption),
}));

export const attributeRelations = relations(attribute, ({ one, many }) => ({
  chatAttributeValues: many(chatAttributeValue),
  selectOptions: many(selectOption),
  organization: one(organization, {
    fields: [attribute.organizationName],
    references: [organization.name],
  }),
  chat: one(chat, {
    fields: [attribute.chatId],
    references: [chat.id],
  }),
}));

export const chatActivityRelations = relations(chatActivity, ({ one }) => ({
  chat: one(chat, {
    fields: [chatActivity.chatId],
    references: [chat.id],
  }),
  user_actorId: one(user, {
    fields: [chatActivity.actorId],
    references: [user.id],
    relationName: 'chatActivity_actorId_user_id',
  }),
  user_oldUserId: one(user, {
    fields: [chatActivity.oldUserId],
    references: [user.id],
    relationName: 'chatActivity_oldUserId_user_id',
  }),
  user_newUserId: one(user, {
    fields: [chatActivity.newUserId],
    references: [user.id],
    relationName: 'chatActivity_newUserId_user_id',
  }),
}));

export const teamSettingRelations = relations(teamSetting, ({ one, many }) => ({
  team: one(team, {
    fields: [teamSetting.teamId],
    references: [team.id],
  }),
  teamChatSetting: one(teamChatSetting),
}));

export const teamChatSettingRelations = relations(teamChatSetting, ({ one }) => ({
  teamSetting: one(teamSetting, {
    fields: [teamChatSetting.teamSettingId],
    references: [teamSetting.id],
  }),
}));

export const chatMessageRelations = relations(chatMessage, ({ one }) => ({
  chat: one(chat, {
    fields: [chatMessage.chatId],
    references: [chat.id],
  }),
}));

export const pushSubscriptionRelations = relations(pushSubscription, ({ one }) => ({
  user: one(user, {
    fields: [pushSubscription.userId],
    references: [user.id],
  }),
}));

export const chatReplyMessageTemplateRelations = relations(chatReplyMessageTemplate, ({ one }) => ({
  organization: one(organization, {
    fields: [chatReplyMessageTemplate.organizationName],
    references: [organization.name],
  }),
}));

export const endUserRelations = relations(endUser, ({ many }) => ({
  chats: many(chat),
  surveyData: many(surveyData),
}));

export const chatAssignFilterRelations = relations(chatAssignFilter, ({ one, many }) => ({
  organization: one(organization, {
    fields: [chatAssignFilter.organizationName],
    references: [organization.name],
  }),
  chatAssignConditionGroups: many(chatAssignConditionGroup),
  chatAssignFilterGroupItems: many(chatAssignFilterGroupItem),
  chatAssignConditionGroupClosures: many(chatAssignConditionGroupClosure),
}));

export const chatAssignRuleRelations = relations(chatAssignRule, ({ one, many }) => ({
  organization: one(organization, {
    fields: [chatAssignRule.organizationName],
    references: [organization.name],
  }),
  chatAssignFilterGroups: many(chatAssignFilterGroup),
  chatAssignRuleTargetTeams: many(chatAssignRuleTargetTeam),
  chatAssignFilterGroupClosures: many(chatAssignFilterGroupClosure),
}));

export const chatAssignConditionGroupRelations = relations(
  chatAssignConditionGroup,
  ({ one, many }) => ({
    chatAssignFilter: one(chatAssignFilter, {
      fields: [chatAssignConditionGroup.filterId],
      references: [chatAssignFilter.id],
    }),
    chatAssignConditions: many(chatAssignCondition),
    chatAssignConditionGroupClosures_filterId: many(chatAssignConditionGroupClosure, {
      relationName: 'chatAssignConditionGroupClosure_filterId_chatAssignConditionGroup_id',
    }),
  }),
);

export const chatAssignFilterGroupRelations = relations(chatAssignFilterGroup, ({ one, many }) => ({
  chatAssignRule: one(chatAssignRule, {
    fields: [chatAssignFilterGroup.ruleId],
    references: [chatAssignRule.id],
  }),
  chatAssignFilterGroupItems: many(chatAssignFilterGroupItem),
  chatAssignFilterGroupClosures_ruleId: many(chatAssignFilterGroupClosure, {
    relationName: 'chatAssignFilterGroupClosure_ruleId_chatAssignFilterGroup_id',
  }),
}));

export const chatAssignRuleTargetTeamRelations = relations(chatAssignRuleTargetTeam, ({ one }) => ({
  chatAssignRule: one(chatAssignRule, {
    fields: [chatAssignRuleTargetTeam.ruleId],
    references: [chatAssignRule.id],
  }),
  team: one(team, {
    fields: [chatAssignRuleTargetTeam.teamId],
    references: [team.id],
  }),
}));

export const chatAssignConditionRelations = relations(chatAssignCondition, ({ one }) => ({
  chatAssignConditionGroup: one(chatAssignConditionGroup, {
    fields: [chatAssignCondition.groupId],
    references: [chatAssignConditionGroup.id],
  }),
}));

export const chatAssignFilterGroupItemRelations = relations(
  chatAssignFilterGroupItem,
  ({ one }) => ({
    chatAssignFilter: one(chatAssignFilter, {
      fields: [chatAssignFilterGroupItem.filterId],
      references: [chatAssignFilter.id],
    }),
    chatAssignFilterGroup: one(chatAssignFilterGroup, {
      fields: [chatAssignFilterGroupItem.groupId],
      references: [chatAssignFilterGroup.id],
    }),
  }),
);

export const selectOptionRelations = relations(selectOption, ({ one, many }) => ({
  attribute: one(attribute, {
    fields: [selectOption.attributeId],
    references: [attribute.id],
  }),
  chatAttributeValueSelectOptions: many(chatAttributeValueSelectOption),
}));

export const userTeamRelations = relations(userTeam, ({ one }) => ({
  team: one(team, {
    fields: [userTeam.teamId],
    references: [team.id],
  }),
  user: one(user, {
    fields: [userTeam.userId],
    references: [user.id],
  }),
}));

export const chatAttributeValueSelectOptionRelations = relations(
  chatAttributeValueSelectOption,
  ({ one }) => ({
    chatAttributeValue: one(chatAttributeValue, {
      fields: [chatAttributeValueSelectOption.chatAttributeValueId],
      references: [chatAttributeValue.id],
    }),
    selectOption: one(selectOption, {
      fields: [chatAttributeValueSelectOption.selectOptionId],
      references: [selectOption.id],
    }),
  }),
);

export const chatAssignConditionGroupClosureRelations = relations(
  chatAssignConditionGroupClosure,
  ({ one }) => ({
    chatAssignConditionGroup_filterId: one(chatAssignConditionGroup, {
      fields: [chatAssignConditionGroupClosure.filterId],
      references: [chatAssignConditionGroup.id],
      relationName: 'chatAssignConditionGroupClosure_filterId_chatAssignConditionGroup_id',
    }),
    chatAssignFilter: one(chatAssignFilter, {
      fields: [chatAssignConditionGroupClosure.filterId],
      references: [chatAssignFilter.id],
    }),
  }),
);

export const chatAssignFilterGroupClosureRelations = relations(
  chatAssignFilterGroupClosure,
  ({ one }) => ({
    chatAssignFilterGroup_ruleId: one(chatAssignFilterGroup, {
      fields: [chatAssignFilterGroupClosure.ruleId],
      references: [chatAssignFilterGroup.id],
      relationName: 'chatAssignFilterGroupClosure_ruleId_chatAssignFilterGroup_id',
    }),
    chatAssignRule: one(chatAssignRule, {
      fields: [chatAssignFilterGroupClosure.ruleId],
      references: [chatAssignRule.id],
    }),
  }),
);

export const surveyDataRelations = relations(surveyData, ({ one }) => ({
  endUser: one(endUser, {
    fields: [surveyData.endUserId],
    references: [endUser.userId],
  }),
  organization: one(organization, {
    fields: [surveyData.organizationName],
    references: [organization.name],
  }),
}));

export const organizationSettingsRelations = relations(organizationSettings, ({ one }) => ({
  organization: one(organization, {
    fields: [organizationSettings.organizationName],
    references: [organization.name],
  }),
}));
export const chatUserReadRelations = relations(chatUserRead, ({ one }) => ({
  chat: one(chat, {
    fields: [chatUserRead.chatId],
    references: [chat.id],
  }),
  organization: one(organization, {
    fields: [chatUserRead.organizationName],
    references: [organization.name],
  }),
  user: one(user, {
    fields: [chatUserRead.userId],
    references: [user.id],
  }),
}));
