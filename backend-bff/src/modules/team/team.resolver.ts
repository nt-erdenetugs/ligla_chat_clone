import { BadRequestException, UseGuards, ForbiddenException } from '@nestjs/common';
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';

import { I18nService } from 'nestjs-i18n';

import { Roles } from '@/common/decorators/roles.decorator';
import { UserId, UserOrganizationId, UserRole } from '@/common/decorators/user.decorator';
import { FilterInput } from '@/common/dto/filter.args';
import { PaginationArgs } from '@/common/dto/pagination.args';
import { GqlThrottlerGuard } from '@/common/guards/graphql-throttler.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { RoleGuard } from '@/common/guards/role.guard';
import { trimAndCleanSpaces } from '@/common/utils/string';
import { AuthGuard } from '@/modules/auth/auth.guard';
import { ChatService } from '@/modules/chat/chat.service';
import { OrganizationService } from '@/modules/organization/organization.service';
import { SystemUserType, UserStatusType } from '@/modules/user/enums';

import {
  adminAndHypervisorRoles,
  adminManagerAndHypervisorRoles,
  adminRoles,
  allUserRoles,
  allUserRolesAndHypervisor,
  managerOperatorRoles,
  managerRoles,
  operatorRoles,
} from '../auth/constants';

import { CreateTeamInput } from './dto/create-team.input';
import { TeamsWithCount } from './dto/teams-with-count.dto';
import { UpdateTeamInput } from './dto/update-team.input';
import { SelectableTeam, Team } from './entities/team.entity';
import { TeamService } from './team.service';

@UseGuards(GqlThrottlerGuard)
@Resolver(() => Team)
export class TeamResolver {
  constructor(
    private readonly teamService: TeamService,
    private readonly chatService: ChatService,
    private readonly i18n: I18nService,
    private readonly organizationService: OrganizationService,
  ) {}

  @Roles(adminAndHypervisorRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => Team)
  async createTeam(
    @Args('createTeamInput') createTeamInput: CreateTeamInput,
    @UserOrganizationId() contextOrganizationId: string,
    @UserRole() role: string,
    @Args('inputOrganizationId', { nullable: true }) inputOrganizationId: string,
  ) {
    if (!adminRoles.includes(role) && role !== SystemUserType.HYPERVISOR) {
      throw new ForbiddenException(this.i18n.t('errors.team.forbiddenCreate'));
    }

    const organizationId = await this.organizationService.resolveOrganizationId(
      role,
      contextOrganizationId,
      inputOrganizationId,
    );

    const { name: _name } = createTeamInput;
    const name = trimAndCleanSpaces(_name);

    const defaultTeam = await this.teamService.findDefaultTeamByOrganization(organizationId);
    const { name: defaultTeamName } = defaultTeam || {};

    const existingTeam = await this.teamService.findByName(organizationId, name);
    if (existingTeam) {
      throw new BadRequestException(this.i18n.t('errors.team.teamNameTaken'));
    }

    if (name.toLowerCase() === defaultTeamName?.toLowerCase()) {
      throw new BadRequestException(this.i18n.t('errors.team.defaultTeamName'));
    }

    return this.teamService.create(createTeamInput, organizationId);
  }

