import { STORE_IDS_FIELD } from '@/modules/chat-assignment-rule/chat-assignment-filter/constants';
import {
  ConditionOperator,
  FilterTargetType,
  LogicalOperator,
  ValueType,
} from '@/modules/chat-assignment-rule/chat-assignment-filter/enums';

import { CHAT_ASSIGN_RULE_QUERIES } from '../../fixtures/graphql/chat-assign-rule.queries';

import {
  ChatAssignRuleTestContext,
  cleanupSharedChatAssignRuleTestApp,
  getSharedChatAssignRuleTestApp,
  setupChatAssignRuleTests,
} from './chat-assign-rule-test.setup';

const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  // Note: these are thrown by OrganizationGuard before resolvers execute.
  RULE_NOT_FOUND_PREFIX: 'Rule with ID',
  FILTER_NOT_FOUND_PREFIX: 'Filter with ID',
  FILTER_DELETE_BLOCKED: 'Cannot delete filter that used in any rules',
} as const;

const VALIDATION_MESSAGES = {
  ARRAY_NOT_EMPTY: 'should not be empty',
} as const;

type AnyRecord = Record<string, any>;

class ChatAssignmentRuleTestValidators {
  static validateUuidLike(id: unknown): void {
    expect(typeof id).toBe('string');
    expect(id).not.toHaveLength(0);
  }

  static validateFilterItem(filter: AnyRecord, expected?: Partial<AnyRecord>): void {
    expect(filter).toBeDefined();
    this.validateUuidLike(filter.id);
    expect(typeof filter.name).toBe('string');
    expect(filter.name.length).toBeGreaterThan(0);
    expect(Object.values(FilterTargetType)).toContain(filter.targetTable);

    if (expected) {
      expect(filter).toMatchObject(expected);
    }
  }

  static conditionMatcher(expected: AnyRecord) {
    const matcher: AnyRecord = {
      field: expected.field,
      operator: expected.operator,
      valueType: expected.valueType,
    };

    // `value` is nullable on the GraphQL type.
    if (expected.value !== undefined) {
      matcher.value = expected.value;
    }

    if (expected.valueObjects) {
      matcher.valueObjects = expect.arrayContaining(
        expected.valueObjects.map((vo: AnyRecord) =>
          expect.objectContaining({
            id: String(vo.id),
            name: String(vo.name),
          }),
        ),
      );
    }

    return expect.objectContaining(matcher);
  }

  static validateConditionGroup(group: AnyRecord, expected: AnyRecord): void {
    expect(group).toBeDefined();
    expect(Object.values(LogicalOperator)).toContain(group.logicalOperator);
    expect(Array.isArray(group.conditions)).toBe(true);

    expect(group.logicalOperator).toBe(expected.logicalOperator);
    expect(group.conditions).toHaveLength(expected.conditions.length);
    expect(group.conditions).toEqual(
      expect.arrayContaining(expected.conditions.map((c: AnyRecord) => this.conditionMatcher(c))),
    );

    const expectedSubGroups = expected.subGroups ?? [];
    const actualSubGroups = group.subGroups ?? [];
    expect(Array.isArray(actualSubGroups)).toBe(true);
    expect(actualSubGroups).toHaveLength(expectedSubGroups.length);
    actualSubGroups.forEach((sg: AnyRecord, idx: number) =>
      this.validateConditionGroup(sg, expectedSubGroups[idx]),
    );
  }

  static validateFilter(filter: AnyRecord, expected: AnyRecord): void {
    expect(filter).toBeDefined();
    this.validateUuidLike(filter.id);
    expect(typeof filter.name).toBe('string');
    expect(Object.values(FilterTargetType)).toContain(filter.targetTable);
    expect(typeof filter.isActive).toBe('boolean');

    if (expected.name !== undefined) expect(filter.name).toBe(expected.name);
    if (expected.targetTable !== undefined) expect(filter.targetTable).toBe(expected.targetTable);
    if (expected.note !== undefined) expect(filter.note).toBe(expected.note);
    if (expected.isActive !== undefined) expect(filter.isActive).toBe(expected.isActive);

    this.validateConditionGroup(filter.rootConditionGroup, expected.rootConditionGroup);
  }

