import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';

import { isArray } from 'class-validator';
import { eq, and, exists, count, desc, SQL, inArray, getTableColumns, sql, or } from 'drizzle-orm';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { v4 as uuidv4 } from 'uuid';

import { FilterInput } from '@/common/dto/filter.args';
import { PaginationArgs } from '@/common/dto/pagination.args';
import { buildWhereClause } from '@/common/utils/filter.drizzle';
import { buildJsonObject } from '@/common/utils/query';
import { DrizzleDB, InjectDrizzle, DrizzleTransaction, TenantSchemaService } from '@/drizzle';
import { User } from '@/modules/user/entities/user.entity';
import { UserRoleType, SystemUserType, UserStatusType } from '@/modules/user/enums';
import * as shared from '@@/drizzle/public/schema';
import { TenantTables } from '@@/drizzle/tenant/schema';

import { ChatStatus } from '../chat/entities/chat.entity';

import { DEFAULT_TEAM_NAME, DEFAULT_TEAM_NAME_JP } from './constants';
import { CreateTeamInput, TeamSettingInput } from './dto/create-team.input';
import { UpdateTeamInput } from './dto/update-team.input';
import { Team } from './entities/team.entity';

type DBTeamSetting = TenantTables['teamSetting']['$inferSelect'] & {
  teamChatSetting: Nullable<TenantTables['teamChatSetting']['$inferSelect']>;
};

type DBTeam = TenantTables['team']['$inferSelect'] & {
  userTeams: TenantTables['userTeam']['$inferSelect'][];
  storeTeams: {
    store: TenantTables['store']['$inferSelect'];
  }[];
  teamSetting: Nullable<DBTeamSetting>;
};

type TeamUser = TenantTables['user']['$inferSelect'] & {
  email: string;
  status: UserStatusType;
  organizationName: string | null;
};

type RawTeam = TenantTables['team']['$inferSelect'] & {
  userTeams: (TenantTables['userTeam']['$inferSelect'] & {
    user: TenantTables['user']['$inferSelect'];
  })[];
  storeTeams: TenantTables['storeTeam']['$inferSelect'][];
};

export const activeTeamsFilter = { isActive: true };

