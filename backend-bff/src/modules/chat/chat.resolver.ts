import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Resolver, Query, Args, Mutation, Int } from '@nestjs/graphql';

import { I18nService } from 'nestjs-i18n';

import { Roles } from '@/common/decorators/roles.decorator';
import { UserId, UserOrganizationId, UserRole } from '@/common/decorators/user.decorator';
import { createCursorPaginatedResponse, CursorPaginationArgs } from '@/common/dto/pagination.args';
import { GqlThrottlerGuard } from '@/common/guards/graphql-throttler.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { RoleGuard } from '@/common/guards/role.guard';
import { AuthGuard } from '@/modules/auth/auth.guard';
import {
  adminManagerRoles,
  adminRoles,
  allOperatorRoles,
  allUserRoles,
} from '@/modules/auth/constants';
import { UserRoleType } from '@/modules/user/enums';
import { UserService } from '@/modules/user/user.service';

import { ChatService } from './chat.service';
import { ChatFilterInput } from './dto/chat-filter.input';
import { ChatLatestReadInput } from './dto/chat-latest-timestamp.input';
import { ChatMessageInput, DeleteMessageInput, RetryMessageInput } from './dto/chat-message.input';
import { ChatStatusInput } from './dto/chat-status.input';
import { ChatTagInput, UpdateChatTagsInput } from './dto/chat-tag.input';
import { SendFileUploadedMessageInput } from './dto/send-file-uploaded-message.input';
import { ShareUploadLinkInput } from './dto/share-upload-link.input';
import { ChatActivity } from './entities/chat-activity.entity';
import { ChatItem } from './entities/chat-item.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { Chat, ChatStatus } from './entities/chat.entity';

const ChatsPaginatedResponse = createCursorPaginatedResponse(Chat);
const ChatItemPaginatedResponse = createCursorPaginatedResponse(ChatItem);
// import { NotifyCore } from '@/common/Interceptor/notify-core.interceptor';
// import { ChatDataSyncType } from '../chat-data-sync/dto/notify-core.input';

