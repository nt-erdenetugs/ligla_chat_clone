export const ORGANIZATION_QUERIES = {
  CREATE_ORGANIZATION: `
    mutation CreateOrganization($createOrganizationInput: CreateOrganizationInput!) {
      createOrganization(createOrganizationInput: $createOrganizationInput) {
        name
        displayName
        description
        apiKey
        maxOperator
        operatorCount
        loginLiffId
        fileUploadLiffId
        isActive
      }
    }
  `,

  GET_ORGANIZATIONS: `
    query Organizations($skip: Int, $take: Int, $filter: FilterInput) {
      organizations(skip: $skip, take: $take, filter: $filter) {
        count
        items {
          name
          displayName
          description
          apiKey
          maxOperator
          operatorCount
          loginLiffId
          fileUploadLiffId
          isActive
        }
      }
    }
  `,

  GET_ORGANIZATION: `
    query Organization($name: String!) {
      organization(name: $name) {
        name
        displayName
        description
        apiKey
        maxOperator
        operatorCount
        loginLiffId
        fileUploadLiffId
        isActive
      }
    }
  `,

  UPDATE_ORGANIZATION: `
    mutation UpdateOrganization($updateOrganizationInput: UpdateOrganizationInput!) {
      updateOrganization(updateOrganizationInput: $updateOrganizationInput) {
        name
        displayName
        description
        apiKey
        maxOperator
        operatorCount
        loginLiffId
        fileUploadLiffId
        isActive
      }
    }
  `,

  TOGGLE_ORGANIZATION_STATUS: `
    mutation ToggleOrganizationStatus($name: String!) {
      toggleOrganizationStatus(name: $name) {
        name
        displayName
        isActive
        maxOperator
        loginLiffId
        fileUploadLiffId
      }
    }
  `,

  GET_MAX_OPERATOR_COUNT: `
    query MaxOperatorCount {
      maxOperatorCount
    }
  `,
};
