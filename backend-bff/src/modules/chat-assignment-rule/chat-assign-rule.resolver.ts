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

import { ChatAssignRuleService } from './chat-assign-rule.service';
import { ChatAssignRulesWithCount } from './dto/chat-assign-rules-with-count.dto';
import { CreateChatAssignRuleInput } from './dto/create-chat-assign-rule.input';
import { UpdateChatAssignRuleInput } from './dto/update-chat-assign-rule.input';
import { ChatAssignRule } from './entities/chat-assign-rule.entity';

@Resolver(() => ChatAssignRule)
export class ChatAssignRuleResolver {
  constructor(private readonly chatAssignRuleService: ChatAssignRuleService) {}

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => ChatAssignRulesWithCount, { name: 'chatAssignRules' })
  async findAll(
    @Args() paginationArgs: PaginationArgs,
    @UserOrganizationId() organizationId: string,
    @Args('filter', { nullable: true }) filter?: FilterInput,
  ): Promise<ChatAssignRulesWithCount> {
    return await this.chatAssignRuleService.findAll(paginationArgs, organizationId, filter);
  }

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => ChatAssignRule, { name: 'chatAssignRule' })
  findOne(@UserOrganizationId() organizationId: string, @Args('id') id: string) {
    return this.chatAssignRuleService.findOneById(organizationId, id);
  }

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => ChatAssignRule)
  createChatAssignRule(
    @Args('createChatAssignRuleInput') input: CreateChatAssignRuleInput,
    @UserOrganizationId() organizationId: string,
  ) {
    return this.chatAssignRuleService.create(input, organizationId);
  }

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => ChatAssignRule)
  updateChatAssignRule(
    @Args('updateChatAssignRuleInput') input: UpdateChatAssignRuleInput,
    @UserOrganizationId() organizationId: string,
  ) {
    return this.chatAssignRuleService.update(input, organizationId);
  }

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => ChatAssignRule)
  deleteChatAssignRule(@UserOrganizationId() organizationId: string, @Args('id') id: string) {
    return this.chatAssignRuleService.remove(organizationId, id);
  }
}
