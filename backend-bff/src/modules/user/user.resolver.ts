import { UseGuards } from '@nestjs/common';
import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';

import { Roles } from '@/common/decorators/roles.decorator';
import {
  IsHypervisor,
  UserId,
  UserOrganizationId,
  UserRole,
} from '@/common/decorators/user.decorator';
import { FilterInput } from '@/common/dto/filter.args';
import {
  createCursorPaginatedResponse,
  CursorPaginationArgs,
  PaginationArgs,
} from '@/common/dto/pagination.args';
import { GqlThrottlerGuard } from '@/common/guards/graphql-throttler.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { RoleGuard } from '@/common/guards/role.guard';
import { AuthGuard } from '@/modules/auth/auth.guard';
import { HypervisorService } from '@/modules/hypervisor/hypervisor.service';
import { OrganizationService } from '@/modules/organization/organization.service';

import {
  adminManagerAndHypervisorRoles,
  adminManagerRoles,
  adminRoles,
  allUserRoles,
  allUserRolesAndHypervisor,
  managerOperatorRoles,
  managerRoles,
} from '../auth/constants';

import { CreateUserInput } from './dto/create-user.input';
import { ResetPasswordByTokenResponse } from './dto/reset-password-by-token-response.dto';
import { ResetPasswordByTokenInput } from './dto/reset-password-by-token.input';
import {
  ResetPasswordInput,
  UpdateDisplayNameInput,
  UpdateSenderNameInput,
  UpdateUserInput,
} from './dto/update-user.input';
import { UsersWithCount } from './dto/users-with-count.dto';
import { User } from './entities/user.entity';
import { SystemUserType, UserRoleType } from './enums';
import { UserService } from './user.service';

const UserCursorPaginatedResponse = createCursorPaginatedResponse(User);

