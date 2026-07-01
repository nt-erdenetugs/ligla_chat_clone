export const STORE_QUERIES = {
  GET_STORES: `
    query Stores($skip: Int, $take: Int, $filter: FilterInput) {
      stores(skip: $skip, take: $take, filter: $filter) {
        items {
          id
          name
          isActive
          liglaStoreId
          areaName
          typeName
          note
          startsAt
          endsAt
          createdAt
        }
        count
      }
    }
  `,

  GET_STORES_CURSOR: `
    query StoresCursor($cursorId: String, $cursorCreatedAt: DateTime, $take: Int) {
      storesCursor(cursorId: $cursorId, cursorCreatedAt: $cursorCreatedAt, take: $take) {
        items {
          id
          name
          isActive
          liglaStoreId
          areaName
          typeName
          note
          startsAt
          endsAt
          createdAt
        }
        nextCursorId
        nextCursorCreatedAt
        hasMore
      }
    }
  `,

  GET_STORE: `
    query Store($id: String!) {
      store(id: $id) {
        id
        name
        isActive
        liglaStoreId
        areaName
        typeName
        note
        startsAt
        endsAt
        createdAt
      }
    }
  `,
};
