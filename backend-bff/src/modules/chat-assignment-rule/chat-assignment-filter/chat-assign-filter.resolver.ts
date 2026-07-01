import { UseGuards } from '@nestjs/common';
import { Resolver, Query, Args, Mutation } from '@nestjs/graphql';

import { Roles } from '@/common/decorators/roles.decorator';
import { UserOrganizationId } from '@/common/decorators/user.decorator';
import { FilterInput } from '@/common/dto/filter.args';
import { PaginationArgs } from '@/common/dto/pagination.args';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { RoleGuard } from '@/common/guards/role.guard';
import { AuthGuard } from '@/modules/auth/auth.guard';
import { adminRoles } from '@/modules/auth/constants';

import { ChatAssignFilterService } from './chat-assign-filter.service';
import { ChatAssignFiltersWithCount } from './dto/chat-assign-filters-with-count.dto';
import { CreateChatAssignFilterInput } from './dto/create-chat-assign-filter.input';
import { UpdateChatAssignFilterInput } from './dto/update-chat-assign-filter.input';
import { ChatAssignFilter, ChatAssignFilterItem } from './entities/chat-assign-filter.entity';

@Resolver(() => ChatAssignFilter)
export class ChatAssignFilterResolver {
  constructor(private readonly chatAssignFilterService: ChatAssignFilterService) {}

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => ChatAssignFiltersWithCount, { name: 'chatAssignFiltersWithCount' })
  findAll(
    @Args() paginationArgs: PaginationArgs,
    @UserOrganizationId() organizationId: string,
    @Args('filter', { nullable: true }) filter?: FilterInput,
  ): Promise<ChatAssignFiltersWithCount> {
    return this.chatAssignFilterService.findAll(paginationArgs, organizationId, filter);
  }

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => [ChatAssignFilterItem], { name: 'selectableChatAssignFilters' })
  findAllForSelect(@UserOrganizationId() organizationId: string) {
    return this.chatAssignFilterService.findAllForSelect(organizationId);
  }

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => ChatAssignFilter, { name: 'chatAssignFilter' })
  findOne(@UserOrganizationId() organizationId: string, @Args('id') id: string) {
    return this.chatAssignFilterService.findOneById(organizationId, id);
  }
  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => ChatAssignFilter)
  createChatAssignFilter(
    @Args('createChatAssignFilterInput') input: CreateChatAssignFilterInput,
    @UserOrganizationId() organizationId: string,
  ) {
    return this.chatAssignFilterService.create(input, organizationId);
  }

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => ChatAssignFilter)
  updateChatAssignFilter(
    @Args('updateChatAssignFilterInput') input: UpdateChatAssignFilterInput,
    @UserOrganizationId() organizationId: string,
  ) {
    return this.chatAssignFilterService.update(input, organizationId);
  }

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => ChatAssignFilter)
  deleteChatAssignFilter(@UserOrganizationId() organizationId: string, @Args('id') id: string) {
    return this.chatAssignFilterService.remove(organizationId, id);
  }
}