@UseGuards(GqlThrottlerGuard)
@Resolver(() => User)
export class UserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly hypervisorService: HypervisorService,
    private readonly organizationService: OrganizationService,
  ) {}

  @Roles(adminManagerRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => User)
  createUser(
    @Args('createUserInput') createUserInput: CreateUserInput,
    @UserOrganizationId() organizationId: string,
  ) {
    return this.userService.create(createUserInput, organizationId);
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => UsersWithCount, { name: 'users' })
  async findAll(
    @Args() paginationArgs: PaginationArgs,
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
    @UserRole() role: string,
    @Args('filter', { nullable: true }) filter?: FilterInput,
  ) {
    if (managerOperatorRoles.includes(role)) {
      return await this.userService.findAll(paginationArgs, organizationId, userId, role, filter);
    }
    return await this.userService.findAll(paginationArgs, organizationId, undefined, role, filter);
  }

  @Roles(adminManagerAndHypervisorRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => Boolean, { name: 'checkUserExists' })
  findByEmail(@Args('email') email: string, @UserOrganizationId() organizationId: string) {
    return this.userService.findOneByEmail(email, organizationId);
  }

  @Roles(allUserRolesAndHypervisor)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => User, { name: 'user' })
  findOne(@UserOrganizationId() organizationId: string, @Args('id') id: string) {
    return this.userService.findOne(id, organizationId);
  }

  @UseGuards(AuthGuard)
  @Query(() => User, { name: 'me' })
  me(
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
    @IsHypervisor() isHypervisor: boolean,
  ) {
    if (isHypervisor) {
      return this.hypervisorService.findOne(userId);
    }

    return this.userService.findMe(userId, organizationId);
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => Int, { name: 'operatorCount' })
  getOperatorCount(@UserOrganizationId() organizationId: string, @UserRole() role: string) {
    if (!adminRoles.includes(role)) return 0;
    return this.userService.findOperatorCount(organizationId);
  }

  @Roles(adminManagerRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => User)
  async updateUser(
    @Args('updateUserInput') updateUserInput: UpdateUserInput,
    @UserOrganizationId() organizationId: string,
    @UserRole() role: string,
    @UserId() userId: string,
  ) {
    return this.userService.updateWithValidation(updateUserInput, organizationId, role, userId);
  }

  @Roles(adminManagerRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => User)
  async toggleUserStatus(
    @UserOrganizationId() organizationId: string,
    @Args('id', { type: () => String }) id: string,
    @UserId() userId: string,
    @UserRole() role: string,
  ) {
    return this.userService.toggleStatus(id, organizationId, userId, role);
  }

  @UseGuards(AuthGuard, OrganizationGuard)
  @Mutation(() => User)
  async updateDisplayName(
    @Args('updateDisplayNameInput') updateDisplayNameInput: UpdateDisplayNameInput,
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
  ) {
    return this.userService.updateDisplayName(userId, updateDisplayNameInput, organizationId);
  }

  @UseGuards(AuthGuard, OrganizationGuard)
  @Mutation(() => User)
  async updateSenderName(
    @Args('updateSenderNameInput') updateSenderNameInput: UpdateSenderNameInput,
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
  ) {
    return this.userService.updateSenderName(userId, updateSenderNameInput, organizationId);
  }

  @UseGuards(AuthGuard, OrganizationGuard)
  @Mutation(() => User)
  async resetPassword(
    @Args('resetPasswordInput') resetPasswordInput: ResetPasswordInput,
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
  ) {
    return this.userService.updatePassword(userId, resetPasswordInput, organizationId);
  }

  @Mutation(() => Boolean)
  async requestPasswordReset(@Args('email') email: string) {
    return this.userService.initiatePasswordReset(email, true);
  }

  @Mutation(() => Boolean)
  async requestReInvite(@Args('email') email: string) {
    return this.userService.initiatePasswordReset(email);
  }

  @Mutation(() => ResetPasswordByTokenResponse)
  async resetPasswordByToken(
    @Args('resetPasswordByTokenInput') resetPasswordByTokenInput: ResetPasswordByTokenInput,
  ) {
    const { token, newPassword } = resetPasswordByTokenInput;
    return this.userService.resetPasswordByToken(token, newPassword);
  }

  @Query(() => Boolean)
  async verifyPasswordResetToken(@Args('token') token: string) {
    const data = await this.userService.validateResetToken(token);
    return !!data;
  }

  @Roles(adminManagerAndHypervisorRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => UserCursorPaginatedResponse, { name: 'managers' })
  async findManagers(
    @UserId() userId: string,
    @UserRole() role: string,
    @UserOrganizationId() contextOrganizationId: string,
    @Args('inputOrganizationId', { nullable: true }) inputOrganizationId: string,
    @Args({ nullable: true }) paginationArgs: CursorPaginationArgs,
  ) {
    const organizationId = await this.resolveOrganizationId(
      role,
      contextOrganizationId,
      inputOrganizationId,
    );

    if (managerRoles.includes(role)) {
      return this.userService.findByRoles(
        [UserRoleType.MANAGER, UserRoleType.MANAGER_OPERATOR],
        organizationId,
        paginationArgs,
        userId,
      );
    }

    return this.userService.findByRoles(
      [UserRoleType.MANAGER, UserRoleType.MANAGER_OPERATOR],
      organizationId,
      paginationArgs,
    );
  }

  @Roles(adminManagerRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => UserCursorPaginatedResponse, { name: 'adminOperators' })
  findAdminOperators(
    @UserOrganizationId() organizationId: string,
    @Args({ nullable: true }) paginationArgs: CursorPaginationArgs,
  ) {
    return this.userService.findByRoles(
      [UserRoleType.ADMIN_OPERATOR],
      organizationId,
      paginationArgs,
    );
  }

  @Roles(allUserRolesAndHypervisor)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => UserCursorPaginatedResponse, { name: 'allSelectableOperators' })
  async findAllSelectableOperators(
    @UserOrganizationId() contextOrganizationName: string,
    @UserRole() role: string,
    @Args('inputOrganizationId', { nullable: true }) inputOrganizationId: string,
    @Args({ nullable: true }) paginationArgs: CursorPaginationArgs,
  ) {
    const organizationId = await this.resolveOrganizationId(
      role,
      contextOrganizationName,
      inputOrganizationId,
    );
    return await this.userService.findAllSelectableOperators(organizationId, paginationArgs);
  }

  @Roles([SystemUserType.HYPERVISOR, ...adminRoles])
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => Boolean)
  removeUser(@Args('id', { type: () => String }) id: string) {
    return this.userService.remove(id);
  }

  private resolveOrganizationId(
    role: string,
    contextOrganizationId: string,
    inputOrganizationId?: string,
  ) {
    return this.organizationService.resolveOrganizationId(
      role,
      contextOrganizationId,
      inputOrganizationId,
    );
  }
}
