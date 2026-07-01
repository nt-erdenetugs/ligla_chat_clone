export const CHAT_ASSIGN_RULE_QUERIES = {
  GET_RULES: `
    query ChatAssignRules($skip: Int, $take: Int, $filter: FilterInput) {
      chatAssignRules(skip: $skip, take: $take, filter: $filter) {
        items {
          id
          name
          note
          isActive
          createdAt
          updatedAt
          rootFilterGroup {
            id
            logicalOperator
            filters {
              id
              name
              targetTable
            }
            subGroups {
              id
              logicalOperator
              filters {
                id
                name
                targetTable
              }
              subGroups {
                id
                logicalOperator
                filters {
                  id
                  name
                  targetTable
                }
                subGroups {
                  id
                  logicalOperator
                }
              }
            }
          }
          targetTeams {
            id
            name
          }
        }
        count
      }
    }
  `,

  GET_RULE: `
    query ChatAssignRule($id: String!) {
      chatAssignRule(id: $id) {
        id
        name
        note
        isActive
        createdAt
        updatedAt
        rootFilterGroup {
          id
          logicalOperator
          filters {
            id
            name
            targetTable
          }
          subGroups {
            id
            logicalOperator
            filters {
              id
              name
              targetTable
            }
            subGroups {
              id
              logicalOperator
              filters {
                id
                name
                targetTable
              }
              subGroups {
                id
                logicalOperator
              }
            }
          }
        }
        targetTeams {
          id
          name
        }
      }
    }
  `,

  CREATE_RULE: `
    mutation CreateChatAssignRule($createChatAssignRuleInput: CreateChatAssignRuleInput!) {
      createChatAssignRule(createChatAssignRuleInput: $createChatAssignRuleInput) {
        id
        name
        note
        isActive
        createdAt
        updatedAt
        rootFilterGroup {
          id
          logicalOperator
          filters {
            id
            name
            targetTable
          }
          subGroups {
            id
            logicalOperator
            filters {
              id
              name
              targetTable
            }
            subGroups {
              id
              logicalOperator
            }
          }
        }
        targetTeams {
          id
          name
        }
      }
    }
  `,

  UPDATE_RULE: `
    mutation UpdateChatAssignRule($updateChatAssignRuleInput: UpdateChatAssignRuleInput!) {
      updateChatAssignRule(updateChatAssignRuleInput: $updateChatAssignRuleInput) {
        id
        name
        note
        isActive
        updatedAt
      }
    }
  `,

  DELETE_RULE: `
    mutation DeleteChatAssignRule($id: String!) {
      deleteChatAssignRule(id: $id) {
        id
      }
    }
  `,

  GET_FILTERS: `
    query ChatAssignFilters($skip: Int, $take: Int, $filter: FilterInput) {
      chatAssignFilters: chatAssignFiltersWithCount(skip: $skip, take: $take, filter: $filter) {
        items {
          id
          name
          targetTable
          note
          isActive
          createdAt
          updatedAt
          rootConditionGroup {
            logicalOperator
            conditions {
              field
              operator
              value
              valueObjects {
                id
                name
              }
              valueType
            }
            subGroups {
              logicalOperator
              conditions {
                field
                operator
                value
                valueObjects {
                  id
                  name
                }
                valueType
              }
              subGroups {
                logicalOperator
                conditions {
                  field
                  operator
                  value
                  valueObjects {
                    id
                    name
                  }
                  valueType
                }
              }
            }
          }
        }
        count
      }
    }
  `,

  GET_FILTER: `
    query ChatAssignFilter($id: String!) {
      chatAssignFilter(id: $id) {
        id
        name
        targetTable
        note
        isActive
        createdAt
        updatedAt
        rootConditionGroup {
          logicalOperator
          conditions {
            field
            operator
            value
            valueObjects {
              id
              name
            }
            valueType
          }
          subGroups {
            logicalOperator
            conditions {
              field
              operator
              value
              valueObjects {
                id
                name
              }
              valueType
            }
            subGroups {
              logicalOperator
              conditions {
                field
                operator
                value
                valueObjects {
                  id
                  name
                }
                valueType
              }
            }
          }
        }
      }
    }
  `,

  CREATE_FILTER: `
    mutation CreateChatAssignFilter($createChatAssignFilterInput: CreateChatAssignFilterInput!) {
      createChatAssignFilter(createChatAssignFilterInput: $createChatAssignFilterInput) {
        id
        name
        targetTable
        note
        isActive
        createdAt
        updatedAt
        rootConditionGroup {
          logicalOperator
          conditions {
            field
            operator
            value
            valueObjects {
              id
              name
            }
            valueType
          }
          subGroups {
            logicalOperator
            conditions {
              field
              operator
              value
              valueObjects {
                id
                name
              }
              valueType
            }
          }
        }
      }
    }
  `,

  UPDATE_FILTER: `
    mutation UpdateChatAssignFilter($updateChatAssignFilterInput: UpdateChatAssignFilterInput!) {
      updateChatAssignFilter(updateChatAssignFilterInput: $updateChatAssignFilterInput) {
        id
        name
        targetTable
        note
        isActive
      }
    }
  `,

  DELETE_FILTER: `
    mutation DeleteChatAssignFilter($id: String!) {
      deleteChatAssignFilter(id: $id) {
        id
      }
    }
  `,

  GET_SELECTABLE_FILTERS: `
    query SelectableChatAssignFilters {
      selectableChatAssignFilters {
        id
        name
        targetTable
      }
    }
  `,
};
