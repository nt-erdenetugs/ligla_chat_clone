export const TAG_QUERIES = {
  GET_TAGS: `
    query Tags($skip: Int, $take: Int, $filter: FilterInput) {
      tags(skip: $skip, take: $take, filter: $filter) {
        items {
          id
          name
          isActive
          createdAt
        }
        count
      }
    }
  `,

  GET_CURSOR_PAGINATED_TAGS: `
    query CursorPaginatedTags($cursorId: String, $cursorCreatedAt: DateTime, $take: Int) {
      cursorPaginatedTags(cursorId: $cursorId, cursorCreatedAt: $cursorCreatedAt, take: $take) {
        items {
          id
          name
          isActive
          createdAt
        }
        nextCursorId
        nextCursorCreatedAt
        hasMore
      }
    }
  `,

  GET_TAG: `
    query Tag($id: String!) {
      tag(id: $id) {
        id
        name
        isActive
        createdAt
      }
    }
  `,

  CREATE_TAG: `
    mutation CreateTag($createTagInput: CreateTagInput!) {
      createTag(createTagInput: $createTagInput) {
        id
        name
        isActive
        createdAt
      }
    }
  `,

  UPDATE_TAG: `
    mutation UpdateTag($updateTagInput: UpdateTagInput!) {
      updateTag(updateTagInput: $updateTagInput) {
        id
        name
        isActive
        createdAt
      }
    }
  `,

  TOGGLE_TAG_STATUS: `
    mutation ToggleTagStatus($id: String!) {
      toggleTagStatus(id: $id) {
        id
        name
        isActive
        createdAt
      }
    }
  `,

  DISABLE_TAG: `
    mutation DisableTag($id: String!) {
      disableTag(id: $id) {
        id
        name
        isActive
        createdAt
      }
    }
  `,
};
