import { UseGuards } from '@nestjs/common';
import { Resolver, Query, Args } from '@nestjs/graphql';

import { Roles } from '@/common/decorators/roles.decorator';
import { UserOrganizationId, UserRole } from '@/common/decorators/user.decorator';
import { FilterInput } from '@/common/dto/filter.args';
import {
  CursorPaginationArgs,
  PaginationArgs,
  createCursorPaginatedResponse,
} from '@/common/dto/pagination.args';
import { GqlThrottlerGuard } from '@/common/guards/graphql-throttler.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { RoleGuard } from '@/common/guards/role.guard';
import { AuthGuard } from '@/modules/auth/auth.guard';
import { adminManagerAndHypervisorRoles, adminRoles } from '@/modules/auth/constants';

import { OrganizationService } from '../organization/organization.service';

import { StoresWithCount } from './dto/stores-with-count.dto';
import { Store } from './entities/store.entity';
import { StoreService } from './store.service';

const StoreCursorPaginatedResponce = createCursorPaginatedResponse<Store>(Store);

@UseGuards(GqlThrottlerGuard)
@Resolver(() => Store)
export class StoreResolver {
  constructor(
    private readonly storeService: StoreService,
    private readonly organizationService: OrganizationService,
  ) {}

  @Roles(adminManagerAndHypervisorRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => StoresWithCount, { name: 'stores' })
  async findAll(
    @Args() paginationArgs: PaginationArgs,
    @UserOrganizationId() userOrganizationId: string,
    @UserRole() role: string,
    @Args('inputOrganizationId', { nullable: true }) inputOrganizationId: string,
    @Args('filter', { nullable: true }) filter?: FilterInput,
  ) {
    const organizationId = await this.organizationService.resolveOrganizationId(
      role,
      userOrganizationId,
      inputOrganizationId,
    );

    return this.storeService.findAll(paginationArgs, organizationId, filter);
  }

  @Roles(adminManagerAndHypervisorRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => StoreCursorPaginatedResponce, { name: 'storesCursor' })
  async findAllCursor(
    @Args() paginationArgs: CursorPaginationArgs,
    @UserOrganizationId() userOrganizationId: string,
    @UserRole() role: string,
    @Args('inputOrganizationId', { nullable: true }) inputOrganizationId: string,
  ) {
    const organizationId = await this.organizationService.resolveOrganizationId(
      role,
      userOrganizationId,
      inputOrganizationId,
    );

    return this.storeService.findAllCursor(paginationArgs, organizationId);
  }

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => Store, { name: 'store' })
  findOne(@UserOrganizationId() organizationId: string, @Args('id') id: string) {
    return this.storeService.findOneById(id, organizationId);
  }
}
