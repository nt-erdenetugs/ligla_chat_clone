export const CHAT_NOTE_QUERIES = {
  GET_NOTES: `
    query Notes($chatId: String!) {
      notes(chatId: $chatId) {
        id
        chatId
        userId
        noteValue
        isActive
        createdAt
        updatedAt
        user {
          id
          displayName
        }
      }
    }
  `,

  CREATE_NOTE: `
    mutation CreateNote($createNoteInput: CreateChatNoteInput!) {
      createNote(createNoteInput: $createNoteInput) {
        id
        chatId
        userId
        noteValue
        isActive
        createdAt
        updatedAt
      }
    }
  `,

  UPDATE_NOTE: `
    mutation UpdateNote($updateNoteInput: UpdateChatNoteInput!) {
      updateNote(updateNoteInput: $updateNoteInput) {
        id
        chatId
        userId
        noteValue
        isActive
        createdAt
        updatedAt
        user {
          id
          displayName
        }
      }
    }
  `,

  REMOVE_NOTE: `
    mutation RemoveNote($id: String!, $chatId: String!) {
      removeNote(id: $id, chatId: $chatId) {
        id
        isActive
        updatedAt
        user {
          id
          displayName
        }
      }
    }
  `,
};
