import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';

import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { I18nService } from 'nestjs-i18n';
import { v4 as uuidv4 } from 'uuid';

import { FilterInput } from '@/common/dto/filter.args';
import { PaginationArgs } from '@/common/dto/pagination.args';
import { buildWhereClause } from '@/common/utils/filter.drizzle';
import { DrizzleDB, DrizzleTransaction, InjectDrizzle, TenantSchemaService } from '@/drizzle';
import { TenantTables } from '@@/drizzle/tenant/schema';

import { CreateFilterGroupInput } from './chat-assignment-filter/dto/create-chat-assign-filter.input';
import {
  ChatAssignFilterGroup,
  ChatAssignFilterItem,
} from './chat-assignment-filter/entities/chat-assign-filter.entity';
import { FilterTargetType } from './chat-assignment-filter/enums';
import { MIN_STATEMENTS_IN_SUBGROUP } from './constants';
import { CreateChatAssignRuleInput } from './dto/create-chat-assign-rule.input';
import { UpdateChatAssignRuleInput } from './dto/update-chat-assign-rule.input';
import { ChatAssignRule } from './entities/chat-assign-rule.entity';

type RawRule = {
  id: string;
  name: string;
  note: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date | null;
  chatAssignRuleTargetTeams: Array<{
    id: string;
    ruleId: string;
    teamId: string;
  }>;
};

type RawFilterGroupItem = {
  id: string;
  groupId: string;
  filterId: string;
  chatAssignFilter: {
    id: string;
    name: string;
    targetTable: string;
  };
};

