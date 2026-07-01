export const ATTRIBUTE_QUERIES = {
  GET_ATTRIBUTES: `
    query Attributes($skip: Int, $take: Int, $filter: FilterInput) {
      attributes(skip: $skip, take: $take, filter: $filter) {
        items {
          id
          name
          type
          isActive
          isEncryptionEnabled
          selectOption {
            id
            value
            label
          }
          createdAt
        }
        count
      }
    }
  `,

  GET_ATTRIBUTE: `
    query Attribute($id: String!) {
      attribute(id: $id) {
        id
        name
        type
        isActive
        isEncryptionEnabled
        selectOption {
          id
          value
          label
        }
        createdAt
      }
    }
  `,

  CREATE_ATTRIBUTE: `
    mutation CreateAttribute($createAttributeInput: CreateAttributeInput!) {
      createAttribute(createAttributeInput: $createAttributeInput) {
        id
        name
        type
        isActive
        isEncryptionEnabled
        selectOption {
          id
          value
          label
        }
        createdAt
      }
    }
  `,

  UPDATE_ATTRIBUTE: `
    mutation UpdateAttribute($updateAttributeInput: UpdateAttributeInput!) {
      updateAttribute(updateAttributeInput: $updateAttributeInput) {
        id
        name
        type
        isActive
        isEncryptionEnabled
        selectOption {
          id
          value
          label
        }
        createdAt
      }
    }
  `,

  TOGGLE_ATTRIBUTE_STATUS: `
    mutation ToggleAttributeStatus($id: String!) {
      toggleAttributeStatus(id: $id) {
        id
        name
        isActive
        isEncryptionEnabled
      }
    }
  `,

  DISABLE_ATTRIBUTE: `
    mutation DisableAttribute($id: String!) {
      disableAttribute(id: $id) {
        id
        name
        isActive
        isEncryptionEnabled
      }
    }
  `,

  FILL_CHAT_ATTRIBUTE_VALUE: `
    mutation FillChatAttributeValue($createChatAttributeValueInput: CreateChatAttributeValueInput!) {
      fillChatAttributeValue(createChatAttributeValueInput: $createChatAttributeValueInput) {
        id
        value
        attributeId
        chatId
        userId
      }
    }
  `,
};
