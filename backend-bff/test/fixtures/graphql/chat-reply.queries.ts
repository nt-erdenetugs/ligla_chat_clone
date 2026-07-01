export const CHAT_REPLY_QUERIES = {
  GET_CHAT_REPLY_SETTING: `
    query ChatReplySetting($inputOrganizationId: String) {
      chatReplySetting(inputOrganizationId: $inputOrganizationId) {
        id
        isActive
        updatedBy
        chatReplySchedules {
          id
          scheduleType
          chatReplyScheduleCustomDates
          chatReplyScheduleTimeRanges {
            startTime
            endTime
            timeRangeType
          }
        }
        chatReplySettingMessages {
          timeRangeType
          chatReplyMessageTemplate {
            id
            type
            content
            contentUrl
            previewImageUrl
            updatedBy
          }
        }
      }
    }
  `,

  CREATE_CHAT_REPLY_SETTING: `
    mutation CreateChatReplySetting($createChatReplySettingInput: CreateChatReplySettingInput!, $inputOrganizationId: String) {
      createChatReplySetting(createChatReplySettingInput: $createChatReplySettingInput, inputOrganizationId: $inputOrganizationId) {
        id
        isActive
        updatedBy
        chatReplySchedules {
          id
          scheduleType
          chatReplyScheduleCustomDates
          chatReplyScheduleTimeRanges {
            startTime
            endTime
            timeRangeType
          }
        }
        chatReplySettingMessages {
          timeRangeType
          chatReplyMessageTemplate {
            id
            type
            content
            contentUrl
            previewImageUrl
            updatedBy
          }
        }
      }
    }
  `,

  UPDATE_CHAT_REPLY_SETTING: `
    mutation UpdateChatReplySetting($updateChatReplySettingInput: UpdateChatReplySettingInput!) {
      updateChatReplySetting(updateChatReplySettingInput: $updateChatReplySettingInput) {
        id
        isActive
        updatedBy
        chatReplySchedules {
          id
          scheduleType
          chatReplyScheduleCustomDates
          chatReplyScheduleTimeRanges {
            startTime
            endTime
            timeRangeType
          }
        }
        chatReplySettingMessages {
          timeRangeType
          chatReplyMessageTemplate {
            id
            type
            content
            contentUrl
            previewImageUrl
            updatedBy
          }
        }
      }
    }
  `,
};
