export const CHAT_QUERIES = {
  GET_CHATS: `
    query Chats(
      $filter: ChatFilterInput
      $cursorId: String
      $cursorCreatedAt: DateTime
      $cursorDateParam: DateTime
      $take: Int
    ) {
      chats(
        filter: $filter
        cursorId: $cursorId
        cursorCreatedAt: $cursorCreatedAt
        cursorDateParam: $cursorDateParam
        take: $take
      ) {
        items {
          id
          assignedUserId
          assignedUser {
            id
            displayName
            email
            roleType
          }
          chatTeamAssignment {
            id
            chatId
            createdAt
            teamId
            team {
              id
              name
              createdAt
            }
          }
          chatMessages {
            id
            chatId
            content
            previewImageUrl
            createdAt
            senderId
            senderType
            type
            isDelivered
          }
          chatUnreadCount
          endUserId
          endUser {
            userId
            clientUserId
            displayName
            pictureUrl
            createdAt
            updatedAt
          }
          chatAttributeValues {
            id
            value
            chatId
            attributeId
            userId
            createdAt
          }
          chatTags {
            id
            chatId
            tagId
            createdAt
            tag {
              id
              name
              isActive
              createdAt
            }
          }
          chatStatus
          latestMessageTimestamp
          latestReadTimestamp
          isUserBlocked
          createdAt
        }
        nextCursorId
        nextCursorCreatedAt
        nextCursorDateParam
        hasMore
      }
    }
  `,

  GET_CHAT_HISTORY: `
    query ChatHistory($id: String!) {
      chatHistory(id: $id) {
        id
        assignedUserId
        assignedUser {
          id
          displayName
          email
          roleType
        }
        chatTeamAssignment {
          id
          chatId
          createdAt
          teamId
          team {
            id
            name
            createdAt
          }
        }
        chatMessages {
          id
          chatId
          content
          previewImageUrl
          createdAt
          senderId
          senderType
          type
          isDelivered
        }
        chatUnreadCount
        endUserId
        endUser {
          userId
          clientUserId
          displayName
          pictureUrl
          createdAt
          updatedAt
        }
        chatAttributeValues {
          id
          value
          chatId
          attributeId
          userId
          createdAt
        }
        chatTags {
          id
          chatId
          tagId
          createdAt
          tag {
            id
            name
            isActive
            createdAt
          }
        }
        chatStatus
        latestMessageTimestamp
        latestReadTimestamp
        isUserBlocked
        createdAt
      }
    }
  `,

  GET_CHAT_DATA: `
    query ChatData(
      $chatId: String!
      $take: Int
      $cursorId: String
      $cursorCreatedAt: DateTime
      $cursorDirection: CursorDirection
    ) {
      chatData(
        chatId: $chatId
        take: $take
        cursorId: $cursorId
        cursorCreatedAt: $cursorCreatedAt
        cursorDirection: $cursorDirection
      ) {
        items {
          id
          createdAt
          itemType
          activity {
            id
            chatId
            activityType
            actorType
            actorId
            actorUserName
            oldStatus
            newStatus
            oldUserId
            newUserId
            oldUserName
            newUserName
            changedTeamId
            changedTeamName
            teamAssignAction
            createdAt
          }
          message {
            id
            chatId
            content
            previewImageUrl
            createdAt
            senderId
            sender {
              id
              displayName
              pictureUrl
            }
            senderType
            type
            isDelivered
          }
        }
        nextCursorId
        nextCursorCreatedAt
        hasMore
      }
    }
  `,

  GET_CHAT_COUNT: `
    query ChatCount {
      chatCount
    }
  `,

  GET_UNASSIGNED_CHAT_COUNT: `
    query UnassignedChatCount {
      unassignedChatCount
    }
  `,

  CHANGE_CHAT_STATUS: `
    mutation ChangeChatStatus($chatStatusInput: ChatStatusInput!) {
      changeChatStatus(chatStatusInput: $chatStatusInput) {
        id
        chatId
        activityType
        actorType
        actorId
        actorUserName
        oldStatus
        newStatus
        oldUserId
        newUserId
        oldUserName
        newUserName
        changedTeamId
        changedTeamName
        teamAssignAction
        createdAt
      }
    }
  `,

  ADD_CHAT_TAG: `
    mutation AddChatTag($chatTagInput: ChatTagInput!) {
      addChatTag(chatTagInput: $chatTagInput) {
        id
        chatStatus
        endUserId
        createdAt
        chatTags {
          id
          chatId
          tagId
          createdAt
          tag {
            id
            name
            isActive
            createdAt
          }
        }
      }
    }
  `,

  SEND_MESSAGE: `
    mutation SendMessage($chatMessageInput: ChatMessageInput!) {
      sendMessage(chatMessageInput: $chatMessageInput) {
        id
        chatId
        content
        createdAt
        senderId
        sender {
          id
          displayName
          pictureUrl
        }
        senderType
        type
        isDelivered
      }
    }
  `,

  SEND_MESSAGE_TO_LIGLA: `
    mutation SendMessageToLigla(
      $chatId: String!
      $messageId: String!
    ) {
      sendMessageToLigla(
        chatId: $chatId
        messageId: $messageId
      ) {
        id
        chatId
        content
        isDelivered
      }
    }
  `,

  RETRY_SEND_MESSAGE: `
    mutation RetrySendMessage($retryMessageInput: RetryMessageInput!) {
      retrySendMessage(retryMessageInput: $retryMessageInput) {
        id
        chatId
        content
        createdAt
        senderId
        senderType
        type
        isDelivered
      }
    }
  `,

  DELETE_CHAT_MESSAGE: `
    mutation DeleteChatMessage($deleteMessageInput: DeleteMessageInput!) {
      deleteChatMessage(deleteMessageInput: $deleteMessageInput)
    }
  `,

  REMOVE_CHAT_TAG: `
    mutation RemoveChatTag($chatTagInput: ChatTagInput!) {
      removeChatTag(chatTagInput: $chatTagInput) {
        id
        chatStatus
        endUserId
        createdAt
        chatTags {
          id
          chatId
          tagId
          createdAt
          tag {
            id
            name
            isActive
            createdAt
          }
        }
      }
    }
  `,

  UPDATE_CHAT_TAGS: `
    mutation UpdateChatTags($updateChatTagsInput: UpdateChatTagsInput!) {
      updateChatTags(updateChatTagsInput: $updateChatTagsInput) {
        id
        chatStatus
        endUserId
        createdAt
        chatTags {
          id
          chatId
          tagId
          createdAt
          tag {
            id
            name
            isActive
            createdAt
          }
        }
      }
    }
  `,

  UPDATE_CHAT_LATEST_READ: `
    mutation UpdateChatLatestRead($chatLatestReadInput: ChatLatestReadInput!) {
      updateChatLatestRead(chatLatestReadInput: $chatLatestReadInput) {
        id
        latestReadTimestamp
      }
    }
  `,
};
