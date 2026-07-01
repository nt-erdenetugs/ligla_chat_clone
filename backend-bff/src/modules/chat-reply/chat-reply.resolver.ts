import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';

import { I18nService } from 'nestjs-i18n';

import { Roles } from '@/common/decorators/roles.decorator';
import { UserId, UserOrganizationId } from '@/common/decorators/user.decorator';
import { GqlThrottlerGuard } from '@/common/guards/graphql-throttler.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { RoleGuard } from '@/common/guards/role.guard';
import { AuthGuard } from '@/modules/auth/auth.guard';
import { allUserRoles } from '@/modules/auth/constants';

import { ChatReplyService } from './chat-reply.service';
import { CreateChatReplySettingInput, UpdateChatReplySettingInput } from './dto/chat-reply.input';
import { ChatReplySetting } from './entities/chat-reply.entity';

@UseGuards(GqlThrottlerGuard)
@Resolver(() => ChatReplySetting)
export class ChatReplyResolver {
  constructor(
    private readonly chatReplyService: ChatReplyService,
    private readonly i18n: I18nService,
  ) {}

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => ChatReplySetting, { name: 'chatReplySetting', nullable: true })
  async findOne(
    @Args('inputOrganizationId', { nullable: true }) inputOrganizationId: string,
    @UserId() userId: string,
  ) {
    if (!inputOrganizationId) {
      return this.chatReplyService.findOneByUserId(userId);
    }

    return this.chatReplyService.findOneByOrganizationId(inputOrganizationId);
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => ChatReplySetting)
  async createChatReplySetting(
    @Args('createChatReplySettingInput') input: CreateChatReplySettingInput,
    @Args('inputOrganizationId', { nullable: true }) inputOrganizationId: string,
    @UserOrganizationId() contextOrganizationId: string,
    @UserId() userId: string,
  ) {
    if (!inputOrganizationId) {
      return this.chatReplyService.create(input, userId, contextOrganizationId);
    }

    return this.chatReplyService.create(input, userId, inputOrganizationId);
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => ChatReplySetting)
  async updateChatReplySetting(
    @Args('updateChatReplySettingInput') input: UpdateChatReplySettingInput,
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
  ) {
    await this.validatePermissions(input.id, organizationId);
    return this.chatReplyService.update(input, userId, organizationId);
  }

  private async validatePermissions(id: string, organizationId: string) {
    const chatReplySetting = await this.chatReplyService.findRawOne(id);

    if (chatReplySetting?.organizationId !== organizationId) {
      throw new ForbiddenException(
        this.i18n.t('errors.exception.forbiddenEntityAccess', {
          args: { entityName: 'ChatReplySetting' },
        }),
      );
    }
  }
}
