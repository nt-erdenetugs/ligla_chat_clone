import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';

import { and, count, desc, eq, exists, inArray } from 'drizzle-orm';
import { I18nService } from 'nestjs-i18n';
import { v4 as uuidv4 } from 'uuid';

import { FilterInput } from '@/common/dto/filter.args';
import { PaginationArgs } from '@/common/dto/pagination.args';
import { buildWhereClause } from '@/common/utils/filter.drizzle';
import { DrizzleDB, DrizzleTransaction, InjectDrizzle, TenantSchemaService } from '@/drizzle';
import * as schema from '@@/drizzle/schema';
import { TenantTables } from '@@/drizzle/tenant/schema';

import { MIN_STATEMENTS_IN_SUBGROUP } from '../constants';

import { ARRAY_VALUE_SEPARATOR, STORE_IDS_FIELD } from './constants';
import { CreateConditionGroupInput } from './dto/create-chat-assign-condition.input';
import { CreateChatAssignFilterInput } from './dto/create-chat-assign-filter.input';
import { UpdateChatAssignFilterInput } from './dto/update-chat-assign-filter.input';
import {
  ChatAssignCondition,
  ChatAssignConditionGroup,
} from './entities/chat-assign-condition.entity';
import { ChatAssignFilter } from './entities/chat-assign-filter.entity';
import { FilterTargetType } from './enums';

type DBChatAssignFilter = typeof schema.chatAssignFilter.$inferSelect;
type DBChatAssignCondition = typeof schema.chatAssignCondition.$inferSelect;