  static validateRule(rule: AnyRecord, expected: AnyRecord): void {
    expect(rule).toBeDefined();
    this.validateUuidLike(rule.id);
    expect(typeof rule.name).toBe('string');
    expect(typeof rule.isActive).toBe('boolean');

    if (expected.name !== undefined) expect(rule.name).toBe(expected.name);
    if (expected.note !== undefined) expect(rule.note).toBe(expected.note);
    if (expected.isActive !== undefined) expect(rule.isActive).toBe(expected.isActive);

    expect(Array.isArray(rule.targetTeams)).toBe(true);
    const targetTeamIds = rule.targetTeams.map((t: AnyRecord) => t.id);
    expected.targetTeamIds.forEach((id: string) => expect(targetTeamIds).toContain(id));

    expect(rule.rootFilterGroup).toBeDefined();
    expect(Object.values(LogicalOperator)).toContain(rule.rootFilterGroup.logicalOperator);
    expect(Array.isArray(rule.rootFilterGroup.filters)).toBe(true);
    expect(Array.isArray(rule.rootFilterGroup.subGroups ?? [])).toBe(true);
  }
}

class ChatAssignmentRuleTestHelpers {
  static storeIdsValue(values: number[]): string {
    return values.join(' ');
  }

  static storeIdsCondition(values: number[], operator: ConditionOperator): AnyRecord {
    return {
      field: STORE_IDS_FIELD,
      operator,
      value: this.storeIdsValue(values),
      valueType: ValueType.ARRAY,
    };
  }

  static storeIdsNullCondition(operator: ConditionOperator): AnyRecord {
    return {
      field: STORE_IDS_FIELD,
      operator,
      valueType: ValueType.ARRAY,
    };
  }

  static surveyCondition(
    field: string,
    operator: ConditionOperator,
    value: string,
    valueType: ValueType,
  ): AnyRecord {
    return { field, operator, value, valueType };
  }
}

