export const TEAM_QUERIES = {
  GET_TEAMS: `
    query Teams($skip: Int, $take: Int, $filter: FilterInput, $inputOrganizationId: String) {
      teams(skip: $skip, take: $take, filter: $filter, inputOrganizationId: $inputOrganizationId) {
        items {
          id
          name
          isActive
          isDefault
          createdAt
          managers {
            id
            displayName
            email
            roleType
          }
          operators {
            id
            displayName
            email
            roleType
          }
          stores {
            id
            name
          }
          teamSetting {
            id
            teamId
            teamChatSetting {
              id
              teamSettingId
              viewAllChatsEnabled
            }
          }
        }
        count
      }
    }
  `,

  GET_SELECTABLE_TEAMS: `
    query SelectableTeams {
      selectableTeams {
        id
        name
        isDefault
      }
    }
  `,

  GET_SELECTABLE_TEAMS_FOR_CHAT_FILTER: `
    query SelectableTeamsForChatFilter {
      selectableTeamsForChatFilter {
        id
        name
        isDefault
      }
    }
  `,

  GET_TEAMS_IN_CHAT: `
    query TeamsInChat($chatId: String!) {
      teamsInChat(chatId: $chatId) {
        id
        name
        isActive
        isDefault
        createdAt
      }
    }
  `,

  GET_TEAM: `
    query Team($id: String!, $inputOrganizationId: String) {
      team(id: $id, inputOrganizationId: $inputOrganizationId) {
        id
        name
        isActive
        isDefault
        createdAt
        managers {
          id
          displayName
          email
          roleType
        }
        operators {
          id
          displayName
          email
          roleType
        }
        stores {
          id
          name
        }
        teamSetting {
          id
          teamId
          teamChatSetting {
            id
            teamSettingId
            viewAllChatsEnabled
          }
        }
      }
    }
  `,

  CREATE_TEAM: `
    mutation CreateTeam($createTeamInput: CreateTeamInput!) {
      createTeam(createTeamInput: $createTeamInput) {
        id
        name
        isActive
        isDefault
        createdAt
        managers {
          id
          displayName
          roleType
        }
        operators {
          id
          displayName
          roleType
        }
        stores {
          id
          name
        }
        teamSetting {
          id
          teamId
          teamChatSetting {
            id
            teamSettingId
            viewAllChatsEnabled
          }
        }
      }
    }
  `,

  UPDATE_TEAM: `
    mutation UpdateTeam($updateTeamInput: UpdateTeamInput!) {
      updateTeam(updateTeamInput: $updateTeamInput) {
        id
        name
        isActive
        isDefault
        createdAt
        managers {
          id
          displayName
          roleType
        }
        operators {
          id
          displayName
          roleType
        }
        stores {
          id
          name
        }
      }
    }
  `,

  TOGGLE_TEAM_STATUS: `
    mutation ToggleTeamStatus($id: String!) {
      toggleTeamStatus(id: $id) {
        id
        name
        isActive
        isDefault
        createdAt
      }
    }
  `,

  DISABLE_TEAM: `
    mutation DisableTeam($id: String!) {
      disableTeam(id: $id) {
        id
        name
        isActive
        isDefault
        createdAt
      }
    }
  `,
};
