import { UseGuards } from '@nestjs/common';
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';

import { Roles } from '@/common/decorators/roles.decorator';
import { UserId, UserOrganizationId } from '@/common/decorators/user.decorator';
import { FilterInput } from '@/common/dto/filter.args';
import { PaginationArgs } from '@/common/dto/pagination.args';
import { GqlThrottlerGuard } from '@/common/guards/graphql-throttler.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { RoleGuard } from '@/common/guards/role.guard';
import { AuthGuard } from '@/modules/auth/auth.guard';
import { adminRoles, allUserRoles } from '@/modules/auth/constants';

import { AttributeService } from './attribute.service';
import { CreateAttributeInput } from './dto/create-attribute.input';
import { CreateChatAttributeValueInput } from './dto/create-chat-attribute-value.input';
import { UpdateAttributeInput } from './dto/update-attribute.input';
import { AttributesWithCount } from './dtos/attributes-with-count.dto';
import { AttributeValue } from './entities/attribute-value.entity';
// import { NotifyCore } from '@/common/Interceptor/notify-core.interceptor';
// import { ChatDataSyncType } from '../chat-data-sync/dto/notify-core.input';
import { Attribute } from './entities/attribute.entity';

@UseGuards(GqlThrottlerGuard)
@Resolver(() => Attribute)
export class AttributeResolver {
  constructor(private readonly attributeService: AttributeService) {}

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => Attribute)
  // @NotifyCore({
  //   type: ChatDataSyncType.ATTRIBUTES,
  // })
  createAttribute(
    @Args('createAttributeInput', { type: () => CreateAttributeInput })
    createAttributeInput: CreateAttributeInput,
    @UserOrganizationId() organizationId: string,
  ) {
    return this.attributeService.create(createAttributeInput, organizationId);
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => AttributesWithCount, { name: 'attributes' })
  findAll(
    @Args() paginationArgs: PaginationArgs,
    @UserOrganizationId() organizationId: string,
    @Args('filter', { nullable: true }) filter?: FilterInput,
  ) {
    return this.attributeService.findAll(paginationArgs, organizationId, filter);
  }

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => Attribute, { name: 'attribute' })
  findOne(
    @UserOrganizationId() organizationId: string,
    @Args('id', { type: () => String }) id: string,
  ) {
    return this.attributeService.findOne(id, organizationId);
  }

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => Attribute)
  // @NotifyCore({
  //   type: ChatDataSyncType.ATTRIBUTES,
  // })
  updateAttribute(
    @Args('updateAttributeInput', { type: () => UpdateAttributeInput })
    updateAttributeInput: UpdateAttributeInput,
    @UserOrganizationId() organizationId: string,
  ) {
    return this.attributeService.update(updateAttributeInput, organizationId);
  }

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => Attribute)
  // @NotifyCore({
  //   type: ChatDataSyncType.ATTRIBUTES,
  // })
  async toggleAttributeStatus(
    @UserOrganizationId() organizationId: string,
    @Args('id', { type: () => String }) id: string,
  ) {
    return this.attributeService.toggle(organizationId, id);
  }

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => Attribute)
  // @NotifyCore({
  //   type: ChatDataSyncType.ATTRIBUTES,
  // })
  disableAttribute(
    @UserOrganizationId() organizationId: string,
    @Args('id', { type: () => String }) id: string,
  ) {
    return this.attributeService.disable(organizationId, id);
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => AttributeValue)
  // @NotifyCore({
  //   type: ChatDataSyncType.USER_ATTRIBUTES,
  //   buildPayload: (result) => ({
  //     userId: result.chat.endUserId,
  //   }),
  // })
  fillChatAttributeValue(
    @Args('createChatAttributeValueInput', { type: () => CreateChatAttributeValueInput })
    createChatAttributeValueInput: CreateChatAttributeValueInput,
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
  ) {
    return this.attributeService.fillChatAttributeValue(
      createChatAttributeValueInput,
      userId,
      organizationId,
    );
  }
}