@Injectable()
export class ChatAssignFilterService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly i18n: I18nService,
    private readonly tenantSchema: TenantSchemaService,
  ) {}

  private readonly logger = new Logger(ChatAssignFilterService.name);

  async findAll(paginationArgs: PaginationArgs, organizationId: string, filter?: FilterInput) {
    const skip = paginationArgs.skip ?? 0;
    const take = paginationArgs.take ?? 100;
    const tenant = this.tenantSchema.getTables(organizationId);

    const where = buildWhereClause(
      {
        refineConditions: filter?.refineConditions,
        searchValue: filter?.searchValue,
        searchFields: ['name', 'note', 'targetTable'],
      },
      tenant.chatAssignFilter,
      this.i18n,
    );
    const filteredCount = await this.db
      .select({ c: count() })
      .from(tenant.chatAssignFilter)
      .where(where)
      .then((rows) => rows[0]?.c ?? 0);

    const filters = await this.db
      .select()
      .from(tenant.chatAssignFilter)
      .where(where)
      .orderBy(desc(tenant.chatAssignFilter.createdAt), desc(tenant.chatAssignFilter.updatedAt))
      .offset(skip)
      .limit(take);

    const items = await Promise.all(
      filters.map((filter) => this.aggregateFilter(filter as DBChatAssignFilter, tenant)),
    );
    return {
      items,
      count: filteredCount,
    };
  }

  async findAllForSelect(organizationId: string) {
    const tenant = this.tenantSchema.getTables(organizationId);
    return this.db
      .select({
        id: tenant.chatAssignFilter.id,
        name: tenant.chatAssignFilter.name,
        targetTable: tenant.chatAssignFilter.targetTable,
      })
      .from(tenant.chatAssignFilter)
      .where(eq(tenant.chatAssignFilter.isActive, true))
      .orderBy(desc(tenant.chatAssignFilter.createdAt), desc(tenant.chatAssignFilter.updatedAt));
  }

  async findOneById(organizationId: string, id: string) {
    const tenant = this.tenantSchema.getTables(organizationId);

    const filter = await this.db
      .select()
      .from(tenant.chatAssignFilter)
      .where(eq(tenant.chatAssignFilter.id, id))
      .then((rows) => rows[0] || null);

    if (!filter) {
      throw new NotFoundException(
        this.i18n.t('errors.chatAssignFilter.filterNotFound', { args: { id } }),
      );
    }

    return this.aggregateFilter(filter as DBChatAssignFilter, tenant);
  }

  async create(input: CreateChatAssignFilterInput, organizationId: string) {
    const { name, rootConditionGroup, targetTable, note } = input;
    const tenant = this.tenantSchema.getTables(organizationId);

    await this.validateRuleNameDuplicate(name!, tenant);
    this.validateAndDetectCycles(rootConditionGroup);

    try {
      const filterId = uuidv4();

      await this.db.transaction(async (tx) => {
        await this.createChatAssignFilter(tx, tenant, {
          filterId,
          name,
          targetTable,
          note,
        });
        await this.upsertConditionGroupTree(tx, tenant, {
          group: rootConditionGroup,
          filterId,
          isRoot: true,
        });
      });

      return this.findOneById(organizationId, filterId);
    } catch (error) {
      this.logger.error(`Failed to create rule: ${error}`);
      throw this.handleError(error, 'createFailed');
    }
  }

  async update(input: UpdateChatAssignFilterInput, organizationId: string) {
    const { id, rootConditionGroup, isActive, ...rest } = input;
    const tenant = this.tenantSchema.getTables(organizationId);
    const currentFilter = await this.validateFilterExist(id, tenant);
    if (currentFilter.name !== rest.name) {
      await this.validateRuleNameDuplicate(rest.name, tenant);
    }

    if (!isActive) {
      await this.validateFilterDeletion(id, tenant);
    }

    try {
      await this.db.transaction(async (tx) => {
        const updateData: Partial<typeof tenant.chatAssignFilter.$inferInsert> = {
          ...rest,
          isActive,
          updatedAt: new Date(),
        };

        if (rootConditionGroup) {
          this.validateAndDetectCycles(rootConditionGroup);
          await this.replaceConditionGroupTree(tx, tenant, id, rootConditionGroup);
        }

        await tx
          .update(tenant.chatAssignFilter)
          .set(updateData)
          .where(eq(tenant.chatAssignFilter.id, id));
      });

      return this.findOneById(organizationId, id);
    } catch (error) {
      this.logger.error(`Failed to update rule ${id}: ${error}`);
      throw this.handleError(error, 'updateFailed');
    }
  }

  async remove(organizationId: string, id: string) {
    const tenant = this.tenantSchema.getTables(organizationId);
    await this.validateFilterDeletion(id, tenant);

    const [filter] = await this.db
      .update(tenant.chatAssignFilter)
      .set({ isActive: false })
      .where(eq(tenant.chatAssignFilter.id, id))
      .returning();

    return filter;
  }

  private async validateFilterDeletion(filterId: string, tenant: TenantTables) {
    const { c } = await this.db
      .select({ c: count() })
      .from(tenant.chatAssignRule)
      .where(
        exists(
          this.db
            .select()
            .from(tenant.chatAssignFilterGroup)
            .innerJoin(
              tenant.chatAssignFilterGroupItem,
              and(
                eq(tenant.chatAssignFilterGroupItem.groupId, tenant.chatAssignFilterGroup.id),
                eq(tenant.chatAssignFilterGroupItem.filterId, filterId),
              ),
            )
            .where(eq(tenant.chatAssignFilterGroup.ruleId, tenant.chatAssignRule.id)),
        ),
      )
      .then((rows) => rows[0] || { c: 0 });

    if (c > 0) {
      throw new BadRequestException(this.i18n.t('errors.chatAssignFilter.cannotDeleteFilter'));
    }
  }

  private async createChatAssignFilter(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    params: Omit<CreateChatAssignFilterInput, 'rootConditionGroup'> & {
      filterId: string;
    },
  ) {
    const { filterId, name, targetTable, note } = params;

    await tx.insert(tenant.chatAssignFilter).values({
      id: filterId,
      name,
      targetTable,
      note: note ?? null,
      createdAt: new Date(),
    });
  }

  private async upsertConditionGroup(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    group: CreateConditionGroupInput & { id?: string },
    filterId: string,
    isRoot = false,
  ): Promise<string> {
    const groupId = group.id || uuidv4();

    await tx
      .insert(tenant.chatAssignConditionGroup)
      .values({
        id: groupId,
        filterId,
        logicalOperator: group.logicalOperator,
        isRoot,
      })
      .onConflictDoUpdate({
        target: [tenant.chatAssignConditionGroup.id],
        set: {
          logicalOperator: group.logicalOperator,
          isRoot,
        },
      });

    if (group.conditions?.length) {
      await tx
        .delete(tenant.chatAssignCondition)
        .where(eq(tenant.chatAssignCondition.groupId, groupId));
      await tx.insert(tenant.chatAssignCondition).values(
        group.conditions.map((c) => ({
          id: uuidv4(),
          groupId,
          field: c.field,
          operator: c.operator,
          value: c.value ? c.value.trim() : null,
          valueType: c.valueType,
        })),
      );
    }

    return groupId;
  }

  private async upsertConditionGroupTree(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    params: {
      group: CreateConditionGroupInput & { id?: string };
      filterId: string;
      parentId?: string;
      isRoot?: boolean;
    },
  ) {
    const { group, filterId, parentId, isRoot = false } = params;

    const groupId = await this.upsertConditionGroup(tx, tenant, group, filterId, isRoot);

    const parentAncestors =
      isRoot || !parentId
        ? []
        : await tx
            .select({
              ancestorGroupId: tenant.chatAssignConditionGroupClosure.ancestorGroupId,
              depth: tenant.chatAssignConditionGroupClosure.depth,
            })
            .from(tenant.chatAssignConditionGroupClosure)
            .where(
              and(
                eq(tenant.chatAssignConditionGroupClosure.filterId, filterId),
                eq(tenant.chatAssignConditionGroupClosure.descendantGroupId, parentId),
              ),
            );

    const closureRows = [
      { filterId, ancestorGroupId: groupId, descendantGroupId: groupId, depth: 0 },
      ...parentAncestors.map((a) => ({
        filterId,
        ancestorGroupId: a.ancestorGroupId,
        descendantGroupId: groupId,
        depth: a.depth + 1,
      })),
    ];

    await tx
      .insert(tenant.chatAssignConditionGroupClosure)
      .values(closureRows)
      .onConflictDoNothing();

    for (const subGroup of group.subGroups ?? []) {
      await this.upsertConditionGroupTree(tx, tenant, {
        group: subGroup,
        filterId,
        parentId: groupId,
      });
    }
  }

  private async replaceConditionGroupTree(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    filterId: string,
    newRootGroup: CreateConditionGroupInput,
  ) {
    const root = await this.getFilterRootConditionGroup(tenant, filterId, tx);

    await this.cleanupConditionGroupTree(tx, tenant, filterId, root.id);

    await this.upsertConditionGroupTree(tx, tenant, {
      group: { ...newRootGroup, id: root.id },
      filterId,
      isRoot: true,
    });
  }

  private async cleanupConditionGroupTree(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    filterId: string,
    rootId: string,
  ) {
    const subtreeIds = await tx
      .select({
        descendantGroupId: tenant.chatAssignConditionGroupClosure.descendantGroupId,
      })
      .from(tenant.chatAssignConditionGroupClosure)
      .where(
        and(
          eq(tenant.chatAssignConditionGroupClosure.filterId, filterId),
          eq(tenant.chatAssignConditionGroupClosure.ancestorGroupId, rootId),
        ),
      );

    const allIds = subtreeIds.map((s) => s.descendantGroupId);
    if (allIds.length) {
      await tx
        .delete(tenant.chatAssignCondition)
        .where(inArray(tenant.chatAssignCondition.groupId, allIds));
    }

    const descendantIds = allIds.filter((id) => id !== rootId);
    if (descendantIds.length) {
      await tx
        .delete(tenant.chatAssignConditionGroup)
        .where(inArray(tenant.chatAssignConditionGroup.id, descendantIds));
    }
  }

  private async aggregateConditions(
    conditions: DBChatAssignCondition[],
    tenant: TenantTables,
  ): Promise<ChatAssignCondition[]> {
    const allStoreIds: number[] = [];

    const conditionEntries = conditions.map((condition) => {
      const { field, value } = condition;

      if (field !== STORE_IDS_FIELD || !value) {
        return { condition, storeIds: null };
      }

      const storeIds = value
        .split(ARRAY_VALUE_SEPARATOR)
        .map((id) => Number(id))
        .filter((id) => !isNaN(id) && id > -1);

      if (storeIds.length === 0) {
        return { condition, storeIds: null };
      }

      allStoreIds.push(...storeIds);

      return { condition, storeIds };
    });

    if (allStoreIds.length === 0) return conditions;

    const stores = await this.db
      .select({
        name: tenant.store.name,
        liglaStoreId: tenant.store.liglaStoreId,
      })
      .from(tenant.store)
      .where(inArray(tenant.store.liglaStoreId, allStoreIds));

    const storeMap = new Map(
      stores.map(({ liglaStoreId, name }) => [liglaStoreId, { id: String(liglaStoreId), name }]),
    );

    return conditionEntries.map(({ condition, storeIds }) => {
      if (!storeIds) return condition;

      const mappedStores = storeIds
        .map((id) => storeMap.get(id) || { id: String(id), name: String(id) })
        .filter(Boolean);

      return {
        ...condition,
        valueObjects: mappedStores,
      };
    });
  }

  private async aggregateFilter(
    rawFilter: DBChatAssignFilter,
    tenant: TenantTables,
  ): Promise<ChatAssignFilter> {
    const { id: filterId, name, targetTable, note, isActive, createdAt, updatedAt } = rawFilter;

    const rootGroup = await this.getFilterRootConditionGroup(tenant, filterId);

    const allGroups = await this.db
      .select({
        id: tenant.chatAssignConditionGroup.id,
        logicalOperator: tenant.chatAssignConditionGroup.logicalOperator,
      })
      .from(tenant.chatAssignConditionGroup)
      .where(eq(tenant.chatAssignConditionGroup.filterId, filterId));

    const conditions = allGroups.length
      ? await this.db
          .select()
          .from(tenant.chatAssignCondition)
          .where(
            inArray(
              tenant.chatAssignCondition.groupId,
              allGroups.map((g) => g.id),
            ),
          )
      : [];

    const edges = await this.db
      .select({
        ancestorGroupId: tenant.chatAssignConditionGroupClosure.ancestorGroupId,
        descendantGroupId: tenant.chatAssignConditionGroupClosure.descendantGroupId,
      })
      .from(tenant.chatAssignConditionGroupClosure)
      .where(
        and(
          eq(tenant.chatAssignConditionGroupClosure.filterId, filterId),
          eq(tenant.chatAssignConditionGroupClosure.depth, 1),
        ),
      );

    const aggregatedConditions = await this.aggregateConditions(
      conditions as DBChatAssignCondition[],
      tenant,
    );

    const rootConditionGroup = this.buildConditionTree(
      allGroups,
      aggregatedConditions,
      edges,
      rootGroup.id,
    );

    return {
      id: filterId,
      name,
      isActive,
      rootConditionGroup,
      targetTable: targetTable as FilterTargetType,
      note,
      createdAt,
      updatedAt,
    };
  }

  private buildConditionTree(
    groups: { id: string; logicalOperator: string }[],
    conditions: any[],
    edges: { ancestorGroupId: string; descendantGroupId: string }[],
    rootId: string,
  ): ChatAssignConditionGroup {
    const groupById = new Map(groups.map((g) => [g.id, g]));
    const condByGroup = new Map<string, typeof conditions>();
    const childrenByAncestor = new Map<string, string[]>();

    for (const c of conditions) {
      (condByGroup.get(c.groupId) ?? condByGroup.set(c.groupId, []).get(c.groupId))!.push(c);
    }

    for (const e of edges) {
      (childrenByAncestor.get(e.ancestorGroupId) ??
        childrenByAncestor.set(e.ancestorGroupId, []).get(e.ancestorGroupId))!.push(
        e.descendantGroupId,
      );
    }

    const build = (groupId: string): ChatAssignConditionGroup => {
      const g = groupById.get(groupId)!;
      return {
        logicalOperator: g.logicalOperator as any,
        conditions: condByGroup.get(groupId) ?? [],
        subGroups: (childrenByAncestor.get(groupId) ?? []).map(build),
      };
    };

    return build(rootId);
  }

  private validateAndDetectCycles(
    group: CreateConditionGroupInput & { id?: string },
    visited = new Set<string>(),
    isRoot = true,
  ) {
    if (!group) {
      throw new BadRequestException(this.i18n.t('errors.chatAssignFilter.conditionGroupRequired'));
    }

    const { conditions = [], subGroups = [], logicalOperator } = group;

    if (!conditions.length && !subGroups.length) {
      throw new BadRequestException(this.i18n.t('errors.chatAssignFilter.conditionGroupEmpty'));
    }
    if (!logicalOperator) {
      throw new BadRequestException(this.i18n.t('errors.chatAssignFilter.logicalOperatorRequired'));
    }

    if (!isRoot && conditions.length + subGroups.length < MIN_STATEMENTS_IN_SUBGROUP) {
      throw new BadRequestException(
        this.i18n.t('errors.chatAssignFilter.innerGroupMinCriterias', {
          args: { minCriteria: MIN_STATEMENTS_IN_SUBGROUP },
        }),
      );
    }

    group.id ||= uuidv4();
    if (visited.has(group.id)) {
      throw new BadRequestException(this.i18n.t('errors.chatAssignFilter.groupCycleDetected'));
    }

    const nextVisited = new Set(visited).add(group.id);
    for (const sub of subGroups) {
      this.validateAndDetectCycles(sub, nextVisited, false);
    }
  }

  private async validateFilterExist(id: string, tenant: TenantTables) {
    const filter = await this.db
      .select()
      .from(tenant.chatAssignFilter)
      .where(eq(tenant.chatAssignFilter.id, id))
      .then((rows) => rows[0] || null);

    if (!filter) {
      throw new NotFoundException(
        this.i18n.t('errors.chatAssignFilter.filterNotFound', { args: { id } }),
      );
    }
    return filter;
  }

  private async validateRuleNameDuplicate(name: string | undefined, tenant: TenantTables) {
    if (!name) return;

    const filter = await this.db
      .select()
      .from(tenant.chatAssignFilter)
      .where(eq(tenant.chatAssignFilter.name, name))
      .then((rows) => rows[0] || null);

    if (filter) {
      throw new BadRequestException(
        this.i18n.t('errors.chatAssignFilter.duplicatedName', { args: { name } }),
      );
    }
  }

  private async getFilterRootConditionGroup(
    tenant: TenantTables,
    filterId: string,
    tx?: DrizzleDB | DrizzleTransaction,
  ) {
    const db = tx ?? this.db;

    const root = await db
      .select({ id: tenant.chatAssignConditionGroup.id })
      .from(tenant.chatAssignConditionGroup)
      .where(
        and(
          eq(tenant.chatAssignConditionGroup.filterId, filterId),
          eq(tenant.chatAssignConditionGroup.isRoot, true),
        ),
      )
      .then((rows) => rows[0] || null);

    if (!root) {
      throw new BadRequestException(this.i18n.t('errors.chatAssignFilter.rootGroupNotFound'));
    }

    return root;
  }

  private handleError(error: unknown, translationKey: string) {
    return error instanceof BadRequestException
      ? error
      : new BadRequestException(this.i18n.t(`errors.chatAssignFilter.${translationKey}`));
  }
}
