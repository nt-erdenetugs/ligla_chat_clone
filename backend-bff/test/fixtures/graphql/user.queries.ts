export const USER_QUERIES = {
  CREATE_USER: `
    mutation CreateUser($createUserInput: CreateUserInput!) {
      createUser(createUserInput: $createUserInput) {
        id
        email
        displayName
        roleType
        status
        organization {
          name
        }
      }
    }
  `,

  GET_USERS: `
    query Users($skip: Int, $take: Int, $filter: FilterInput) {
      users(skip: $skip, take: $take, filter: $filter) {
        items {
          id
          email
          displayName
          senderName
          roleType
          status
          organization {
            name
          }
          createdAt
        }
        count
      }
    }
  `,

  CHECK_USER_EXISTS: `
    query CheckUserExists($email: String!) {
      checkUserExists(email: $email)
    }
  `,

  GET_USER: `
    query User($id: String!) {
      user(id: $id) {
        id
        email
        displayName
        roleType
        status
        organization {
          name
        }
      }
    }
  `,

  GET_ME: `
    query Me {
      me {
        id
        email
        displayName
        roleType
        status
        organization {
          name
        }
        qrUrl
      }
    }
  `,

  GET_OPERATOR_COUNT: `
    query OperatorCount {
      operatorCount
    }
  `,

  UPDATE_USER: `
    mutation UpdateUser($updateUserInput: UpdateUserInput!) {
      updateUser(updateUserInput: $updateUserInput) {
        id
        email
        displayName
        roleType
        status
      }
    }
  `,

  TOGGLE_USER_STATUS: `
    mutation ToggleUserStatus($id: String!) {
      toggleUserStatus(id: $id) {
        id
        status
      }
    }
  `,

  UPDATE_DISPLAY_NAME: `
    mutation UpdateDisplayName($updateDisplayNameInput: UpdateDisplayNameInput!) {
      updateDisplayName(updateDisplayNameInput: $updateDisplayNameInput) {
        id
        displayName
      }
    }
  `,

  UPDATE_SENDER_NAME: `
    mutation UpdateSenderName($updateSenderNameInput: UpdateSenderNameInput!) {
      updateSenderName(updateSenderNameInput: $updateSenderNameInput) {
        id
        senderName
      }
    }
  `,

  RESET_PASSWORD: `
    mutation ResetPassword($resetPasswordInput: ResetPasswordInput!) {
      resetPassword(resetPasswordInput: $resetPasswordInput) {
        id
      }
    }
  `,

  REQUEST_PASSWORD_RESET: `
    mutation RequestPasswordReset($email: String!) {
      requestPasswordReset(email: $email)
    }
  `,

  REQUEST_RE_INVITE: `
    mutation RequestReInvite($email: String!) {
      requestReInvite(email: $email)
    }
  `,

  RESET_PASSWORD_BY_TOKEN: `
    mutation ResetPasswordByToken($resetPasswordByTokenInput: ResetPasswordByTokenInput!) {
      resetPasswordByToken(resetPasswordByTokenInput: $resetPasswordByTokenInput) {
        success
        warning
      }
    }
  `,

  VERIFY_PASSWORD_RESET_TOKEN: `
    query VerifyPasswordResetToken($token: String!) {
      verifyPasswordResetToken(token: $token)
    }
  `,

  GET_MANAGERS: `
    query Managers($inputOrganizationId: String, $cursorId: String, $cursorCreatedAt: DateTime, $take: Int) {
      managers(inputOrganizationId: $inputOrganizationId, cursorId: $cursorId, cursorCreatedAt: $cursorCreatedAt, take: $take) {
        items {
          id
          email
          displayName
          roleType
        }
        hasMore
        nextCursorId
        nextCursorCreatedAt
      }
    }
  `,

  GET_ADMIN_OPERATORS: `
    query AdminOperators($cursorId: String, $cursorCreatedAt: DateTime, $take: Int) {
      adminOperators(cursorId: $cursorId, cursorCreatedAt: $cursorCreatedAt, take: $take) {
        items {
          id
          email
          displayName
          roleType
        }
        hasMore
        nextCursorId
        nextCursorCreatedAt
      }
    }
  `,

  GET_ALL_SELECTABLE_OPERATORS: `
    query AllSelectableOperators($inputOrganizationId: String, $cursorId: String, $cursorCreatedAt: DateTime, $take: Int) {
      allSelectableOperators(inputOrganizationId: $inputOrganizationId, cursorId: $cursorId, cursorCreatedAt: $cursorCreatedAt, take: $take) {
        items {
          id
          email
          displayName
          roleType
        }
        hasMore
        nextCursorId
        nextCursorCreatedAt
      }
    }
  `,

  REMOVE_USER: `
    mutation RemoveUser($id: String!) {
      removeUser(id: $id)
    }
  `,
};