  @Roles(allUserRolesAndHypervisor)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => TeamsWithCount, { name: 'teams' })
  async findAll(
    @Args() paginationArgs: PaginationArgs,
    @UserOrganizationId() contextOrganizationId: string,
    @Args('inputOrganizationId', { nullable: true }) inputOrganizationId: string,
    @UserId() userId: string,
    @UserRole() role: string,
    @Args('filter', { nullable: true }) filter?: FilterInput,
  ): Promise<TeamsWithCount> {
    const organizationId = await this.organizationService.resolveOrganizationId(
      role,
      contextOrganizationId,
      inputOrganizationId,
    );

    if (managerOperatorRoles.includes(role)) {
      return this.teamService.findAll(organizationId, paginationArgs, userId, undefined, filter);
    }

    return this.teamService.findAll(organizationId, paginationArgs, undefined, undefined, filter);
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => [SelectableTeam], { name: 'selectableTeams' })
  findAllForSelect(
    @UserOrganizationId() organizationId: string,
    @UserRole() role: string,
    @UserId() userId: string,
  ) {
    if (operatorRoles.includes(role) || managerRoles.includes(role)) {
      return this.teamService.findAllForSelect(organizationId, userId);
    }
    return this.teamService.findAllForSelect(organizationId);
  }

  // TODO: merge this with selectableTeams if possible [phase 2][task 107299528]
  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => [SelectableTeam], { name: 'selectableTeamsForChatFilter' })
  findAllForChatFilterSelect(
    @UserOrganizationId() organizationId: string,
    @UserRole() role: string,
    @UserId() userId: string,
  ) {
    if (operatorRoles.includes(role) || managerRoles.includes(role)) {
      return this.teamService.findAllByChatAssignmentByUserId(organizationId, userId);
    }
    return this.teamService.findAllForSelect(organizationId);
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => [Team], { name: 'teamsInChat' })
  async findAllByChatId(
    @UserOrganizationId() organizationId: string,
    @Args('chatId', { type: () => String }) chatId: string,
    @UserId() userId: string,
    @UserRole() role: string,
  ) {
    if (adminRoles.includes(role)) {
      const result = await this.teamService.findAll(
        organizationId,
        undefined,
        undefined,
        [UserStatusType.ACTIVE, UserStatusType.LOCKED],
        {
          refineConditions: [
            {
              searchItem: 'isActive',
              condition: 'equals',
              value: true,
            },
          ],
        },
      );
      return result.items;
    }

    return this.teamService.findAllByChatId(organizationId, userId, chatId);
  }

  @Roles(allUserRolesAndHypervisor)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => Team, { name: 'team' })
  async findOneById(
    @UserOrganizationId() contextOrganizationId: string,
    @Args('inputOrganizationId', { nullable: true }) inputOrganizationId: string,
    @Args('id') id: string,
    @UserRole() role: string,
    @UserId() userId: string,
  ) {
    const organizationId = await this.organizationService.resolveOrganizationId(
      role,
      contextOrganizationId,
      inputOrganizationId,
    );
    if (operatorRoles.includes(role) || managerRoles.includes(role)) {
      const isInTeam = await this.teamService.isUserInTeam(organizationId, id, userId);
      if (!isInTeam) {
        throw new ForbiddenException(this.i18n.t('errors.team.forbiddenView'));
      }
    }
    return this.teamService.findOneById(organizationId, id);
  }

  @Roles(adminManagerAndHypervisorRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => Team)
  async updateTeam(
    @UserRole() role: string,
    @UserId() userId: string,
    @Args('updateTeamInput') updateTeamInput: UpdateTeamInput,
    @UserOrganizationId() contextOrganizationId: string,
    @Args('inputOrganizationId', { nullable: true }) inputOrganizationId: string,
  ) {
    const organizationId = await this.organizationService.resolveOrganizationId(
      role,
      contextOrganizationId,
      inputOrganizationId,
    );

    const targetTeam = await this.validateTeamUpdate(role, userId, updateTeamInput, organizationId);

    await this.validateTeamNameChanges(targetTeam, updateTeamInput.name, organizationId);

    return this.teamService.update(updateTeamInput, organizationId);
  }

  @Roles(adminManagerAndHypervisorRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => Team)
  async toggleTeamStatus(
    @UserOrganizationId() contextOrganizationId: string,
    @Args('inputOrganizationId', { nullable: true }) inputOrganizationId: string,
    @Args('id', { type: () => String }) id: string,
    @UserId() userId: string,
    @UserRole() role: string,
  ) {
    const organizationId = await this.organizationService.resolveOrganizationId(
      role,
      contextOrganizationId,
      inputOrganizationId,
    );

    await this.validateTeamUpdate(role, userId, { id }, organizationId);

    const targetTeam = await this.teamService.findRawTeamById(organizationId, id);
    return this.teamService.updateStatus(organizationId, id, !targetTeam.isActive);
  }

  private validateOperatorAccess(role: string): void {
    if (operatorRoles.includes(role)) {
      throw new ForbiddenException(this.i18n.t('errors.team.forbiddenOperatorUpdate'));
    }
  }

  private async validateTeamUpdate(
    role: string,
    userId: string,
    updateTeamInput: UpdateTeamInput,
    organizationId: string,
  ) {
    this.validateOperatorAccess(role);

    const targetTeam = await this.teamService.findRawTeamById(organizationId, updateTeamInput.id);

    if (managerRoles.includes(role)) {
      await this.validateManagerPermissions(targetTeam, userId, updateTeamInput, organizationId);
    }

    await this.validateTeamDeletion(targetTeam.id, updateTeamInput.isActive, organizationId);

    return targetTeam;
  }

  private async validateTeamDeletion(
    teamId: string,
    isActive: boolean | undefined,
    organizationId: string,
  ): Promise<void> {
    if (!isActive) {
      const existingTeam = await this.teamService.findRawTeamById(organizationId, teamId);
      if (existingTeam.isDefault) {
        throw new ForbiddenException(this.i18n.t('errors.team.defaultTeamDeletion'));
      }

      const hasActiveChatForTeamMembers = await this.chatService.hasActiveChatForTeamMembers(
        teamId,
        organizationId,
      );
      if (hasActiveChatForTeamMembers) {
        throw new BadRequestException(this.i18n.t('errors.team.hasOngoingChat'));
      }

      const hasRuleForTargetTeam = await this.teamService.hasRuleForTargetTeam(
        organizationId,
        teamId,
      );
      if (hasRuleForTargetTeam) {
        throw new BadRequestException(this.i18n.t('errors.team.hasRules'));
      }
    }
  }

  private async validateManagerPermissions(
    targetTeam: any,
    userId: string,
    updateTeamInput: UpdateTeamInput,
    organizationId: string,
  ): Promise<void> {
    // Check if manager belongs to team
    const isManagerOfTeam = await this.teamService.isUserInTeam(
      organizationId,
      targetTeam.id,
      userId,
    );
    if (!isManagerOfTeam) {
      throw new ForbiddenException(this.i18n.t('errors.team.forbiddenManagerUpdate'));
    }

    // Check if manager is trying to modify team composition
    if (this.isTeamCompositionModified(targetTeam, updateTeamInput)) {
      throw new ForbiddenException(this.i18n.t('errors.team.forbiddenManagerComposition'));
    }
  }

  private isTeamCompositionModified(targetTeam: any, updateTeamInput: UpdateTeamInput): boolean {
    const currentManagerIds = targetTeam.userTeams
      .filter((team: any) => managerRoles.includes(team.user.roleType))
      .map(({ userId }: { userId: string }) => userId);

    const currentStoreIds = targetTeam.storeTeams.map(
      ({ storeId }: { storeId: string }) => storeId,
    );

    const isManagersModified = !this.areArraysEqual(currentManagerIds, updateTeamInput.managerIds);
    const isStoresModified = !this.areArraysEqual(currentStoreIds, updateTeamInput.storeIds);

    return isManagersModified || isStoresModified;
  }

  private areArraysEqual(arr1: string[] = [], arr2: string[] = []): boolean {
    if (arr1.length !== arr2.length) return false;
    const set = new Set(arr1);
    return arr2.every((id) => set.has(id));
  }

  private async validateTeamNameChanges(
    targetTeam: any,
    newName: string | undefined,
    organizationId: string,
  ): Promise<void> {
    if (!newName || newName === targetTeam.name) return;

    const defaultTeam = await this.teamService.findDefaultTeamByOrganization(organizationId);
    const { id: defaultTeamId, name: defaultTeamName } = defaultTeam || {};

    // Check default team name conflicts
    if (newName === defaultTeamName) {
      throw new BadRequestException(this.i18n.t('errors.team.defaultTeamName'));
    }

    if (targetTeam.id === defaultTeamId && newName !== targetTeam.name) {
      throw new BadRequestException(this.i18n.t('errors.team.changeToDefaultTeamName'));
    }

    // Check name uniqueness
    const existingTeam = await this.teamService.findByName(organizationId, newName);
    if (existingTeam) {
      throw new BadRequestException(this.i18n.t('errors.team.teamNameTaken'));
    }
  }

  @Roles(adminAndHypervisorRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => Team)
  async disableTeam(
    @UserOrganizationId() contextOrganizationId: string,
    @Args('inputOrganizationId', { nullable: true }) inputOrganizationId: string,
    @Args('id', { type: () => String }) id: string,
    @UserRole() role: string,
  ) {
    if (!adminAndHypervisorRoles.includes(role)) {
      throw new ForbiddenException(this.i18n.t('errors.team.forbiddenDisable'));
    }

    const organizationId = await this.organizationService.resolveOrganizationId(
      role,
      contextOrganizationId,
      inputOrganizationId,
    );

    await this.validateTeamDeletion(id, false, organizationId);
    return this.teamService.disable(organizationId, id);
  }
}
