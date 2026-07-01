import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { and, desc, eq, getTableColumns, inArray, sql } from 'drizzle-orm';
import { I18nService } from 'nestjs-i18n';
import { v4 as uuidv4 } from 'uuid';

import { convertArrayToString } from '@/common/utils/string';
import { DrizzleDB, DrizzleTransaction, InjectDrizzle, TenantSchemaService } from '@/drizzle';
import { adminRoles } from '@/modules/auth/constants';
import { ChatService } from '@/modules/chat/chat.service';
import { DEFAULT_TEAM_NAME } from '@/modules/team/constants';
import { Team } from '@/modules/team/entities/team.entity';
import { TeamService } from '@/modules/team/team.service';
import { User } from '@/modules/user/entities/user.entity';
import { UserRoleType, UserStatusType } from '@/modules/user/enums';
import { UserService } from '@/modules/user/user.service';
import * as shared from '@@/drizzle/public/schema';
import { TenantTables } from '@@/drizzle/tenant/schema';

import { ActivityType } from '../chat/entities/chat-activity.entity';
import { SenderType } from '../chat/entities/chat-message.entity';
import { ChatStatus } from '../chat/entities/chat.entity';

import { ChatTeamAssignInput } from './dto/chat-team-assign.input';
import { ChatTeamAssignActionsType } from './enums';

type ChatTeamAssignmentsWithUserId = {
  team: {
    userTeams: { userId: string }[];
  };
};

type ChatTeamAssignmentType = {
  team: {
    name: string;
    isDefault: boolean;
  };
};

type UserId = User['id'];

type ChangeAssigneeType = Pick<ChatTeamAssignInput, 'chatId'> & {
  userId: UserId;
  oldAssigneeId?: Nullable<UserId>;
  newAssigneeId: UserId;
  organizationId: string;
};

type ChangeTeamAssignType = ChatTeamAssignInput & {
  userId?: UserId;
  oldTeamIds?: Team['id'][];
  action?: ChatTeamAssignActionsType;
  organizationId: string;
};