describe('Chat Assignment Rule Module (E2E)', () => {
  let context: ChatAssignRuleTestContext;
  let org1: any;
  let adminToken: string;
  let managerToken: string;
  let operatorToken: string;
  let org2AdminToken: string;
  let team1: any;
  let team2: any;
  let store1: any;
  let store2: any;

  beforeAll(async () => {
    const baseContext = await getSharedChatAssignRuleTestApp();
    context = await setupChatAssignRuleTests(baseContext, 'chat_assignment_rule_test');
  });

  beforeEach(async () => {
    const updated = await setupChatAssignRuleTests(context, 'chat_assignment_rule_test');
    Object.assign(context, updated);

    org1 = context.org1;
    adminToken = context.adminToken;
    managerToken = context.managerToken;
    operatorToken = context.operatorToken;
    org2AdminToken = context.org2AdminToken;

    team1 = await context.factory.createTeam(org1.name, { name: 'Assignment Rule Team 1' });
    team2 = await context.factory.createTeam(org1.name, { name: 'Assignment Rule Team 2' });

    // Create deterministic stores for STORE_IDS_FIELD valueObjects mapping.
    store1 = await context.factory.createStore(org1.name, { name: 'Store #1', liglaStoreId: 1 });
    store2 = await context.factory.createStore(org1.name, { name: 'Store #2', liglaStoreId: 2 });
  });

  afterEach(async () => {
    await context.cleaner.cleanTestData();
  });

  afterAll(async () => {
    await cleanupSharedChatAssignRuleTestApp();
  });

  describe('ChatAssignFilter', () => {
    it('creates STORE filter with nested condition groups and returns valueObjects for storeIds', async () => {
      const createChatAssignFilterInput = {
        name: 'Filter - Store IDs (nested)',
        targetTable: FilterTargetType.STORE,
        rootConditionGroup: {
          logicalOperator: LogicalOperator.AND,
          conditions: [
            ChatAssignmentRuleTestHelpers.storeIdsCondition(
              [1],
              ConditionOperator.VALUES_MATCH_ANY,
            ),
          ],
          subGroups: [
            {
              logicalOperator: LogicalOperator.OR,
              conditions: [
                ChatAssignmentRuleTestHelpers.storeIdsCondition(
                  [2],
                  ConditionOperator.VALUES_MATCH_ANY,
                ),
                ChatAssignmentRuleTestHelpers.storeIdsNullCondition(ConditionOperator.NOT_NULL),
              ],
              subGroups: [],
            },
          ],
        },
      };

      const created = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.CREATE_FILTER,
        { createChatAssignFilterInput },
        adminToken,
      );

      ChatAssignmentRuleTestValidators.validateFilter(created.createChatAssignFilter, {
        name: createChatAssignFilterInput.name,
        targetTable: FilterTargetType.STORE,
        isActive: true,
        rootConditionGroup: {
          logicalOperator: LogicalOperator.AND,
          conditions: [
            {
              field: STORE_IDS_FIELD,
              operator: ConditionOperator.VALUES_MATCH_ANY,
              value: '1',
              valueType: ValueType.ARRAY,
              valueObjects: [{ id: 1, name: store1.name }],
            },
          ],
          subGroups: [
            {
              logicalOperator: LogicalOperator.OR,
              conditions: [
                {
                  field: STORE_IDS_FIELD,
                  operator: ConditionOperator.VALUES_MATCH_ANY,
                  value: '2',
                  valueType: ValueType.ARRAY,
                  valueObjects: [{ id: 2, name: store2.name }],
                },
                {
                  field: STORE_IDS_FIELD,
                  operator: ConditionOperator.NOT_NULL,
                  value: null,
                  valueType: ValueType.ARRAY,
                },
              ],
              subGroups: [],
            },
          ],
        },
      });
    });

    it('updates filter (name + note + rootConditionGroup replacement)', async () => {
      const created = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.CREATE_FILTER,
        {
          createChatAssignFilterInput: {
            name: 'Filter - Update Me',
            targetTable: FilterTargetType.SURVEY,
            rootConditionGroup: {
              logicalOperator: LogicalOperator.AND,
              conditions: [
                ChatAssignmentRuleTestHelpers.surveyCondition(
                  'category1',
                  ConditionOperator.EQUAL,
                  'before',
                  ValueType.STRING,
                ),
              ],
              subGroups: [],
            },
          },
        },
        adminToken,
      );

      const filterId = created.createChatAssignFilter.id as string;

      const updateChatAssignFilterInput = {
        id: filterId,
        name: 'Filter - Updated',
        note: 'Updated note',
        rootConditionGroup: {
          logicalOperator: LogicalOperator.OR,
          conditions: [
            ChatAssignmentRuleTestHelpers.surveyCondition(
              'category1',
              ConditionOperator.NOT_EQUAL,
              'after',
              ValueType.STRING,
            ),
            ChatAssignmentRuleTestHelpers.surveyCondition(
              'datetime1',
              ConditionOperator.GTE,
              '2025-12-08',
              ValueType.DATETIME,
            ),
          ],
          subGroups: [],
        },
      };

      await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.UPDATE_FILTER,
        { updateChatAssignFilterInput },
        adminToken,
      );

      const fetched = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.GET_FILTER,
        { id: filterId },
        adminToken,
      );

      ChatAssignmentRuleTestValidators.validateFilter(fetched.chatAssignFilter, {
        name: updateChatAssignFilterInput.name,
        note: updateChatAssignFilterInput.note,
        targetTable: FilterTargetType.SURVEY,
        isActive: true,
        rootConditionGroup: {
          logicalOperator: LogicalOperator.OR,
          conditions: [
            {
              field: 'category1',
              operator: ConditionOperator.NOT_EQUAL,
              value: 'after',
              valueType: ValueType.STRING,
            },
            {
              field: 'datetime1',
              operator: ConditionOperator.GTE,
              value: '2025-12-08',
              valueType: ValueType.DATETIME,
            },
          ],
          subGroups: [],
        },
      });
    });

    it('soft-deletes filter and keeps it queryable by id', async () => {
      const created = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.CREATE_FILTER,
        {
          createChatAssignFilterInput: {
            name: 'Filter - Delete Me',
            targetTable: FilterTargetType.STORE,
            rootConditionGroup: {
              logicalOperator: LogicalOperator.AND,
              conditions: [
                ChatAssignmentRuleTestHelpers.storeIdsCondition(
                  [1, 2],
                  ConditionOperator.VALUES_MATCH_ANY,
                ),
              ],
              subGroups: [],
            },
          },
        },
        adminToken,
      );

      const filterId = created.createChatAssignFilter.id as string;

      const deleted = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.DELETE_FILTER,
        { id: filterId },
        adminToken,
      );

      expect(deleted.deleteChatAssignFilter).toMatchObject({ id: filterId });

      const fetched = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.GET_FILTER,
        { id: filterId },
        adminToken,
      );

      expect(fetched.chatAssignFilter.isActive).toBe(false);
    });

    it('lists filters per-organization (no cross-tenant leakage)', async () => {
      await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.CREATE_FILTER,
        {
          createChatAssignFilterInput: {
            name: 'Filter - Org1 Only',
            targetTable: FilterTargetType.SURVEY,
            rootConditionGroup: {
              logicalOperator: LogicalOperator.AND,
              conditions: [
                ChatAssignmentRuleTestHelpers.surveyCondition(
                  'category1',
                  ConditionOperator.INCLUDE,
                  'KEY',
                  ValueType.STRING,
                ),
              ],
              subGroups: [],
            },
          },
        },
        adminToken,
      );

      const org1List = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.GET_FILTERS,
        { skip: 0, take: 10 },
        adminToken,
      );

      expect(Array.isArray(org1List.chatAssignFilters.items)).toBe(true);
      expect(org1List.chatAssignFilters.items).toHaveLength(1);
      expect(org1List.chatAssignFilters.count).toBe(1);
      ChatAssignmentRuleTestValidators.validateFilterItem(org1List.chatAssignFilters.items[0]);

      const org2List = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.GET_FILTERS,
        { skip: 0, take: 10 },
        org2AdminToken,
      );

      expect(Array.isArray(org2List.chatAssignFilters.items)).toBe(true);
      expect(org2List.chatAssignFilters.items).toHaveLength(0);
      expect(org2List.chatAssignFilters.count).toBe(0);
    });
  });

  describe('ChatAssignRule', () => {
    it('creates rule with nested filter groups (OR + AND subgroup) and resolves target teams', async () => {
      const storeFilter = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.CREATE_FILTER,
        {
          createChatAssignFilterInput: {
            name: 'Filter - Stores',
            targetTable: FilterTargetType.STORE,
            rootConditionGroup: {
              logicalOperator: LogicalOperator.AND,
              conditions: [
                ChatAssignmentRuleTestHelpers.storeIdsCondition(
                  [1],
                  ConditionOperator.VALUES_MATCH_ANY,
                ),
              ],
              subGroups: [],
            },
          },
        },
        adminToken,
      );

      const surveyFilter = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.CREATE_FILTER,
        {
          createChatAssignFilterInput: {
            name: 'Filter - Survey',
            targetTable: FilterTargetType.SURVEY,
            rootConditionGroup: {
              logicalOperator: LogicalOperator.AND,
              conditions: [
                ChatAssignmentRuleTestHelpers.surveyCondition(
                  'category1',
                  ConditionOperator.NOT_INCLUDE,
                  'BLOCK',
                  ValueType.STRING,
                ),
                ChatAssignmentRuleTestHelpers.surveyCondition(
                  'category2',
                  ConditionOperator.REGEX,
                  '^[A-Za-z]+$',
                  ValueType.STRING,
                ),
              ],
              subGroups: [],
            },
          },
        },
        adminToken,
      );

      // Non-root groups must have at least 2 criterias; use 2 filters in the AND subgroup.
      const surveyFilter2 = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.CREATE_FILTER,
        {
          createChatAssignFilterInput: {
            name: 'Filter - Survey (secondary)',
            targetTable: FilterTargetType.SURVEY,
            rootConditionGroup: {
              logicalOperator: LogicalOperator.AND,
              conditions: [
                ChatAssignmentRuleTestHelpers.surveyCondition(
                  'category3',
                  ConditionOperator.EQUAL,
                  'ok',
                  ValueType.STRING,
                ),
              ],
              subGroups: [],
            },
          },
        },
        adminToken,
      );

      const createChatAssignRuleInput = {
        name: 'Rule - Nested Groups',
        note: 'OR(storeFilter) OR(AND(surveyFilter))',
        targetTeamIds: [team1.id, team2.id],
        rootFilterGroup: {
          logicalOperator: LogicalOperator.OR,
          filterIds: [storeFilter.createChatAssignFilter.id],
          subGroups: [
            {
              logicalOperator: LogicalOperator.AND,
              filterIds: [
                surveyFilter.createChatAssignFilter.id,
                surveyFilter2.createChatAssignFilter.id,
              ],
              subGroups: [],
            },
          ],
        },
      };

      const created = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.CREATE_RULE,
        { createChatAssignRuleInput },
        adminToken,
      );

      ChatAssignmentRuleTestValidators.validateRule(created.createChatAssignRule, {
        name: createChatAssignRuleInput.name,
        note: createChatAssignRuleInput.note,
        isActive: true,
        targetTeamIds: [team1.id, team2.id],
      });

      // Deep check structure via GET_RULE.
      const ruleId = created.createChatAssignRule.id as string;
      const fetched = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.GET_RULE,
        { id: ruleId },
        adminToken,
      );

      const rule = fetched.chatAssignRule;
      ChatAssignmentRuleTestValidators.validateRule(rule, {
        name: createChatAssignRuleInput.name,
        note: createChatAssignRuleInput.note,
        isActive: true,
        targetTeamIds: [team1.id, team2.id],
      });

      expect(rule.rootFilterGroup.logicalOperator).toBe(LogicalOperator.OR);
      expect(rule.rootFilterGroup.filters).toHaveLength(1);
      expect(rule.rootFilterGroup.filters[0]).toMatchObject({
        id: storeFilter.createChatAssignFilter.id,
        name: storeFilter.createChatAssignFilter.name,
        targetTable: FilterTargetType.STORE,
      });
      expect(rule.rootFilterGroup.subGroups).toHaveLength(1);
      expect(rule.rootFilterGroup.subGroups[0].logicalOperator).toBe(LogicalOperator.AND);
      expect(rule.rootFilterGroup.subGroups[0].filters).toHaveLength(2);
      expect(rule.rootFilterGroup.subGroups[0].filters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: surveyFilter.createChatAssignFilter.id,
            name: surveyFilter.createChatAssignFilter.name,
            targetTable: FilterTargetType.SURVEY,
          }),
          expect.objectContaining({
            id: surveyFilter2.createChatAssignFilter.id,
            name: surveyFilter2.createChatAssignFilter.name,
            targetTable: FilterTargetType.SURVEY,
          }),
        ]),
      );
    });

    it('updates rule (name + note + isActive + target teams)', async () => {
      const filter = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.CREATE_FILTER,
        {
          createChatAssignFilterInput: {
            name: 'Filter - For Rule Update',
            targetTable: FilterTargetType.STORE,
            rootConditionGroup: {
              logicalOperator: LogicalOperator.AND,
              conditions: [
                ChatAssignmentRuleTestHelpers.storeIdsCondition(
                  [1],
                  ConditionOperator.VALUES_MATCH_ANY,
                ),
              ],
              subGroups: [],
            },
          },
        },
        adminToken,
      );

      const createdRule = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.CREATE_RULE,
        {
          createChatAssignRuleInput: {
            name: 'Rule - Update Me',
            targetTeamIds: [team1.id],
            rootFilterGroup: {
              logicalOperator: LogicalOperator.AND,
              filterIds: [filter.createChatAssignFilter.id],
              subGroups: [],
            },
          },
        },
        adminToken,
      );

      const ruleId = createdRule.createChatAssignRule.id as string;

      const updateChatAssignRuleInput = {
        id: ruleId,
        name: 'Rule - Updated',
        note: 'Updated note',
        isActive: false,
        targetTeamIds: [team2.id],
      };

      const updated = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.UPDATE_RULE,
        { updateChatAssignRuleInput },
        adminToken,
      );

      expect(updated.updateChatAssignRule).toMatchObject({
        id: ruleId,
        name: updateChatAssignRuleInput.name,
        note: updateChatAssignRuleInput.note,
        isActive: updateChatAssignRuleInput.isActive,
      });

      const fetched = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.GET_RULE,
        { id: ruleId },
        adminToken,
      );

      ChatAssignmentRuleTestValidators.validateRule(fetched.chatAssignRule, {
        name: updateChatAssignRuleInput.name,
        note: updateChatAssignRuleInput.note,
        isActive: false,
        targetTeamIds: [team2.id],
      });
    });

    it('soft-deletes rule and keeps it queryable by id', async () => {
      const filter = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.CREATE_FILTER,
        {
          createChatAssignFilterInput: {
            name: 'Filter - For Rule Delete',
            targetTable: FilterTargetType.SURVEY,
            rootConditionGroup: {
              logicalOperator: LogicalOperator.AND,
              conditions: [
                ChatAssignmentRuleTestHelpers.surveyCondition(
                  'category1',
                  ConditionOperator.EQUAL,
                  'test',
                  ValueType.STRING,
                ),
              ],
              subGroups: [],
            },
          },
        },
        adminToken,
      );

      const createdRule = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.CREATE_RULE,
        {
          createChatAssignRuleInput: {
            name: 'Rule - Delete Me',
            targetTeamIds: [team1.id],
            rootFilterGroup: {
              logicalOperator: LogicalOperator.AND,
              filterIds: [filter.createChatAssignFilter.id],
              subGroups: [],
            },
          },
        },
        adminToken,
      );

      const ruleId = createdRule.createChatAssignRule.id as string;

      const deleted = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.DELETE_RULE,
        { id: ruleId },
        adminToken,
      );

      expect(deleted.deleteChatAssignRule).toMatchObject({ id: ruleId });

      const fetched = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.GET_RULE,
        { id: ruleId },
        adminToken,
      );

      expect(fetched.chatAssignRule.isActive).toBe(false);
    });

    it('lists rules per-organization (no cross-tenant leakage)', async () => {
      const filter = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.CREATE_FILTER,
        {
          createChatAssignFilterInput: {
            name: 'Filter - For Org Isolation Rule',
            targetTable: FilterTargetType.STORE,
            rootConditionGroup: {
              logicalOperator: LogicalOperator.AND,
              conditions: [
                ChatAssignmentRuleTestHelpers.storeIdsCondition(
                  [1],
                  ConditionOperator.VALUES_MATCH_ANY,
                ),
              ],
              subGroups: [],
            },
          },
        },
        adminToken,
      );

      await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.CREATE_RULE,
        {
          createChatAssignRuleInput: {
            name: 'Rule - Org1 Only',
            targetTeamIds: [team1.id],
            rootFilterGroup: {
              logicalOperator: LogicalOperator.AND,
              filterIds: [filter.createChatAssignFilter.id],
              subGroups: [],
            },
          },
        },
        adminToken,
      );

      const org1List = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.GET_RULES,
        { skip: 0, take: 10 },
        adminToken,
      );
      expect(Array.isArray(org1List.chatAssignRules.items)).toBe(true);
      expect(org1List.chatAssignRules.items).toHaveLength(1);
      expect(org1List.chatAssignRules.count).toBe(1);

      const org2List = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.GET_RULES,
        { skip: 0, take: 10 },
        org2AdminToken,
      );
      expect(Array.isArray(org2List.chatAssignRules.items)).toBe(true);
      expect(org2List.chatAssignRules.items).toHaveLength(0);
      expect(org2List.chatAssignRules.count).toBe(0);
    });
  });

  describe('authorization + validation', () => {
    it('requires ADMIN role (filters + rules)', async () => {
      await context.client.queryExpectError(
        CHAT_ASSIGN_RULE_QUERIES.CREATE_FILTER,
        ERROR_MESSAGES.FORBIDDEN,
        {
          createChatAssignFilterInput: {
            name: 'Forbidden Filter',
            targetTable: FilterTargetType.STORE,
            rootConditionGroup: {
              logicalOperator: LogicalOperator.AND,
              conditions: [
                ChatAssignmentRuleTestHelpers.storeIdsCondition(
                  [1],
                  ConditionOperator.VALUES_MATCH_ANY,
                ),
              ],
              subGroups: [],
            },
          },
        },
        operatorToken,
      );

      await context.client.queryExpectError(
        CHAT_ASSIGN_RULE_QUERIES.CREATE_RULE,
        ERROR_MESSAGES.FORBIDDEN,
        {
          createChatAssignRuleInput: {
            name: 'Forbidden Rule',
            targetTeamIds: [team1.id],
            rootFilterGroup: {
              logicalOperator: LogicalOperator.AND,
              filterIds: [],
              subGroups: [],
            },
          },
        },
        managerToken,
      );
    });

    it('rejects unauthenticated access', async () => {
      await context.client.queryExpectError(
        CHAT_ASSIGN_RULE_QUERIES.GET_RULES,
        ERROR_MESSAGES.UNAUTHORIZED,
        { skip: 0, take: 1 },
      );
    });

    it('rejects creating rule with empty targetTeamIds (validation pipe)', async () => {
      const filter = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.CREATE_FILTER,
        {
          createChatAssignFilterInput: {
            name: 'Filter - For Empty Teams Validation',
            targetTable: FilterTargetType.STORE,
            rootConditionGroup: {
              logicalOperator: LogicalOperator.AND,
              conditions: [
                ChatAssignmentRuleTestHelpers.storeIdsCondition(
                  [1],
                  ConditionOperator.VALUES_MATCH_ANY,
                ),
              ],
              subGroups: [],
            },
          },
        },
        adminToken,
      );

      await context.client.queryExpectError(
        CHAT_ASSIGN_RULE_QUERIES.CREATE_RULE,
        VALIDATION_MESSAGES.ARRAY_NOT_EMPTY,
        {
          createChatAssignRuleInput: {
            name: 'Rule - Empty Target Teams',
            targetTeamIds: [],
            rootFilterGroup: {
              logicalOperator: LogicalOperator.AND,
              filterIds: [filter.createChatAssignFilter.id],
              subGroups: [],
            },
          },
        },
        adminToken,
      );
    });

    it('returns not found errors for unknown ids', async () => {
      await context.client.queryExpectError(
        CHAT_ASSIGN_RULE_QUERIES.GET_FILTER,
        ERROR_MESSAGES.FILTER_NOT_FOUND_PREFIX,
        { id: '00000000-0000-0000-0000-000000000000' },
        adminToken,
      );

      await context.client.queryExpectError(
        CHAT_ASSIGN_RULE_QUERIES.GET_RULE,
        ERROR_MESSAGES.RULE_NOT_FOUND_PREFIX,
        { id: '00000000-0000-0000-0000-000000000000' },
        adminToken,
      );
    });

    it('prevents deleting a filter that is used by any rules', async () => {
      const filter = await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.CREATE_FILTER,
        {
          createChatAssignFilterInput: {
            name: 'Filter - Linked to Rule',
            targetTable: FilterTargetType.STORE,
            rootConditionGroup: {
              logicalOperator: LogicalOperator.AND,
              conditions: [
                ChatAssignmentRuleTestHelpers.storeIdsCondition(
                  [1],
                  ConditionOperator.VALUES_MATCH_ANY,
                ),
              ],
              subGroups: [],
            },
          },
        },
        adminToken,
      );

      await context.client.queryExpectSuccess(
        CHAT_ASSIGN_RULE_QUERIES.CREATE_RULE,
        {
          createChatAssignRuleInput: {
            name: 'Rule - Uses Filter',
            targetTeamIds: [team1.id],
            rootFilterGroup: {
              logicalOperator: LogicalOperator.AND,
              filterIds: [filter.createChatAssignFilter.id],
              subGroups: [],
            },
          },
        },
        adminToken,
      );

      await context.client.queryExpectError(
        CHAT_ASSIGN_RULE_QUERIES.DELETE_FILTER,
        ERROR_MESSAGES.FILTER_DELETE_BLOCKED,
        { id: filter.createChatAssignFilter.id },
        adminToken,
      );
    });
  });
});
