import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Resolver, Args, Mutation } from '@nestjs/graphql';

import { I18nService } from 'nestjs-i18n';

import { Roles } from '@/common/decorators/roles.decorator';
import { UserId, UserOrganizationId } from '@/common/decorators/user.decorator';
import { GqlThrottlerGuard } from '@/common/guards/graphql-throttler.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { RoleGuard } from '@/common/guards/role.guard';
import { AuthGuard } from '@/modules/auth/auth.guard';
import { adminManagerRoles, allUserRoles, operatorRoles } from '@/modules/auth/constants';
import { ChatService } from '@/modules/chat/chat.service';
import { ChatActivity } from '@/modules/chat/entities/chat-activity.entity';
import { UserService } from '@/modules/user/user.service';

import { ChatAssignmentService } from './chat-assignment.service';
import { ChatAssignInput } from './dto/chat-assign.input';
import { ChatTeamAssignInput } from './dto/chat-team-assign.input';
import { ChatTeamAssignment } from './entities/chat-assignee.entity';
import { ChatTeamAssignActionsType } from './enums';

@UseGuards(GqlThrottlerGuard)
@Resolver(() => ChatTeamAssignment)
export class ChatAssignmentResolver {
  constructor(
    private readonly chatAssignmentService: ChatAssignmentService,
    private readonly userService: UserService,
    private readonly chatService: ChatService,
    private readonly i18n: I18nService,
  ) {}

  @Roles(adminManagerRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => ChatActivity)
  async assignTeamToChat(
    @Args('chatTeamAssignInput') chatTeamAssignInput: ChatTeamAssignInput,
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
  ) {
    const chat = await this.chatService.findRawOne(chatTeamAssignInput.chatId, organizationId);

    if (!chat) {
      throw new ForbiddenException(this.i18n.t('errors.chat.notFound'));
    }

    const user = await this.userService.findOne(userId, organizationId);

    const isOperator = operatorRoles.includes(user.roleType);

    if (isOperator) {
      throw new ForbiddenException(this.i18n.t('errors.chat.cannotAssignTeam'));
    }

    return this.chatAssignmentService.assignTeamToChat(
      {
        ...chatTeamAssignInput,
        userId,
        action: ChatTeamAssignActionsType.ADDED,
        organizationId,
      },
      organizationId,
    );
  }

  @Roles(adminManagerRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => ChatActivity)
  async removeTeamFromChat(
    @Args('chatTeamAssignInput') chatTeamAssignInput: ChatTeamAssignInput,
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
  ) {
    const chat = await this.chatService.findRawOne(chatTeamAssignInput.chatId, organizationId);

    if (!chat) {
      throw new ForbiddenException(this.i18n.t('errors.chat.notFound'));
    }

    const user = await this.userService.findOne(userId, organizationId);

    const isOperator = operatorRoles.includes(user.roleType);

    if (isOperator) {
      throw new ForbiddenException(this.i18n.t('errors.chat.cannotAssignTeam'));
    }

    return this.chatAssignmentService.removeTeamFromChat(
      {
        ...chatTeamAssignInput,
        userId,
        action: ChatTeamAssignActionsType.REMOVED,
        organizationId,
      },
      organizationId,
    );
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => ChatActivity)
  async assignOperatorToChat(
    @Args('chatAssignInput') chatAssignInput: ChatAssignInput,
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
  ) {
    const { chatId, assignedUserId } = chatAssignInput;
    const chat = await this.chatService.findRawOne(chatId, organizationId);

    if (!chat) {
      throw new ForbiddenException(this.i18n.t('errors.chat.notFound'));
    }

    return this.chatAssignmentService.assignOperatorToChat(
      {
        chatId,
        userId,
        oldAssigneeId: chat.assignedUserId,
        newAssigneeId: assignedUserId,
        organizationId,
      },
      organizationId,
    );
  }
}