@Injectable()
export class ChatAssignmentService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly chatService: ChatService,
    private readonly teamService: TeamService,
    private readonly userService: UserService,
    private readonly i18n: I18nService,
    private readonly tenantSchema: TenantSchemaService,
  ) {}

  private readonly logger = new Logger(ChatAssignmentService.name);

  async assignTeamToChat(data: ChangeTeamAssignType, organizationId: string) {
    const { chatId, teamId } = data;
    const tenant = this.tenantSchema.getTables(organizationId);

    await this.validateTeamExists(teamId, tenant);
    await this.ensureTeamIsNotAssigned(chatId, teamId, tenant);
    const chatTeamAssignments = await this.getChatTeamAssignments(chatId, tenant);
    const oldTeamIds = chatTeamAssignments.map((chatTeam) => chatTeam.teamId);

    const activity = await this.db.transaction(async (tx) => {
      await this.createChatTeamWithTx(tx, { chatId, teamId }, tenant);
      return await this.createTeamAssignChangeActivity(
        tx,
        { ...data, oldTeamIds, organizationId },
        tenant,
      );
    });

    this.chatService.broadcastChatEvent(chatId, organizationId);

    return activity;
  }

  async assignOperatorToChat(data: ChangeAssigneeType, organizationId: string) {
    const { chatId, newAssigneeId } = data;
    const tenant = this.tenantSchema.getTables(organizationId);

    await this.validateOperatorAssignment(chatId, newAssigneeId, organizationId, tenant);

    const chatSnapshot = await this.db
      .select({
        latestReadTimestamp: tenant.chat.latestReadTimestamp,
        latestMessageTimestamp: tenant.chat.latestMessageTimestamp,
        chatStatus: tenant.chat.chatStatus,
      })
      .from(tenant.chat)
      .where(eq(tenant.chat.id, chatId))
      .then((rows) => rows[0] || null);
    const activity = await this.db.transaction(async (tx) => {
      await this.chatService.updateChatWithTx(tx, tenant, chatId, {
        assignedUserId: newAssigneeId,
      });

      const latestEndUserMessage = await tx
        .select({ createdAt: tenant.chatMessage.createdAt })
        .from(tenant.chatMessage)
        .where(
          and(
            eq(tenant.chatMessage.chatId, chatId),
            eq(tenant.chatMessage.isDelivered, true),
            eq(tenant.chatMessage.senderType, SenderType.END_USER),
          ),
        )
        .orderBy(desc(tenant.chatMessage.createdAt), desc(tenant.chatMessage.id))
        .limit(1)
        .then((rows) => rows[0] || null);

      const pinnedFromSnapshot =
        (chatSnapshot?.latestReadTimestamp && new Date(chatSnapshot.latestReadTimestamp)) ||
        new Date(0);

      let readTimestamp = pinnedFromSnapshot;
      if (chatSnapshot?.chatStatus !== ChatStatus.DONE && latestEndUserMessage) {
        const latestMsgTs =
          chatSnapshot?.latestMessageTimestamp && new Date(chatSnapshot.latestMessageTimestamp);
        const pinnedAfterLatestMessage =
          latestMsgTs && pinnedFromSnapshot.getTime() > latestMsgTs.getTime();

        if (!pinnedAfterLatestMessage && pinnedFromSnapshot > latestEndUserMessage.createdAt) {
          readTimestamp = new Date(new Date(latestEndUserMessage.createdAt).getTime() - 1);
        }
      }
      await this.chatService.upsertChatUserRead(tx, tenant, {
        chatId,
        userId: newAssigneeId,
        readTimestamp,
      });

      return this.createAssigneeChangeActivity(tx, { ...data, organizationId }, tenant);
    });

    this.chatService.broadcastChatEvent(chatId, organizationId);

    return activity;
  }

  async removeTeamFromChat(data: ChangeTeamAssignType, organizationId: string) {
    const { chatId, teamId } = data;
    const tenant = this.tenantSchema.getTables(organizationId);

    const chatTeamAssignment = await this.ensureTeamIsAssigned(chatId, teamId, tenant);

    await this.validateTeamRemovalForAssignedOperator(chatId, teamId, tenant);
    const chatTeamAssignments = await this.getChatTeamAssignments(chatId, tenant);
    const oldTeamIds = chatTeamAssignments.map((chatTeam) => chatTeam.teamId);

    const activity = await this.db.transaction(async (tx) => {
      await this.removeChatTeamWithTx(tx, chatTeamAssignment.id, tenant);
      return await this.createTeamAssignChangeActivity(
        tx,
        { ...data, oldTeamIds, organizationId },
        tenant,
      );
    });

    this.chatService.broadcastChatEvent(chatId, organizationId);

    return activity;
  }

  async assignDefaultTeamToChat(
    chatTeamAssignments: ChatTeamAssignmentType[],
    chatId: string,
    organizationId: string,
  ) {
    const isDefaultTeamAssigned = chatTeamAssignments.some(({ team }) => team.isDefault);

    if (!isDefaultTeamAssigned) {
      const tenant = this.tenantSchema.getTables(organizationId);
      const defaultTeam = await this.teamService.findDefaultTeam(tenant);
      if (defaultTeam?.id) {
        await this.assignTeamToChat(
          {
            chatId,
            teamId: defaultTeam.id,
            action: ChatTeamAssignActionsType.ADDED,
            organizationId,
          },
          organizationId,
        );
        this.logger.log(`Default team ${defaultTeam.id} assigned to chat ${chatId}`);
      }
    }
  }

  private async createChatTeamWithTx(
    tx: DrizzleTransaction,
    data: Omit<TenantTables['chatTeamAssignment']['$inferInsert'], 'id'>,
    tenant: TenantTables,
  ) {
    await tx.insert(tenant.chatTeamAssignment).values({
      ...data,
      id: uuidv4(),
    });
  }

  private async removeChatTeamWithTx(tx: DrizzleTransaction, id: string, tenant: TenantTables) {
    await tx.delete(tenant.chatTeamAssignment).where(eq(tenant.chatTeamAssignment.id, id));
  }

  private async createAssigneeChangeActivity(
    tx: DrizzleTransaction,
    data: ChangeAssigneeType,
    tenant: TenantTables,
  ) {
    const { chatId, userId, oldAssigneeId = '', newAssigneeId, organizationId } = data;

    const actorUserName = await this.userService.findUserDisplayName(organizationId, userId);
    const oldUserName = await this.userService.findUserDisplayName(organizationId, oldAssigneeId);
    const newUserName = await this.userService.findUserDisplayName(organizationId, newAssigneeId);

    return await this.chatService.createChatActivity(tx, tenant, {
      chatId,
      activityType: ActivityType.USER_CHANGE,
      actorId: userId,
      actorUserName,
      oldValues: {
        oldUserId: oldAssigneeId,
        oldUserName,
      },
      newValues: {
        newUserId: newAssigneeId,
        newUserName,
      },
    });
  }

  private async createTeamAssignChangeActivity(
    tx: DrizzleTransaction,
    data: ChangeTeamAssignType,
    tenant: TenantTables,
  ) {
    const { chatId, userId, oldTeamIds = [], teamId, action, organizationId } = data;

    const actorUserName = await this.userService.findUserDisplayName(organizationId, userId);

    const oldTeamNames = await Promise.all(
      oldTeamIds.map(
        async (id) => (await this.teamService.findRawTeamById(organizationId, id)).name,
      ),
    );

    const teamName = (await this.teamService.findRawTeamById(organizationId, teamId)).name;
    const newTeamIds = this.updateArrayByAction(oldTeamIds, teamId, action);
    const newTeamNames = this.updateArrayByAction(oldTeamNames, teamName, action);

    if (oldTeamIds.length !== oldTeamNames.length || newTeamIds.length !== newTeamNames.length) {
      throw new ForbiddenException(this.i18n.t('errors.activity.teamMismatch'));
    }

    return await this.chatService.createChatActivity(tx, tenant, {
      chatId,
      activityType: ActivityType.TEAMS_CHANGE,
      actorId: userId,
      actorUserName,
      oldValues: {
        oldTeamIds: convertArrayToString(oldTeamIds),
        oldTeamNames: convertArrayToString(oldTeamNames),
      },
      newValues: {
        newTeamIds: convertArrayToString(newTeamIds),
        newTeamNames: convertArrayToString(newTeamNames),
      },
    });
  }

  private updateArrayByAction<T>(
    array: T[] = [],
    item: T,
    action?: ChatTeamAssignActionsType,
  ): T[] {
    if (!action) return array;

    return action === ChatTeamAssignActionsType.ADDED
      ? [...array, item]
      : array.filter((arrayItem) => arrayItem !== item);
  }

  private async validateOperatorAssignment(
    chatId: string,
    assignedUserId: string,
    organizationId: string,
    tenant: TenantTables,
  ) {
    // Check if assigned operator exists.
    const assignedOperator = await this.validateAssigneeExists(assignedUserId, tenant);

    // Check if target chat exists and get chat team assignments.
    const chat = await this.ensureChatAndGetChatWithTeamAssignments(chatId, tenant);

    // Verify that the assigned operator does not belong to the selected teams.
    // Use assignee's role, not current user's role
    this.ensureAssigneeIsNotOutsider(
      chat.chatTeamAssignments,
      assignedUserId,
      assignedOperator.roleType,
    );

    const chatTeamAssignments = await this.getChatTeamAssignments(chatId, tenant);
    const assignedOperatorTeamCount = this.countAssignedOperators(
      chatTeamAssignments,
      assignedUserId,
    );

    // Check if the assigned operator is an admin operator.
    const isAttemptingToAssignAdmin = adminRoles.includes(assignedOperator.roleType);

    // If assignee is not an admin operator and is not part of the chat team
    if (!isAttemptingToAssignAdmin && assignedOperatorTeamCount === 0) {
      throw new BadRequestException(this.i18n.t('errors.chat.operatorNotInChatTeam'));
    }

    if (isAttemptingToAssignAdmin && assignedOperatorTeamCount === 0) {
      await this.assignDefaultTeamToChat(chatTeamAssignments, chatId, organizationId);
    }
  }

  private async validateAssigneeExists(assignedUserId: string, tenant: TenantTables) {
    const assignedOperator = await this.db
      .select(getTableColumns(tenant.user))
      .from(tenant.user)
      .innerJoin(shared.auth, eq(shared.auth.id, tenant.user.id))
      .where(
        and(
          eq(shared.auth.id, assignedUserId),
          inArray(shared.auth.status, [UserStatusType.ACTIVE, UserStatusType.LOCKED]),
        ),
      )
      .then((rows) => rows[0] || null);

    if (!assignedOperator) {
      throw new NotFoundException(this.i18n.t('errors.chat.assignedOperatorNotFound'));
    }

    return assignedOperator;
  }

  private async validateTeamRemovalForAssignedOperator(
    chatId: string,
    teamId: string,
    tenant: TenantTables,
  ) {
    const team = await this.validateTeamExists(teamId, tenant);
    const chat = await this.ensureChatAndGetChatWithTeamAssignments(chatId, tenant);

    // If chat is not assigned to any operator, no need to validate below conditions.
    if (!chat.assignedUserId) return;

    const chatTeamAssignments = await this.getChatTeamAssignments(chatId, tenant);
    const assignedOperatorTeamCount = this.countAssignedOperators(
      chatTeamAssignments,
      chat.assignedUserId,
    );

    if (assignedOperatorTeamCount === 1) {
      const isAttemptingToRemoveAssignedOperatorTeam = team.userTeams.some(
        (userTeam) => userTeam.userId === chat.assignedUserId,
      );

      if (isAttemptingToRemoveAssignedOperatorTeam) {
        throw new BadRequestException(this.i18n.t('errors.chat.cannotRemoveAssignedOperatorTeam'));
      }
    }

    const isAttemptingToRemoveDefaultTeam = team.name === DEFAULT_TEAM_NAME;
    if (isAttemptingToRemoveDefaultTeam && chat.user) {
      const isAdminOperatorAssigned = chat.user.roleType === UserRoleType.ADMIN_OPERATOR;
      if (isAdminOperatorAssigned) {
        throw new BadRequestException(
          this.i18n.t('errors.chat.cannotRemoveDefaultTeamAssignedWithAdmin'),
        );
      }
    }
  }

  private async validateTeamExists(teamId: string, tenant: TenantTables) {
    const team = await this.db
      .select({
        id: tenant.team.id,
        name: tenant.team.name,
        isDefault: tenant.team.isDefault,
        userTeams: sql<{ userId: string }[]>`(
          SELECT COALESCE(
            json_agg(json_build_object('userId', ${tenant.userTeam.userId})),
            '[]'::json
          )
          FROM ${tenant.userTeam}
          WHERE ${tenant.userTeam.teamId} = ${tenant.team.id}
        )`,
      })
      .from(tenant.team)
      .where(and(eq(tenant.team.id, teamId), eq(tenant.team.isActive, true)))
      .then((rows) => rows[0] || null);

    if (!team) {
      throw new NotFoundException(this.i18n.t('errors.team.notFound'));
    }

    return team;
  }

  private getChatTeamAssignments(chatId: string, tenant: TenantTables) {
    return this.db
      .select({
        id: tenant.chatTeamAssignment.id,
        chatId: tenant.chatTeamAssignment.chatId,
        teamId: tenant.chatTeamAssignment.teamId,
        team: sql<{
          name: string;
          isDefault: boolean;
          userTeams: { userId: string }[];
        }>`(
          SELECT json_build_object(
            'name', ${tenant.team.name},
            'isDefault', ${tenant.team.isDefault},
            'userTeams', COALESCE(
              (SELECT json_agg(json_build_object('userId', ${tenant.userTeam.userId}))
               FROM ${tenant.userTeam}
               WHERE ${tenant.userTeam.teamId} = ${tenant.team.id}),
              '[]'::json
            )
          )
          FROM ${tenant.team}
          WHERE ${tenant.team.id} = ${tenant.chatTeamAssignment.teamId}
        )`,
      })
      .from(tenant.chatTeamAssignment)
      .where(eq(tenant.chatTeamAssignment.chatId, chatId));
  }

  private async getChatTeamAssignment(chatId: string, teamId: string, tenant: TenantTables) {
    const chatTeamAssignment = await this.db
      .select()
      .from(tenant.chatTeamAssignment)
      .where(
        and(
          eq(tenant.chatTeamAssignment.chatId, chatId),
          eq(tenant.chatTeamAssignment.teamId, teamId),
        ),
      )
      .then((rows) => rows[0] || null);

    return chatTeamAssignment;
  }

  private ensureAssigneeIsNotOutsider(
    chatTeamAssignment: ChatTeamAssignmentsWithUserId[],
    assignedUserId: string,
    role: string,
  ) {
    const userIds = chatTeamAssignment.flatMap((cta) => cta.team.userTeams.map((ut) => ut.userId));

    const isInOtherTeam = !userIds.includes(assignedUserId);
    const isAdminOperator = role === UserRoleType.ADMIN_OPERATOR;

    if (isInOtherTeam && !isAdminOperator) {
      throw new ForbiddenException(this.i18n.t('errors.chat.cannotAssignOperatorFromAnotherTeam'));
    }
  }

  private async ensureTeamIsNotAssigned(chatId: string, teamId: string, tenant: TenantTables) {
    const chatTeamAssignment = await this.getChatTeamAssignment(chatId, teamId, tenant);

    if (chatTeamAssignment)
      throw new ConflictException(this.i18n.t('errors.chat.alreadyTeamAssigned'));
  }

  private async ensureTeamIsAssigned(chatId: string, teamId: string, tenant: TenantTables) {
    const chatTeamAssignment = await this.getChatTeamAssignment(chatId, teamId, tenant);

    if (!chatTeamAssignment)
      throw new ForbiddenException(this.i18n.t('errors.chat.teamNotAssigned'));

    return chatTeamAssignment;
  }

  private async ensureChatAndGetChatWithTeamAssignments(chatId: string, tenant: TenantTables) {
    const rows = await this.db
      .select({
        id: tenant.chat.id,
        assignedUserId: tenant.chat.assignedUserId,
        userId: tenant.user.id,
        userPictureUrl: tenant.user.pictureUrl,
        userRoleType: tenant.user.roleType,
        userArchivedBy: tenant.user.archivedBy,
        userCreatedAt: tenant.user.createdAt,
        userUpdatedAt: tenant.user.updatedAt,
        userDisplayName: tenant.user.displayName,
        chatTeamAssignmentId: tenant.chatTeamAssignment.id,
        chatTeamAssignmentChatId: tenant.chatTeamAssignment.chatId,
        chatTeamAssignmentTeamId: tenant.chatTeamAssignment.teamId,
        chatTeamAssignmentCreatedAt: tenant.chatTeamAssignment.createdAt,
        teamId: tenant.team.id,
        teamName: tenant.team.name,
        teamIsDefault: tenant.team.isDefault,
        teamIsActive: tenant.team.isActive,
        teamCreatedAt: tenant.team.createdAt,
        userTeamUserId: tenant.userTeam.userId,
      })
      .from(tenant.chat)
      .leftJoin(tenant.user, eq(tenant.user.id, tenant.chat.assignedUserId))
      .leftJoin(tenant.chatTeamAssignment, eq(tenant.chatTeamAssignment.chatId, tenant.chat.id))
      .leftJoin(tenant.team, eq(tenant.team.id, tenant.chatTeamAssignment.teamId))
      .leftJoin(tenant.userTeam, eq(tenant.userTeam.teamId, tenant.team.id))
      .where(eq(tenant.chat.id, chatId));

    if (!rows.length) {
      throw new NotFoundException(this.i18n.t('errors.chat.notFound'));
    }

    const base = rows[0];
    const user = base.userId
      ? {
          id: base.userId,
          pictureUrl: base.userPictureUrl,
          roleType: base.userRoleType,
          archivedBy: base.userArchivedBy,
          createdAt: base.userCreatedAt,
          updatedAt: base.userUpdatedAt,
          displayName: base.userDisplayName,
        }
      : null;

    const chatTeamAssignmentsMap = new Map<
      string,
      {
        id: string;
        chatId: string | null;
        teamId: string | null;
        createdAt: Date | null;
        team: {
          id: string;
          name: string | null;
          isDefault: boolean | null;
          isActive: boolean | null;
          createdAt: Date | null;
          userTeams: { userId: string }[];
        };
        userTeamIds: Set<string>;
      }
    >();

    rows.forEach((row) => {
      if (!row.chatTeamAssignmentId || !row.teamId) return;

      const existing = chatTeamAssignmentsMap.get(row.chatTeamAssignmentId);
      if (!existing) {
        chatTeamAssignmentsMap.set(row.chatTeamAssignmentId, {
          id: row.chatTeamAssignmentId,
          chatId: row.chatTeamAssignmentChatId,
          teamId: row.chatTeamAssignmentTeamId,
          createdAt: row.chatTeamAssignmentCreatedAt,
          team: {
            id: row.teamId,
            name: row.teamName,
            isDefault: row.teamIsDefault,
            isActive: row.teamIsActive,
            createdAt: row.teamCreatedAt,
            userTeams: row.userTeamUserId ? [{ userId: row.userTeamUserId }] : [],
          },
          userTeamIds: new Set(row.userTeamUserId ? [row.userTeamUserId] : []),
        });
        return;
      }

      if (row.userTeamUserId && !existing.userTeamIds.has(row.userTeamUserId)) {
        existing.userTeamIds.add(row.userTeamUserId);
        existing.team.userTeams.push({ userId: row.userTeamUserId });
      }
    });

    const chatTeamAssignments = Array.from(chatTeamAssignmentsMap.values()).map(
      ({ ...assignment }) => assignment,
    );

    return {
      id: base.id,
      assignedUserId: base.assignedUserId,
      user,
      chatTeamAssignments,
    };
  }

  private countAssignedOperators(
    chatTeamAssignments: ChatTeamAssignmentsWithUserId[],
    assignedUserId: string,
  ) {
    return chatTeamAssignments.reduce((count, { team }) => {
      const isOperatorAssigned = team.userTeams.some(
        (userTeam) => userTeam.userId === assignedUserId,
      );

      return isOperatorAssigned ? count + 1 : count;
    }, 0);
  }
}
