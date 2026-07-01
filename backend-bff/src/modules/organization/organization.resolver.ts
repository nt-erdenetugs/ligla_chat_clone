import { UseGuards } from '@nestjs/common';
import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';

import { Roles } from '@/common/decorators/roles.decorator';
import { UserId, UserOrganizationId, UserRole } from '@/common/decorators/user.decorator';
import { FilterInput } from '@/common/dto/filter.args';
import { PaginationArgs } from '@/common/dto/pagination.args';
import { GqlThrottlerGuard } from '@/common/guards/graphql-throttler.guard';
import { RoleGuard } from '@/common/guards/role.guard';
import { AuthGuard } from '@/modules/auth/auth.guard';
import { SystemUserType } from '@/modules/user/enums';

import { adminRoles, allUserRoles } from '../auth/constants';

import { CreateOrganizationInput } from './dto/create-organization.input';
import { OrganizationsWithCount } from './dto/organizations-with-count.dto';
import { UpdateOrganizationInput } from './dto/update-organization.input';
import { Organization } from './entities/organization.entity';
import { OrganizationService } from './organization.service';

@UseGuards(GqlThrottlerGuard)
@Resolver(() => Organization)
export class OrganizationResolver {
  constructor(private readonly organizationService: OrganizationService) {}

  @Roles([SystemUserType.HYPERVISOR])
  @UseGuards(AuthGuard, RoleGuard)
  @Mutation(() => Organization)
  createOrganization(
    @Args('createOrganizationInput') createOrganizationInput: CreateOrganizationInput,
    @UserId() hypervisorUserId: string,
  ) {
    return this.organizationService.create(createOrganizationInput, hypervisorUserId);
  }

  @Roles([SystemUserType.HYPERVISOR])
  @UseGuards(AuthGuard, RoleGuard)
  @Query(() => OrganizationsWithCount, { name: 'organizations' })
  async findAll(
    @Args() paginationArgs: PaginationArgs,
    @Args('filter', { nullable: true }) filter?: FilterInput,
  ) {
    return this.organizationService.findAll(paginationArgs, filter);
  }

  @Roles([SystemUserType.HYPERVISOR])
  @UseGuards(AuthGuard, RoleGuard)
  @Query(() => Organization, { name: 'organization' })
  findOneByName(@Args('name') name: string) {
    return this.organizationService.findOneByName(name);
  }

  @Roles([SystemUserType.HYPERVISOR])
  @UseGuards(AuthGuard, RoleGuard)
  @Mutation(() => Organization)
  updateOrganization(
    @Args('updateOrganizationInput') updateOrganizationInput: UpdateOrganizationInput,
  ) {
    return this.organizationService.update(updateOrganizationInput);
  }

  @Roles([SystemUserType.HYPERVISOR])
  @UseGuards(AuthGuard, RoleGuard)
  @Mutation(() => Organization)
  async toggleOrganizationStatus(@Args('name', { type: () => String }) name: string) {
    const targetOrganization = await this.organizationService.findOneByName(name);

    const isActive = !targetOrganization.isActive;
    return this.organizationService.update({ name, isActive });
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard)
  @Query(() => Int, { name: 'maxOperatorCount' })
  async getMaxOperatorCount(
    @UserOrganizationId() organizationId: string,
    @UserRole() role: string,
  ) {
    if (!adminRoles.includes(role)) return 0;
    return this.organizationService.getMaxOperatorCount(organizationId);
  }
}
