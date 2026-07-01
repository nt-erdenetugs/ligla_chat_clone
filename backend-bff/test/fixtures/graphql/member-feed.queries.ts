export const MEMBER_FEED_QUERIES = {
  GET_MEMBER_FEED_COLUMNS: `
    query MemberFeedColumns {
      memberFeedColumns {
        name
        alias
        isEnabled
      }
    }
  `,

  GET_MEMBER_FEEDS: `
    query MemberFeeds($clientUserId: String) {
      memberFeeds(clientUserId: $clientUserId) {
        columnName
        columnAlias
        value
      }
    }
  `,

  UPDATE_MEMBER_FEED_SETTING: `
    mutation UpdateMemberFeedSetting($updateMemberFeedSettingInput: UpdateMemberFeedSettingInput!) {
      updateMemberFeedSetting(updateMemberFeedSettingInput: $updateMemberFeedSettingInput) {
        name
        alias
        isEnabled
      }
    }
  `,
};