@UseGuards(GqlThrottlerGuard)
@Resolver(() => Chat)
export class ChatResolver {
  constructor(
    private readonly chatService: ChatService,
    private readonly userService: UserService,
    private readonly i18n: I18nService,
  ) {}

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => ChatsPaginatedResponse, { name: 'chats' })
  async findAll(
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
    @UserRole() role: string,
    @Args({ nullable: true }) paginationArgs: CursorPaginationArgs,
    @Args('filter', { nullable: true }) filter?: ChatFilterInput,
  ) {
    const params = await this.getFindParams(userId, organizationId, filter);
    if (!params)
      return { items: [], hasMore: false, nextCursorId: null, nextCursorCreatedAt: null };

    return this.chatService.findChatsByParams(
      { ...params },
      userId,
      role,
      organizationId,
      paginationArgs,
    );
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => Int, { name: 'chatCount' })
  async count(
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
    @UserRole() role: string,
  ) {
    const params = await this.getFindParams(userId, organizationId);
    if (!params) return 0;

    return this.chatService.findChatCountByParams({ ...params }, userId, role, organizationId);
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => Int, { name: 'unassignedChatCount' })
  async unassignedChatCount(
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
  ) {
    const params = await this.getFindParams(userId, organizationId);
    if (!params) return 0;

    return this.chatService.findUnassignedChatCount({ ...params }, organizationId);
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => Chat, { nullable: true })
  async chatHistory(
    @UserOrganizationId() organizationId: string,
    @Args('id', { type: () => String }) id: string,
    @UserId() userId: string,
    @UserRole() role: string,
  ) {
    const params = await this.getFindParams(userId, organizationId);
    if (!params) return null;

    const chat = await this.chatService.findOneIfAccessible(
      id,
      { ...params },
      userId,
      role,
      organizationId,
    );

    if (!chat) {
      throw new ForbiddenException(this.i18n.t('errors.chat.notFound'));
    }

    return chat;
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => ChatItemPaginatedResponse)
  async chatData(
    @UserOrganizationId() organizationId: string,
    @Args('chatId') chatId: string,
    @Args() paginationArgs: CursorPaginationArgs,
  ) {
    return this.chatService.getChatData(chatId, organizationId, paginationArgs);
  }

  @Roles(allOperatorRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => ChatMessage)
  async sendMessage(
    @Args('chatMessageInput') chatMessageInput: ChatMessageInput,
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
  ) {
    await this.validateChatMessageSend(chatMessageInput.chatId, userId, organizationId);
    return await this.chatService.sendMessageToEndUser(chatMessageInput, userId, organizationId);
  }

  @Roles(allOperatorRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => ChatMessage)
  async sendUploadLink(
    @Args('input') input: ShareUploadLinkInput,
    @UserId() userId: string,
    @UserOrganizationId() organizationId: string,
  ) {
    await this.validateChatMessageSend(input.chatId, userId, organizationId);
    return await this.chatService.sendUploadLink(input.chatId, userId, organizationId);
  }

  @Roles(allOperatorRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => ChatMessage)
  async sendFileUploadedMessage(
    @Args('input') input: SendFileUploadedMessageInput,
    @UserId() userId: string,
    @UserOrganizationId() organizationId: string,
  ) {
    await this.validateChatMessageSend(input.chatId, userId, organizationId);
    return await this.chatService.sendFileUploadedMessage(input, userId, organizationId);
  }

  @Roles(allOperatorRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => ChatMessage)
  async sendMessageToLigla(
    @UserOrganizationId() organizationId: string,
    @Args('chatId') chatId: string,
    @Args('messageId') messageId: string,
    @UserId() userId: string,
  ) {
    await this.validateChatMessageSend(chatId, userId, organizationId);
    return await this.chatService.sendMessageToLigla(chatId, organizationId, messageId);
  }

  @Roles(allOperatorRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => ChatMessage)
  async retrySendMessage(
    @Args('retryMessageInput') retryMessageInput: RetryMessageInput,
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
  ) {
    await this.validateChatMessageSend(retryMessageInput.chatId, userId, organizationId);
    return await this.chatService.retrySendMessage(retryMessageInput, organizationId);
  }

  @Roles(allOperatorRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => Boolean)
  async deleteChatMessage(
    @Args('deleteMessageInput') deleteMessageInput: DeleteMessageInput,
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
  ) {
    const exceptionText = this.i18n.t('errors.chat.forbiddenDeleteMessage');

    await this.validateChatPermissions(
      deleteMessageInput.chatId,
      userId,
      organizationId,
      exceptionText,
      [UserRoleType.ADMIN_OPERATOR, UserRoleType.MANAGER_OPERATOR],
    );

    return await this.chatService.deleteChatMessage(deleteMessageInput, organizationId);
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => ChatActivity)
  async changeChatStatus(
    @Args('chatStatusInput') chatStatusInput: ChatStatusInput,
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
  ): Promise<ChatActivity> {
    const exceptionText = this.i18n.t('errors.chat.forbiddenChangeStatus');
    const { chatId, status: newStatus } = chatStatusInput;

    const chat = await this.validateChatPermissions(
      chatId,
      userId,
      organizationId,
      exceptionText,
      adminManagerRoles,
    );

    if (newStatus === ChatStatus.PENDING) {
      throw new ForbiddenException(this.i18n.t('errors.chat.forbiddenChangeStatusToPending'));
    }

    if (chat.chatStatus === newStatus) {
      throw new ForbiddenException(this.i18n.t('errors.chat.forbiddenChangeStatusToSameStatus'));
    }

    return await this.chatService.changeChatStatus(
      {
        chatId,
        oldStatus: chat.chatStatus,
        newStatus,
        userId,
        organizationId,
      },
      organizationId,
    );
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => Chat)
  async addChatTag(
    @Args('chatTagInput') chatTagInput: ChatTagInput,
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
  ) {
    const exceptionText = this.i18n.t('errors.chat.forbiddenAddTag');
    const { chatId } = chatTagInput;

    await this.validateChatPermissions(
      chatId,
      userId,
      organizationId,
      exceptionText,
      adminManagerRoles,
    );

    return this.chatService.addChatTag(chatTagInput, organizationId);
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => Chat)
  // @NotifyCore({
  //   type: ChatDataSyncType.USER_TAGS,
  //   buildPayload: (results) => ({
  //     userId: results.endUserId,
  //   }),
  // })
  async removeChatTag(
    @Args('chatTagInput') chatTagInput: ChatTagInput,
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
  ) {
    const exceptionText = this.i18n.t('errors.chat.forbiddenRemoveTag');
    const { chatId } = chatTagInput;

    await this.validateChatPermissions(
      chatId,
      userId,
      organizationId,
      exceptionText,
      adminManagerRoles,
    );

    return this.chatService.removeChatTag(chatTagInput, organizationId);
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => Chat)
  async updateChatLatestRead(
    @Args('chatLatestReadInput') chatLatestReadInput: ChatLatestReadInput,
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
  ) {
    const { chatId, timestamp } = chatLatestReadInput;
    const chat = await this.chatService.findRawOne(chatId, organizationId);

    if (!chat || chat.assignedUserId !== userId) {
      throw new ForbiddenException(this.i18n.t('errors.chat.accessDenied'));
    }

    return this.chatService.updateChatLatestRead(chatId, timestamp, organizationId, userId, true);
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => Chat)
  // @NotifyCore({
  //   type: ChatDataSyncType.USER_TAGS,
  //   buildPayload: (results) => ({
  //     userId: results.endUserId,
  //   }),
  // })
  async updateChatTags(
    @Args('updateChatTagsInput') updateChatTagsInput: UpdateChatTagsInput,
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
  ) {
    const { chatId, tagIds } = updateChatTagsInput;

    await this.validateChatPermissions(
      chatId,
      userId,
      organizationId,
      this.i18n.t('errors.chat.forbiddenSelectTags'),
      adminManagerRoles,
    );

    return this.chatService.updateChatTags(chatId, tagIds, organizationId);
  }

  private async getFindParams(
    userId: string,
    organizationId: string,
    filter?: ChatFilterInput,
  ): Promise<Nullable<ChatFilterInput>> {
    const user = await this.userService.findOne(userId, organizationId);
    const { teams, roleType } = user;

    if (adminRoles.includes(roleType)) {
      return filter || {};
    }

    const userTeamIds = (teams || []).map((team) => team.id);

    if (!userTeamIds.length) {
      return null;
    }

    const filterTeamIds = [...userTeamIds];

    if (filter?.teamIds?.length) {
      const intersectedTeamIds = filterTeamIds.filter((id) => (filter.teamIds || []).includes(id));
      return intersectedTeamIds.length ? { ...filter, teamIds: intersectedTeamIds } : null;
    }

    return {
      ...filter,
      teamIds: filterTeamIds,
    };
  }

  private async validateChatMessageSend(chatId: string, userId: string, organizationId: string) {
    const exceptionText = this.i18n.t('errors.chat.forbiddenSendMessage');

    const chat = await this.validateChatPermissions(chatId, userId, organizationId, exceptionText, [
      UserRoleType.ADMIN_OPERATOR,
      UserRoleType.MANAGER_OPERATOR,
    ]);

    if (chat.isUserBlocked) {
      throw new ForbiddenException(this.i18n.t('errors.chat.forbiddenSendMessageToBlockedUser'));
    }
    if (chat.chatStatus === ChatStatus.DONE) {
      throw new ForbiddenException(this.i18n.t('errors.chat.forbiddenSendMessageToDone'));
    }
  }

  private async validateChatPermissions(
    chatId: string,
    userId: string,
    organizationId: string,
    exceptionText: string,
    higherPrivilegesRoles?: string[],
  ) {
    const chat = await this.chatService.findRawOne(chatId, organizationId);

    if (chat.assignedUserId !== userId) {
      const user = await this.userService.findRawOne(userId, organizationId);

      if (higherPrivilegesRoles && higherPrivilegesRoles.includes(user.roleType)) {
        return chat;
      }

      throw new ForbiddenException(exceptionText);
    }

    return chat;
  }
}
