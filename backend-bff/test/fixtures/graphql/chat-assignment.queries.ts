export const CHAT_ASSIGNMENT_QUERIES = {
  ASSIGN_OPERATOR_TO_CHAT: `
    mutation AssignOperatorToChat($chatAssignInput: ChatAssignInput!) {
      assignOperatorToChat(chatAssignInput: $chatAssignInput) {
        id
        chatId
        activityType
        actorType
        actorId
        actorUserName
        oldUserId
        newUserId
        oldUserName
        newUserName
        createdAt
      }
    }
  `,

  ASSIGN_TEAM_TO_CHAT: `
    mutation AssignTeamToChat($chatTeamAssignInput: ChatTeamAssignInput!) {
      assignTeamToChat(chatTeamAssignInput: $chatTeamAssignInput) {
        id
        chatId
        activityType
        actorType
        actorId
        actorUserName
        changedTeamId
        changedTeamName
        teamAssignAction
        createdAt
      }
    }
  `,

  REMOVE_TEAM_FROM_CHAT: `
    mutation RemoveTeamFromChat($chatTeamAssignInput: ChatTeamAssignInput!) {
      removeTeamFromChat(chatTeamAssignInput: $chatTeamAssignInput) {
        id
        chatId
        activityType
        actorType
        actorId
        actorUserName
        changedTeamId
        changedTeamName
        teamAssignAction
        createdAt
      }
    }
  `,
};