@Injectable()
export class TeamService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly i18n: I18nService,
    private readonly tenantSchema: TenantSchemaService,
  ) {}

  private readonly logger = new Logger(TeamService.name);

  async create(createTeamInput: CreateTeamInput, organizationId: string): Promise<Team> {
    const tenant = this.tenantSchema.getTables(organizationId);

    const team = await this.db.transaction(async (tx) => {
      const { name, managerIds, operatorIds, storeIds, teamSetting } = createTeamInput;

      // Check for duplicate team name
      const existingTeam = await tx
        .select()
        .from(tenant.team)
        .where(eq(tenant.team.name, name))
        .then((rows) => rows[0] || null);

      if (existingTeam) {
        throw new ConflictException(this.i18n.t('errors.team.duplicateName'));
      }

      await this.validateMembers(tx, tenant, managerIds || [], operatorIds || []);
      await this.validateStores(tx, tenant, storeIds || []);

      const [t] = await tx
        .insert(tenant.team)
        .values({
          id: uuidv4(),
          name,
          isDefault: false,
        })
        .returning();

      const managerMembers = (managerIds || []).map((id) => ({
        userId: id,
        teamId: t.id,
      }));

      const operatorMembers = (operatorIds || []).map((id) => ({
        userId: id,
        teamId: t.id,
      }));

      const allMembers = [...managerMembers, ...operatorMembers];
      if (allMembers.length > 0) {
        await tx.insert(tenant.userTeam).values(allMembers);
      }

      const storeAssignments = (storeIds || []).map((storeId) => ({
        id: uuidv4(),
        storeId,
        teamId: t.id,
      }));

      if (storeAssignments.length > 0) {
        await tx.insert(tenant.storeTeam).values(storeAssignments);
      }

      const [ts] = await tx
        .insert(tenant.teamSetting)
        .values({
          id: uuidv4(),
          teamId: t.id,
        })
        .returning();

      const teamChatSettingData = {
        id: uuidv4(),
        viewAllChatsEnabled: teamSetting?.teamChatSetting?.viewAllChatsEnabled ?? true,
        teamSettingId: ts.id,
      };

      await tx.insert(tenant.teamChatSetting).values(teamChatSettingData);

      const teamWithRelations = await this.queryTeamsWithRelations(tx, tenant)
        .where(eq(tenant.team.id, t.id))
        .then((rows) => rows[0] || null);

      if (!teamWithRelations) {
        throw new InternalServerErrorException('Failed to create team');
      }

      return teamWithRelations;
    });
    this.logger.log(`Team created successfully: ${team.id}`);
    return this.aggregateTeam(team, tenant);
  }

  async findByName(organizationId: string, name: string) {
    const tenant = this.tenantSchema.getTables(organizationId);

    return await this.db
      .select()
      .from(tenant.team)
      .where(eq(sql`lower(${tenant.team.name})`, name.toLowerCase()))
      .then((rows) => rows[0] || null);
  }

  async findDefaultTeam(tenant: TenantTables, db: DrizzleDB | DrizzleTransaction = this.db) {
    const team = await db
      .select()
      .from(tenant.team)
      .where(eq(tenant.team.isDefault, true))
      .then((rows) => rows[0] || null);

    return team;
  }

  async findDefaultTeamByOrganization(organizationId: string) {
    const tenant = this.tenantSchema.getTables(organizationId);
    return this.findDefaultTeam(tenant);
  }

  async createDefaultTeam(tenant: TenantTables, db: DrizzleDB | DrizzleTransaction = this.db) {
    const existingDefaultTeam = await this.findDefaultTeam(tenant, db);
    if (existingDefaultTeam) {
      throw new ConflictException(this.i18n.t('errors.team.defaultTeamAlreadyExists'));
    }

    const lang = I18nContext.current()?.lang || 'en';
    const defaultTeamName = lang === 'ja' ? DEFAULT_TEAM_NAME_JP : DEFAULT_TEAM_NAME;

    const [createdDefaultTeam] = await db
      .insert(tenant.team)
      .values({
        id: uuidv4(),
        name: defaultTeamName,
        isDefault: true,
      })
      .returning();

    return createdDefaultTeam.id;
  }

  async findAll(
    organizationId: string,
    paginationArgs?: PaginationArgs,
    userId?: string,
    userStatuses?: UserStatusType[],
    filter?: FilterInput,
  ) {
    const { skip, take } = paginationArgs || {};
    const tenant = this.tenantSchema.getTables(organizationId);

    const userCondition = this.getUserTeamCondition(tenant, userId);
    const filterConditions = buildWhereClause(
      {
        refineConditions: filter?.refineConditions,
        searchValue: filter?.searchValue,
        searchFields: ['name'],
      },
      tenant.team,
      this.i18n,
    );

    const where = and(userCondition, filterConditions);

    let query = this.queryTeamsWithRelations(this.db, tenant)
      .where(where)
      .orderBy(desc(tenant.team.createdAt), desc(tenant.team.id));

    if (skip) {
      query = query.offset(skip);
    }

    if (take) {
      query = query.limit(take);
    }

    const teams = await query;

    const aggregateTeams = [];
    for (const team of teams) {
      aggregateTeams.push(await this.aggregateTeam(team, tenant, userStatuses));
    }

    const { c } = await this.db
      .select({ c: count() })
      .from(tenant.team)
      .where(where)
      .then((rows) => rows[0]);

    return { items: aggregateTeams, count: c };
  }

  async findAllForSelect(organizationId: string, userId?: string) {
    const tenant = this.tenantSchema.getTables(organizationId);
    const userCondition = this.getUserTeamCondition(tenant, userId);

    const teams = await this.db
      .select({ id: tenant.team.id, name: tenant.team.name, isDefault: tenant.team.isDefault })
      .from(tenant.team)
      .where(and(userCondition, eq(tenant.team.isActive, true)));

    return teams;
  }

  async findAllByChatId(organizationId: string, userId: string, chatId?: string) {
    if (!chatId) {
      throw new NotFoundException('chatId not provided');
    }

    const tenant = this.tenantSchema.getTables(organizationId);

    const chat = await this.db
      .select()
      .from(tenant.chat)
      .where(eq(tenant.chat.id, chatId))
      .then((rows) => rows[0] || null);

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    const userCondition = this.getUserTeamCondition(tenant, userId);
    const chatTeamAssignmentCondition = this.getChatTeamAssignmentCondition(tenant, chatId);

    const teams = await this.queryTeamsWithRelations(this.db, tenant).where(
      or(chatTeamAssignmentCondition, userCondition),
    );

    const aggregateTeams = [];

    for (const team of teams) {
      aggregateTeams.push(
        await this.aggregateTeam(team, tenant, [UserStatusType.ACTIVE, UserStatusType.LOCKED]),
      );
    }

    return aggregateTeams;
  }

  async findAllByChatAssignmentByUserId(organizationId: string, userId: string) {
    const tenant = this.tenantSchema.getTables(organizationId);

    const { chatIds } = await this.getChatTeamAssignmentsByUserId(tenant, userId);

    const chatTeamAssignmentCondition = this.getChatTeamAssignmentCondition(tenant, chatIds);

    const teams = await this.queryTeamsWithRelations(this.db, tenant).where(
      and(eq(tenant.team.isActive, true), chatTeamAssignmentCondition),
    );

    const aggregateTeams = [];

    for (const team of teams) {
      aggregateTeams.push(await this.aggregateTeam(team, tenant));
    }

    return aggregateTeams;
  }

  private async getChatTeamAssignmentsByUserId(tenant: TenantTables, userId: string) {
    const chatAssignmentIds = await this.db
      .select({ chatId: tenant.chatTeamAssignment.chatId })
      .from(tenant.chatTeamAssignment)
      .where(
        and(
          exists(
            this.db
              .select()
              .from(tenant.userTeam)
              .where(
                and(
                  eq(tenant.userTeam.teamId, tenant.chatTeamAssignment.teamId),
                  eq(tenant.userTeam.userId, userId),
                ),
              ),
          ),
          exists(
            this.db
              .select()
              .from(tenant.chat)
              .where(eq(tenant.chat.id, tenant.chatTeamAssignment.chatId)),
          ),
        ),
      );

    const chatIds = chatAssignmentIds.map(({ chatId }) => chatId);

    const teams = await this.db
      .select({ id: tenant.team.id })
      .from(tenant.team)
      .where(this.getChatTeamAssignmentCondition(tenant, chatIds));

    const teamIds = teams.map(({ id }) => id);

    return { chatIds, teamIds };
  }

  private getUserTeamCondition(tenant: TenantTables, userId?: string) {
    if (!userId) return;

    return exists(
      this.db
        .select()
        .from(tenant.userTeam)
        .where(and(eq(tenant.userTeam.teamId, tenant.team.id), eq(tenant.userTeam.userId, userId))),
    );
  }

  private getChatTeamAssignmentCondition(tenant: TenantTables, chatIds?: string): SQL | undefined;
  private getChatTeamAssignmentCondition(tenant: TenantTables, chatIds?: string[]): SQL | undefined;
  private getChatTeamAssignmentCondition(
    tenant: TenantTables,
    chatIds?: string | string[],
  ): SQL | undefined {
    if (!chatIds) return;

    const conditions = [eq(tenant.chatTeamAssignment.teamId, tenant.team.id)];

    if (isArray(chatIds) && chatIds.length > 0) {
      conditions.push(inArray(tenant.chatTeamAssignment.chatId, chatIds));
    } else if (typeof chatIds === 'string') {
      conditions.push(eq(tenant.chatTeamAssignment.chatId, chatIds));
    } else return;

    return exists(
      this.db
        .select()
        .from(tenant.chatTeamAssignment)
        .where(and(...conditions)),
    );
  }

  async findOneById(organizationId: string, id: string) {
    const tenant = this.tenantSchema.getTables(organizationId);

    const team = await this.queryTeamsWithRelations(this.db, tenant)
      .where(eq(tenant.team.id, id))
      .then((rows) => rows[0] || null);

    return this.aggregateTeam(team, tenant);
  }

  async findRawTeamById(organizationId: string, id: string): Promise<RawTeam> {
    const tenant = this.tenantSchema.getTables(organizationId);

    const team = await this.db
      .select()
      .from(tenant.team)
      .where(eq(tenant.team.id, id))
      .then((rows) => rows[0] || null);

    if (!team) {
      throw new NotFoundException(this.i18n.t('errors.team.notFound'));
    }

    const userTeams = await this.db
      .select({
        ...getTableColumns(tenant.userTeam),
        user: getTableColumns(tenant.user),
      })
      .from(tenant.userTeam)
      .innerJoin(tenant.user, eq(tenant.user.id, tenant.userTeam.userId))
      .where(eq(tenant.userTeam.teamId, id));

    const storeTeams = await this.db
      .select()
      .from(tenant.storeTeam)
      .where(eq(tenant.storeTeam.teamId, id));

    return {
      ...team,
      userTeams,
      storeTeams,
    };
  }

  async update(updateTeamInput: UpdateTeamInput, organizationId: string) {
    const {
      id: teamId,
      name,
      managerIds = [],
      operatorIds = [],
      storeIds = [],
      isActive,
      teamSetting,
    } = updateTeamInput;

    const finalUserIds = Array.from(new Set([...managerIds, ...operatorIds]));

    this.logger.log({
      message: `Updating team ${teamId}`,
      userIds: finalUserIds.join(', '),
      storeIds: storeIds.join(', '),
      isActive,
      teamSetting,
      name,
    });

    const tenant = this.tenantSchema.getTables(organizationId);

    const team = await this.db.transaction(async (tx) => {
      await this.validateStores(tx, tenant, storeIds);
      await this.updateTeamStoreAssignments(tx, tenant, teamId, storeIds);

      return await this.updateTeamAndUserAssignments(tx, tenant, teamId, {
        name,
        isActive,
        userIds: finalUserIds,
        teamSetting,
      });
    });

    if (!team) {
      throw new NotFoundException(this.i18n.t('errors.team.notFound'));
    }

    this.logger.log(`Team updated successfully: ${team.id}`);

    return this.aggregateTeam(team, tenant);
  }

  async updateStatus(organizationId: string, id: string, newStatus: boolean) {
    this.logger.log({
      message: `Updating team status ${id}`,
      isActive: newStatus,
    });

    try {
      const tenant = this.tenantSchema.getTables(organizationId);

      const team = await this.db.transaction(async (tx) => {
        if (!newStatus) {
          await this.removeCompletedChatAssignmentsForTeam(tx, tenant, id);
        }

        const [t] = await tx
          .update(tenant.team)
          .set({ isActive: newStatus })
          .where(eq(tenant.team.id, id))
          .returning();

        if (!t) {
          throw new NotFoundException(this.i18n.t('errors.team.notFound'));
        }

        return this.queryTeamsWithRelations(tx, tenant)
          .where(eq(tenant.team.id, t.id))
          .then((rows) => rows[0] || null);
      });

      if (!team) {
        throw new NotFoundException(this.i18n.t('errors.team.notFound'));
      }

      this.logger.log(`Team status updated successfully: ${team.id}`);

      return this.aggregateTeam(team, tenant);
    } catch (error) {
      this.logger.error(`Failed to update team: ${id}`, error);
      throw new InternalServerErrorException(this.i18n.t('errors.team.failedToUpdateTeam'));
    }
  }

  private async updateTeamStoreAssignments(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    teamId: string,
    newStoreIds: string[],
  ): Promise<void> {
    const currentStoreTeam = await tx
      .select({ storeId: tenant.storeTeam.storeId })
      .from(tenant.storeTeam)
      .where(eq(tenant.storeTeam.teamId, teamId));
    const currentStoreIds = currentStoreTeam.map(({ storeId }) => storeId);

    const { storesToAdd, storesToRemove } = this.calculateStoreChanges(
      currentStoreIds,
      newStoreIds,
    );

    await this.addStoreAssignments(tx, tenant, teamId, storesToAdd);
    await this.removeStoreAssignments(tx, tenant, teamId, storesToRemove);
  }

  private calculateStoreChanges(currentStoreIds: string[], newStoreIds: string[]) {
    return {
      storesToAdd: newStoreIds.filter((storeId) => !currentStoreIds.includes(storeId)),
      storesToRemove: currentStoreIds.filter((storeId) => !newStoreIds.includes(storeId)),
    };
  }

  private async addStoreAssignments(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    teamId: string,
    storeIds: string[],
  ) {
    if (storeIds.length === 0) return;

    const storeTeamData = storeIds.map((storeId) => ({
      id: uuidv4(),
      storeId,
      teamId,
    }));

    await tx.insert(tenant.storeTeam).values(storeTeamData);

    this.logger.log(`Store assignments added to team ${teamId}: ${storeIds.join(', ')}`);
  }

  private async removeStoreAssignments(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    teamId: string,
    storeIds: string[],
  ) {
    if (storeIds.length === 0) return;

    await tx
      .delete(tenant.storeTeam)
      .where(and(inArray(tenant.storeTeam.storeId, storeIds), eq(tenant.storeTeam.teamId, teamId)));

    this.logger.log(`Store assignments removed from team ${teamId}: ${storeIds.join(', ')}`);
  }

  private async updateTeamAndUserAssignments(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    teamId: string,
    updates: {
      name?: string;
      isActive?: boolean;
      userIds: string[];
      teamSetting?: TeamSettingInput;
    },
  ): Promise<DBTeam | undefined> {
    if (!teamId) {
      throw new BadRequestException(this.i18n.t('errors.team.requiredId'));
    }

    const teamData: Partial<TenantTables['team']['$inferInsert']> = {
      name: updates.name,
      isActive: updates.isActive,
    };

    const [team] = await tx
      .update(tenant.team)
      .set(teamData)
      .where(eq(tenant.team.id, teamId))
      .returning();

    if (!team) {
      return undefined;
    }

    if (updates.isActive === false) {
      await this.removeCompletedChatAssignmentsForTeam(tx, tenant, teamId);
    }

    const viewAllChatsEnabled = !!updates.teamSetting?.teamChatSetting?.viewAllChatsEnabled;

    const existingTeamSetting = await tx
      .select()
      .from(tenant.teamSetting)
      .where(eq(tenant.teamSetting.teamId, team.id))
      .then((rows) => rows[0] || null);

    if (updates.teamSetting) {
      if (existingTeamSetting) {
        await tx
          .insert(tenant.teamChatSetting)
          .values({
            id: uuidv4(),
            viewAllChatsEnabled,
            teamSettingId: existingTeamSetting.id,
          })
          .onConflictDoUpdate({
            target: [tenant.teamChatSetting.teamSettingId],
            set: { viewAllChatsEnabled, updatedAt: new Date() },
          });
      } else {
        const [newTeamSetting] = await tx
          .insert(tenant.teamSetting)
          .values({ id: uuidv4(), teamId: team.id })
          .returning();

        await tx.insert(tenant.teamChatSetting).values({
          id: uuidv4(),
          viewAllChatsEnabled,
          teamSettingId: newTeamSetting.id,
        });
      }
    }

    // team members
    if (Array.isArray(updates.userIds)) {
      await this.updateTeamMembers(tx, tenant, teamId, updates.userIds);
    }

    return this.queryTeamsWithRelations(tx, tenant)
      .where(eq(tenant.team.id, teamId))
      .then((rows) => rows[0] || null);
  }

  private async updateTeamMembers(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    teamId: string,
    newUserIds: string[],
  ): Promise<void> {
    const currentMembers = await tx
      .select({ userId: tenant.userTeam.userId })
      .from(tenant.userTeam)
      .where(eq(tenant.userTeam.teamId, teamId));

    const memberDiff = this.calculateMemberDiff(
      currentMembers.map((member) => member.userId),
      newUserIds,
    );

    await Promise.all([
      this.removeTeamMembers(tx, tenant, teamId, memberDiff.toRemove),
      this.addTeamMembers(tx, tenant, teamId, memberDiff.toAdd),
    ]);
  }

  private calculateMemberDiff(
    currentIds: string[],
    newIds: string[],
  ): {
    toAdd: string[];
    toRemove: string[];
  } {
    const currentSet = new Set(currentIds);
    const newSet = new Set(newIds);

    return {
      toAdd: newIds.filter((id) => !currentSet.has(id)),
      toRemove: currentIds.filter((id) => !newSet.has(id)),
    };
  }

  private async removeTeamMembers(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    teamId: string,
    userIds: string[],
  ): Promise<void> {
    if (userIds.length === 0) return;

    await tx
      .delete(tenant.userTeam)
      .where(and(eq(tenant.userTeam.teamId, teamId), inArray(tenant.userTeam.userId, userIds)));

    this.logger.log(`Team members removed from team ${teamId}: ${userIds.join(', ')}`);
  }

  private async addTeamMembers(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    teamId: string,
    userIds: string[],
  ): Promise<void> {
    if (userIds.length === 0) return;

    await tx.insert(tenant.userTeam).values(userIds.map((userId) => ({ teamId, userId })));

    this.logger.log(`Team members added to team ${teamId}: ${userIds.join(', ')}`);
  }

  async disable(organizationId: string, id: string) {
    const targetTeam = await this.findRawTeamById(organizationId, id);
    if (targetTeam.isDefault) {
      throw new ForbiddenException(this.i18n.t('errors.team.defaultTeamCannotBeDisabled'));
    }

    return this.updateStatus(organizationId, id, false);
  }

  private async removeCompletedChatAssignmentsForTeam(
    db: DrizzleDB | DrizzleTransaction,
    tenant: TenantTables,
    teamId: string,
  ): Promise<void> {
    await db.delete(tenant.chatTeamAssignment).where(
      and(
        eq(tenant.chatTeamAssignment.teamId, teamId),
        exists(
          db
            .select()
            .from(tenant.chat)
            .where(
              and(
                eq(tenant.chat.id, tenant.chatTeamAssignment.chatId),
                eq(tenant.chat.chatStatus, ChatStatus.DONE),
              ),
            ),
        ),
      ),
    );
  }

  private async aggregateTeam(
    team: DBTeam | undefined,
    tenant: TenantTables,
    userStatuses?: UserStatusType[],
  ): Promise<Team> {
    if (!team) {
      throw new NotFoundException(this.i18n.t('errors.team.notFound'));
    }

    try {
      const { id, name, userTeams, createdAt, storeTeams, isActive, isDefault, teamSetting } = team;

      const users = await this.getTeamUsers(tenant, userTeams, userStatuses);
      const { managers, operators } = this.segregateUsersByRole(users);

      const stores = storeTeams?.length
        ? this.extractStores(storeTeams)
        : await this.getTeamStores(tenant, id);

      const resolvedTeamSetting = teamSetting ?? (await this.getTeamSetting(tenant, id));

      return {
        id,
        name,
        managers,
        operators,
        stores,
        isActive,
        createdAt,
        isDefault,
        teamSetting: resolvedTeamSetting,
      };
    } catch (error) {
      this.logger.error(`Error in aggregateTeam: ${team.id}`, error);
      throw new InternalServerErrorException(this.i18n.t('errors.team.aggregateError'));
    }
  }

  private async getTeamStores(tenant: TenantTables, teamId: string) {
    const storeTeams = await this.db
      .select({
        store: getTableColumns(tenant.store),
      })
      .from(tenant.storeTeam)
      .innerJoin(tenant.store, eq(tenant.store.id, tenant.storeTeam.storeId))
      .where(eq(tenant.storeTeam.teamId, teamId));

    return storeTeams.map(({ store }) => store);
  }

  private async getTeamSetting(tenant: TenantTables, teamId: string) {
    const setting = await this.db
      .select()
      .from(tenant.teamSetting)
      .where(eq(tenant.teamSetting.teamId, teamId))
      .then((rows) => rows[0] || null);

    if (!setting) {
      return null;
    }

    const chatSetting = await this.db
      .select()
      .from(tenant.teamChatSetting)
      .where(eq(tenant.teamChatSetting.teamSettingId, setting.id))
      .then((rows) => rows[0] || null);

    return {
      ...setting,
      teamChatSetting: chatSetting,
    };
  }

  private async getTeamUsers(
    tenant: TenantTables,
    userTeam: TenantTables['userTeam']['$inferSelect'][],
    userStatuses?: UserStatusType[],
  ): Promise<TeamUser[]> {
    if (!userTeam?.length) {
      return [];
    }

    const userIds = userTeam.map(({ userId }) => userId);

    const where: SQL[] = [inArray(shared.auth.id, userIds)];

    if (userStatuses && userStatuses.length > 0) {
      where.push(inArray(shared.auth.status, userStatuses));
    }

    return await this.db
      .select({
        ...getTableColumns(tenant.user),
        email: shared.auth.email,
        status: shared.auth.status,
        organizationName: shared.auth.organizationName,
      })
      .from(shared.auth)
      .innerJoin(tenant.user, eq(tenant.user.id, shared.auth.id))
      .where(and(...where));
  }

  private segregateUsersByRole(users: TeamUser[]): {
    managers: User[];
    operators: User[];
  } {
    if (!users || !Array.isArray(users) || users.length === 0) {
      return { managers: [], operators: [] };
    }

    const managers = users
      .filter((user) => this.isManagerRole(user.roleType))
      .map((user) => this.aggregateTeamUser(user));

    const operators = users
      .filter((user) => this.isOperatorRole(user.roleType, managers))
      .map((user) => this.aggregateTeamUser(user));

    return { managers, operators };
  }

  private isManagerRole(roleType: string): boolean {
    return [UserRoleType.MANAGER, UserRoleType.MANAGER_OPERATOR].includes(
      roleType as Exclude<UserRoleType, 'ADMIN' | 'ADMIN_OPERATOR' | 'OPERATOR'>,
    );
  }

  private isOperatorRole(roleType: string, managers: User[]): boolean {
    const isOperator = roleType === UserRoleType.OPERATOR;
    const isManagerOperatorInManagers =
      roleType === UserRoleType.MANAGER_OPERATOR &&
      managers.some((manager) => manager.roleType === UserRoleType.MANAGER_OPERATOR);

    return isOperator || isManagerOperatorInManagers;
  }

  private extractStores(storeTeam: DBTeam['storeTeams']): TenantTables['store']['$inferSelect'][] {
    if (!storeTeam?.length) {
      return [];
    }

    return storeTeam.map(({ store }) => store);
  }

  private queryTeamsWithRelations(db: DrizzleDB | DrizzleTransaction, tenant: TenantTables) {
    const storeTeamWithStore = {
      ...getTableColumns(tenant.storeTeam),
      store: sql`(
        SELECT ${buildJsonObject(getTableColumns(tenant.store))}
        FROM ${tenant.store}
        WHERE ${tenant.store.id} = ${tenant.storeTeam.storeId}
      )`,
    };

    const teamSettingWithChatSetting = {
      ...getTableColumns(tenant.teamSetting),
      teamChatSetting: sql`(
        SELECT ${buildJsonObject(getTableColumns(tenant.teamChatSetting))}
        FROM ${tenant.teamChatSetting}
        WHERE ${tenant.teamChatSetting.teamSettingId} = ${tenant.teamSetting.id}
      )`,
    };

    return db
      .select({
        ...getTableColumns(tenant.team),
        userTeams: sql<DBTeam['userTeams']>`(
          SELECT COALESCE(
            json_agg(${buildJsonObject(getTableColumns(tenant.userTeam))}), '[]'::json
          )
          FROM ${tenant.userTeam}
          WHERE ${tenant.userTeam.teamId} = ${tenant.team.id}
        )`,
        storeTeams: sql<DBTeam['storeTeams']>`(
          SELECT COALESCE(
            json_agg(${buildJsonObject(storeTeamWithStore)}), '[]'::json
          )
          FROM ${tenant.storeTeam}
          WHERE ${tenant.storeTeam.teamId} = ${tenant.team.id}
        )`,
        teamSetting: sql<DBTeam['teamSetting']>`(
          SELECT ${buildJsonObject(teamSettingWithChatSetting)}
          FROM ${tenant.teamSetting}
          WHERE ${tenant.teamSetting.teamId} = ${tenant.team.id}
        )`,
      })
      .from(tenant.team)
      .$dynamic();
  }

  private aggregateTeamUser(user: TeamUser): User {
    if (!user) {
      throw new BadRequestException(this.i18n.t('errors.user.notFound'));
    }

    const { id, displayName, status, email, pictureUrl, roleType, createdAt } = user;

    return {
      id,
      displayName,
      email,
      pictureUrl,
      roleType,
      status,
      createdAt,
      systemUserType: SystemUserType.USER,
    };
  }

  private async validateMembers(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    managerIds: string[],
    operatorIds: string[],
  ) {
    const allUserIds = [...managerIds, ...operatorIds];
    if (allUserIds.length === 0) return;

    const users = await tx
      .select({ id: tenant.user.id })
      .from(tenant.user)
      .where(inArray(tenant.user.id, allUserIds));

    if (users.length !== allUserIds.length) {
      throw new BadRequestException('Some users do not exist or are not in the same organization');
    }
  }

  private async validateStores(
    db: DrizzleDB | DrizzleTransaction,
    tenant: TenantTables,
    storeIds: string[],
  ) {
    if (storeIds.length === 0) return;

    const stores = await db
      .select({ id: tenant.store.id })
      .from(tenant.store)
      .where(inArray(tenant.store.id, storeIds));

    if (stores.length !== storeIds.length) {
      throw new BadRequestException('Some stores do not exist or are not in the same organization');
    }
  }

  async isUserInTeam(organizationId: string, teamId: string, userId: string): Promise<boolean> {
    const tenant = this.tenantSchema.getTables(organizationId);

    const team = await this.db
      .select({ id: tenant.team.id })
      .from(tenant.team)
      .where(
        and(
          eq(tenant.team.id, teamId),
          exists(
            this.db
              .select()
              .from(tenant.userTeam)
              .where(
                and(eq(tenant.userTeam.teamId, tenant.team.id), eq(tenant.userTeam.userId, userId)),
              ),
          ),
        ),
      )
      .then((rows) => rows[0] || null);
    return !!team;
  }

  async hasRuleForTargetTeam(organizationId: string, teamId: string): Promise<boolean> {
    const tenant = this.tenantSchema.getTables(organizationId);

    const { c } = await this.db
      .select({ c: count() })
      .from(tenant.chatAssignRuleTargetTeam)
      .where(eq(tenant.chatAssignRuleTargetTeam.teamId, teamId))
      .then((rows) => rows[0] || { c: 0 });

    return c > 0;
  }
}