@Injectable()
export class ChatAssignRuleService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly i18n: I18nService,
    private readonly tenantSchema: TenantSchemaService,
  ) {}

  private readonly logger = new Logger(ChatAssignRuleService.name);

  async findAll(
    paginationArgs: PaginationArgs,
    organizationId: string,
    filter?: FilterInput | import('./dto/chat-assign-rule-filter.input').ChatAssignRuleFilterInput,
  ): Promise<{ items: ChatAssignRule[]; count: number }> {
    const { skip, take } = paginationArgs || {};
    const tenant = this.tenantSchema.getTables(organizationId);

    const searchValue = (filter as FilterInput | undefined)?.searchValue?.trim();
    const filterWhere = buildWhereClause(
      {
        refineConditions: (filter as FilterInput | undefined)?.refineConditions,
        searchValue,
        searchFields: ['name'],
      },
      tenant.chatAssignRule as any,
      this.i18n,
    );

    const combinedFilter = filterWhere;

    const where = combinedFilter;

    let query: any = this.db
      .select()
      .from(tenant.chatAssignRule)
      .where(where)
      .orderBy(desc(tenant.chatAssignRule.createdAt), desc(tenant.chatAssignRule.id));

    if (skip) query = query.offset(skip);
    if (take) query = query.limit(take);

    const rules: any[] = await query;

    const ruleIds = rules.map((r: any) => r.id);

    const targetTeams = ruleIds.length
      ? await this.db
          .select()
          .from(tenant.chatAssignRuleTargetTeam)
          .where(inArray(tenant.chatAssignRuleTargetTeam.ruleId, ruleIds))
      : [];

    const targetTeamsByRuleId = targetTeams.reduce((map, t) => {
      const existing = map.get(t.ruleId) ?? [];
      existing.push(t);
      map.set(t.ruleId, existing);
      return map;
    }, new Map<string, Array<{ id: string; ruleId: string; teamId: string }>>());

    const rulesWithTeams: RawRule[] = rules.map((rule: any) => ({
      ...rule,
      chatAssignRuleTargetTeams: targetTeamsByRuleId.get(rule.id) ?? [],
    }));

    const items = await Promise.all(rulesWithTeams.map((r) => this.aggregateRule(r, tenant)));

    const { c } = await this.db
      .select({ c: count() })
      .from(tenant.chatAssignRule)
      .where(where)
      .then((rows) => rows[0]);

    return { items, count: c };
  }

  async findOneById(organizationId: string, id: string) {
    const tenant = this.tenantSchema.getTables(organizationId);

    const rule = await this.db
      .select()
      .from(tenant.chatAssignRule)
      .where(eq(tenant.chatAssignRule.id, id))
      .then((rows) => rows[0] || null);

    if (!rule) {
      throw new NotFoundException(
        this.i18n.t('errors.chatAssignRule.ruleNotFound', { args: { id } }),
      );
    }

    const targetTeams = await this.db
      .select()
      .from(tenant.chatAssignRuleTargetTeam)
      .where(eq(tenant.chatAssignRuleTargetTeam.ruleId, id));

    const ruleWithTeams: RawRule = {
      ...rule,
      chatAssignRuleTargetTeams: targetTeams,
    };

    return this.aggregateRule(ruleWithTeams, tenant);
  }

  async create(input: CreateChatAssignRuleInput, organizationId: string) {
    const { targetTeamIds, name, rootFilterGroup, note } = input;
    const tenant = this.tenantSchema.getTables(organizationId);

    await this.validateRuleNameDuplicate(name!, tenant);
    this.validateAndDetectCycles(rootFilterGroup);

    try {
      const ruleId = uuidv4();
      await this.db.transaction(async (tx) => {
        await this.validateTeamsExist(targetTeamIds, tenant, tx);
        await this.createChatAssignRule(tx, tenant, {
          ruleId,
          name,
          note,
          targetTeamIds,
        });
        await this.upsertFilterGroupTree(tx, tenant, {
          group: rootFilterGroup,
          ruleId,
          isRoot: true,
        });
      });

      return this.findOneById(organizationId, ruleId);
    } catch (error) {
      this.logger.error(`Failed to create rule: ${error}`);
      throw this.handleError(error, 'createFailed');
    }
  }

  async update(input: UpdateChatAssignRuleInput, organizationId: string) {
    const { id, targetTeamIds, rootFilterGroup, ...rest } = input;
    const tenant = this.tenantSchema.getTables(organizationId);
    const currentRule = await this.validateRuleExist(id, tenant);
    if (currentRule.name !== rest.name) {
      await this.validateRuleNameDuplicate(rest.name, tenant);
    }

    try {
      await this.db.transaction(async (tx) => {
        const updateData: Partial<typeof tenant.chatAssignRule.$inferInsert> = {
          ...rest,
          updatedAt: new Date(),
        };

        if (targetTeamIds) {
          await this.updateTargetTeams(tx, tenant, id, targetTeamIds);
        }

        if (rootFilterGroup) {
          this.validateAndDetectCycles(rootFilterGroup);
          await this.replaceFilterGroupTree(tx, tenant, id, rootFilterGroup);
        }

        await tx
          .update(tenant.chatAssignRule)
          .set(updateData)
          .where(eq(tenant.chatAssignRule.id, id));
      });

      return this.findOneById(organizationId, id);
    } catch (error) {
      this.logger.error(`Failed to update rule ${id}: ${error}`);
      throw this.handleError(error, 'updateFailed');
    }
  }

  async remove(organizationId: string, id: string) {
    const tenant = this.tenantSchema.getTables(organizationId);
    await this.validateRuleExist(id, tenant);
    try {
      const [rule] = await this.db
        .update(tenant.chatAssignRule)
        .set({ isActive: false })
        .where(eq(tenant.chatAssignRule.id, id))
        .returning();
      return rule;
    } catch (error) {
      this.logger.error(`Failed to remove rule ${id}: ${error}`);
      throw this.handleError(error, 'removeFailed');
    }
  }

  private async createChatAssignRule(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    params: Omit<CreateChatAssignRuleInput, 'rootFilterGroup'> & {
      ruleId: string;
    },
  ) {
    const { ruleId, name, note, targetTeamIds } = params;

    await tx.insert(tenant.chatAssignRule).values({
      id: ruleId,
      name,
      note: note ?? null,
      createdAt: new Date(),
    });

    if (targetTeamIds.length) {
      await tx
        .insert(tenant.chatAssignRuleTargetTeam)
        .values(targetTeamIds.map((teamId) => ({ id: uuidv4(), ruleId, teamId })));
    }
  }

  private async upsertFilterGroup(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    group: CreateFilterGroupInput & { id?: string },
    ruleId: string,
    isRoot = false,
  ): Promise<string> {
    const groupId = group.id || uuidv4();

    await tx
      .insert(tenant.chatAssignFilterGroup)
      .values({
        id: groupId,
        ruleId,
        logicalOperator: group.logicalOperator,
        isRoot,
      })
      .onConflictDoUpdate({
        target: [tenant.chatAssignFilterGroup.id],
        set: {
          logicalOperator: group.logicalOperator,
          isRoot,
        },
      });

    if (group.filterIds?.length) {
      await tx
        .delete(tenant.chatAssignFilterGroupItem)
        .where(eq(tenant.chatAssignFilterGroupItem.groupId, groupId));
      await tx.insert(tenant.chatAssignFilterGroupItem).values(
        group.filterIds.map((filterId) => ({
          id: uuidv4(),
          groupId,
          filterId,
        })),
      );
    }

    return groupId;
  }

  private async upsertFilterGroupTree(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    params: {
      group: CreateFilterGroupInput & { id?: string };
      ruleId: string;
      parentId?: string;
      isRoot?: boolean;
    },
  ) {
    const { group, ruleId, parentId, isRoot = false } = params;

    const groupId = await this.upsertFilterGroup(tx, tenant, group, ruleId, isRoot);

    const parentAncestors =
      isRoot || !parentId
        ? []
        : await tx
            .select({
              ancestorGroupId: tenant.chatAssignFilterGroupClosure.ancestorGroupId,
              depth: tenant.chatAssignFilterGroupClosure.depth,
            })
            .from(tenant.chatAssignFilterGroupClosure)
            .where(
              and(
                eq(tenant.chatAssignFilterGroupClosure.ruleId, ruleId),
                eq(tenant.chatAssignFilterGroupClosure.descendantGroupId, parentId),
              ),
            );

    const closureRows = [
      { ruleId, ancestorGroupId: groupId, descendantGroupId: groupId, depth: 0 },
      ...parentAncestors.map((a) => ({
        ruleId,
        ancestorGroupId: a.ancestorGroupId,
        descendantGroupId: groupId,
        depth: a.depth + 1,
      })),
    ];

    await tx.insert(tenant.chatAssignFilterGroupClosure).values(closureRows).onConflictDoNothing();

    for (const subGroup of group.subGroups ?? []) {
      await this.upsertFilterGroupTree(tx, tenant, { group: subGroup, ruleId, parentId: groupId });
    }
  }

  private async replaceFilterGroupTree(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    ruleId: string,
    newRootGroup: CreateFilterGroupInput,
  ) {
    const root = await this.getRuleRootFilterGroup(tenant, ruleId, tx);

    await this.cleanupFilterGroupTree(tx, tenant, ruleId, root.id);

    await this.upsertFilterGroupTree(tx, tenant, {
      group: { ...newRootGroup, id: root.id },
      ruleId,
      isRoot: true,
    });
  }

  private async cleanupFilterGroupTree(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    ruleId: string,
    rootId: string,
  ) {
    const subtreeIds = await tx
      .select({ descendantGroupId: tenant.chatAssignFilterGroupClosure.descendantGroupId })
      .from(tenant.chatAssignFilterGroupClosure)
      .where(
        and(
          eq(tenant.chatAssignFilterGroupClosure.ruleId, ruleId),
          eq(tenant.chatAssignFilterGroupClosure.ancestorGroupId, rootId),
        ),
      );

    const allIds = subtreeIds.map((s) => s.descendantGroupId);
    if (allIds.length) {
      await tx
        .delete(tenant.chatAssignFilterGroupItem)
        .where(inArray(tenant.chatAssignFilterGroupItem.groupId, allIds));
    }

    const descendantIds = allIds.filter((id) => id !== rootId);
    if (descendantIds.length) {
      await tx
        .delete(tenant.chatAssignFilterGroup)
        .where(inArray(tenant.chatAssignFilterGroup.id, descendantIds));
    }
  }

  private async aggregateFilters(filters: RawFilterGroupItem[]): Promise<ChatAssignFilterItem[]> {
    return filters.map(({ chatAssignFilter, ...rest }) => {
      return {
        ...rest,
        id: chatAssignFilter.id,
        name: chatAssignFilter.name,
        targetTable: chatAssignFilter.targetTable as FilterTargetType,
      };
    });
  }

  private async aggregateRule(rawRule: RawRule, tenant: TenantTables): Promise<ChatAssignRule> {
    const {
      id: ruleId,
      name,
      note,
      isActive,
      chatAssignRuleTargetTeams,
      createdAt,
      updatedAt,
    } = rawRule;

    const rootGroup = await this.getRuleRootFilterGroup(tenant, ruleId);

    const allGroups = await this.db
      .select({
        id: tenant.chatAssignFilterGroup.id,
        logicalOperator: tenant.chatAssignFilterGroup.logicalOperator,
      })
      .from(tenant.chatAssignFilterGroup)
      .where(eq(tenant.chatAssignFilterGroup.ruleId, ruleId));

    const groupIds = allGroups.map((g) => g.id);

    const filters = groupIds.length
      ? await this.db
          .select({
            id: tenant.chatAssignFilterGroupItem.id,
            groupId: tenant.chatAssignFilterGroupItem.groupId,
            filterId: tenant.chatAssignFilterGroupItem.filterId,
            chatAssignFilter: {
              id: tenant.chatAssignFilter.id,
              name: tenant.chatAssignFilter.name,
              targetTable: tenant.chatAssignFilter.targetTable,
            },
          })
          .from(tenant.chatAssignFilterGroupItem)
          .innerJoin(
            tenant.chatAssignFilter,
            eq(tenant.chatAssignFilterGroupItem.filterId, tenant.chatAssignFilter.id),
          )
          .where(inArray(tenant.chatAssignFilterGroupItem.groupId, groupIds))
      : [];

    const aggregatedFilters = await this.aggregateFilters(filters as RawFilterGroupItem[]);

    const edges = await this.db
      .select({
        ancestorGroupId: tenant.chatAssignFilterGroupClosure.ancestorGroupId,
        descendantGroupId: tenant.chatAssignFilterGroupClosure.descendantGroupId,
      })
      .from(tenant.chatAssignFilterGroupClosure)
      .where(
        and(
          eq(tenant.chatAssignFilterGroupClosure.ruleId, ruleId),
          eq(tenant.chatAssignFilterGroupClosure.depth, 1),
        ),
      );

    const rootFilterGroup = this.buildFilterTree(rootGroup.id, allGroups, aggregatedFilters, edges);

    const targetTeamIds = chatAssignRuleTargetTeams.map((t) => t.teamId);
    const targetTeams =
      targetTeamIds.length > 0
        ? await this.db.select().from(tenant.team).where(inArray(tenant.team.id, targetTeamIds))
        : [];

    return {
      id: ruleId,
      name,
      isActive,
      rootFilterGroup,
      targetTeams,
      note,
      createdAt,
      updatedAt,
    };
  }

  private buildFilterTree(
    rootId: string,
    groups: { id: string; logicalOperator: string }[],
    filters: any[],
    edges: { ancestorGroupId: string; descendantGroupId: string }[],
  ): ChatAssignFilterGroup {
    const groupById = new Map(groups.map((g) => [g.id, g]));
    const filtersByGroup = new Map<string, typeof filters>();
    const childrenByAncestor = new Map<string, string[]>();

    for (const f of filters) {
      (filtersByGroup.get(f.groupId) ?? filtersByGroup.set(f.groupId, []).get(f.groupId))!.push(f);
    }

    for (const e of edges) {
      (childrenByAncestor.get(e.ancestorGroupId) ??
        childrenByAncestor.set(e.ancestorGroupId, []).get(e.ancestorGroupId))!.push(
        e.descendantGroupId,
      );
    }

    const build = (groupId: string): ChatAssignFilterGroup => {
      const g = groupById.get(groupId)!;
      return {
        id: g.id,
        logicalOperator: g.logicalOperator as any,
        filters: filtersByGroup.get(groupId) ?? [],
        subGroups: (childrenByAncestor.get(groupId) ?? []).map(build),
      };
    };

    return build(rootId);
  }

  /**
   * Validates filter group structure and detects cycles in the nested hierarchy.
   *
   * NOTE:
   * - Cycle Detection: A cycle occurs when a filter group (or any nested subgroup) references
   *   itself either directly or indirectly through its subGroups. The function uses a `visited` Set
   *   to track group IDs during traversal. If a group ID is encountered that already exists in the
   *   visited set, it indicates a circular reference (e.g., Group A contains Group B, which contains
   *   Group A again).
   *
   * - Performance: This function performs a full depth-first traversal of the entire filter group
   *   tree on each invocation. Time complexity is O(n) where n is the number of groups. It's called
   *   during create/update operations only (not during reads), so it's not a hot path for frequent
   *   queries.
   */
  private validateAndDetectCycles(
    group: CreateFilterGroupInput & { id?: string },
    visited = new Set<string>(),
    isRoot = true,
  ) {
    if (!group) {
      throw new BadRequestException(this.i18n.t('errors.chatAssignRule.filterGroupRequired'));
    }

    const { filterIds = [], subGroups = [], logicalOperator } = group;

    if (!filterIds.length && !subGroups.length) {
      throw new BadRequestException(this.i18n.t('errors.chatAssignRule.filterGroupEmpty'));
    }
    if (!logicalOperator) {
      throw new BadRequestException(this.i18n.t('errors.chatAssignRule.logicalOperatorRequired'));
    }

    if (!isRoot && filterIds.length + subGroups.length < MIN_STATEMENTS_IN_SUBGROUP) {
      throw new BadRequestException(
        this.i18n.t('errors.chatAssignRule.innerGroupMinCriterias', {
          args: { minCriteria: MIN_STATEMENTS_IN_SUBGROUP },
        }),
      );
    }

    group.id ||= uuidv4();
    if (visited.has(group.id)) {
      throw new BadRequestException(this.i18n.t('errors.chatAssignRule.groupCycleDetected'));
    }

    const nextVisited = new Set(visited).add(group.id);
    for (const sub of subGroups) {
      this.validateAndDetectCycles(sub, nextVisited, false);
    }
  }

  private async validateTeamsExist(
    teamIds: string[],
    tenant: TenantTables,
    tx?: DrizzleTransaction,
  ) {
    if (!teamIds.length) return;

    const db = tx ?? this.db;

    const teams = await db
      .select({ id: tenant.team.id })
      .from(tenant.team)
      .where(and(eq(tenant.team.isActive, true), inArray(tenant.team.id, teamIds)));

    if (teams.length !== teamIds.length) {
      throw new BadRequestException(this.i18n.t('errors.chatAssignRule.teamsNotFound'));
    }
  }

  private async validateRuleExist(id: string, tenant: TenantTables) {
    const rule = await this.db
      .select()
      .from(tenant.chatAssignRule)
      .where(eq(tenant.chatAssignRule.id, id))
      .then((rows) => rows[0] || null);

    if (!rule) {
      throw new NotFoundException(
        this.i18n.t('errors.chatAssignRule.ruleNotFound', { args: { id } }),
      );
    }
    return rule;
  }

  private async validateRuleNameDuplicate(name: string | undefined, tenant: TenantTables) {
    if (!name) return;

    const rule = await this.db
      .select()
      .from(tenant.chatAssignRule)
      .where(eq(tenant.chatAssignRule.name, name))
      .then((rows) => rows[0] || null);

    if (rule) {
      throw new BadRequestException(
        this.i18n.t('errors.chatAssignRule.duplicatedName', { args: { name } }),
      );
    }
  }

  private async getRuleRootFilterGroup(
    tenant: TenantTables,
    ruleId: string,
    tx?: DrizzleDB | DrizzleTransaction,
  ) {
    const db = tx ?? this.db;

    const root = await db
      .select({ id: tenant.chatAssignFilterGroup.id })
      .from(tenant.chatAssignFilterGroup)
      .where(
        and(
          eq(tenant.chatAssignFilterGroup.ruleId, ruleId),
          eq(tenant.chatAssignFilterGroup.isRoot, true),
        ),
      )
      .then((rows) => rows[0] || null);

    if (!root) {
      throw new BadRequestException(this.i18n.t('errors.chatAssignRule.rootGroupNotFound'));
    }

    return root;
  }

  private async updateTargetTeams(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    ruleId: string,
    targetTeamIds: string[],
  ) {
    await this.validateTeamsExist(targetTeamIds, tenant, tx);

    await tx
      .delete(tenant.chatAssignRuleTargetTeam)
      .where(eq(tenant.chatAssignRuleTargetTeam.ruleId, ruleId));

    if (targetTeamIds.length) {
      await tx.insert(tenant.chatAssignRuleTargetTeam).values(
        targetTeamIds.map((teamId) => ({
          id: uuidv4(),
          ruleId,
          teamId,
        })),
      );
    }
  }

  private handleError(error: unknown, translationKey: string) {
    return error instanceof BadRequestException
      ? error
      : new BadRequestException(this.i18n.t(`errors.chatAssignRule.${translationKey}`));
  }
}
