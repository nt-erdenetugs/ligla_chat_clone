import { UseGuards } from '@nestjs/common';
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';

import { EndUserId, EndUserOrganizationId } from '@/common/decorators/end-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserOrganizationId, UserId } from '@/common/decorators/user.decorator';
import { CursorPaginationArgs } from '@/common/dto/pagination.args';
import { GqlThrottlerGuard } from '@/common/guards/graphql-throttler.guard';
import { LiffGuard } from '@/common/guards/liff.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { RoleGuard } from '@/common/guards/role.guard';

import { AuthGuard } from '../auth/auth.guard';
import { allOperatorRoles, allUserRoles } from '../auth/constants';

import { ChatFileService } from './chat-file.service';
import { ChatFileListEndUserArgs } from './dto/chat-file-list-enduser.args';
import { ChatFileListArgs } from './dto/chat-file-list.args';
import { ConfirmChatFileUploadEndUserInput } from './dto/confirm-chat-file-upload-enduser.input';
import { ConfirmChatFileUploadInput } from './dto/confirm-chat-file-upload.input';
import { DeleteChatFileEndUserInput } from './dto/delete-chat-file-enduser.input';
import { DeleteChatFileInput } from './dto/delete-chat-file.input';
import { DownloadChatFileEndUserInput } from './dto/download-chat-file-enduser.input';
import { UploadChatFileEndUserInput } from './dto/upload-chat-file-enduser.input';
import { UploadChatFileInput } from './dto/upload-chat-file.input';
import { ChatFileDownloadUrlResponse } from './entities/chat-file-download-url.response';
import { ChatFileListResponse } from './entities/chat-file-list.response';
import { ChatFileUploadResponse } from './entities/chat-file-upload.response';
import { ChatFile } from './entities/chat-file.entity';
import { ConfirmChatFileUploadResponse } from './entities/confirm-chat-file-upload.response';
import { DeleteChatFileResponse } from './entities/delete-chat-file.response';

@UseGuards(GqlThrottlerGuard)
@Resolver(() => ChatFile)
export class ChatFileResolver {
  constructor(private readonly chatFileService: ChatFileService) {}

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => ChatFileListResponse, { name: 'chatFiles' })
  async getChatFiles(
    @Args() args: ChatFileListArgs,
    @Args() paginationArgs: CursorPaginationArgs,
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
  ): Promise<ChatFileListResponse> {
    return this.chatFileService.listChatFilesForOperator(args, paginationArgs, {
      organizationId,
      userId,
    });
  }

  @Roles(allOperatorRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => ChatFileUploadResponse, { name: 'uploadChatFile' })
  async uploadChatFile(
    @Args('input') input: UploadChatFileInput,
    @UserId() uploaderOperatorId: string,
    @UserOrganizationId() organizationId: string,
  ) {
    return this.chatFileService.prepareUploadChatFile(input, uploaderOperatorId, organizationId);
  }

  @Roles(allOperatorRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => ConfirmChatFileUploadResponse, { name: 'confirmChatFileUpload' })
  async confirmChatFileUpload(
    @Args('input') { fileId }: ConfirmChatFileUploadInput,
    @UserOrganizationId() organizationId: string,
    @UserId() operatorId: string,
  ) {
    return this.chatFileService.confirmChatFileUploadForOperator({
      fileId,
      organizationId,
      operatorId,
    });
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => DeleteChatFileResponse, { name: 'deleteChatFile' })
  async deleteChatFile(
    @Args('input') input: DeleteChatFileInput,
    @UserId() userId: string,
    @UserOrganizationId() organizationId: string,
  ) {
    return this.chatFileService.deleteChatFile({
      fileId: input.fileId,
      userId,
      organizationId,
    });
  }

  @UseGuards(LiffGuard)
  @Mutation(() => ChatFileUploadResponse, { name: 'uploadChatFileForEndUser' })
  async uploadChatFileForEndUser(
    @Args('input') input: UploadChatFileEndUserInput,
    @EndUserId() endUserId: string,
    @EndUserOrganizationId() organizationId: string,
  ) {
    return this.chatFileService.prepareUploadChatFileForEndUser(input, endUserId, organizationId);
  }

  @UseGuards(LiffGuard)
  @Mutation(() => ConfirmChatFileUploadResponse, { name: 'confirmChatFileUploadForEndUser' })
  async confirmChatFileUploadForEndUser(
    @Args('input') { fileId }: ConfirmChatFileUploadEndUserInput,
    @EndUserId() endUserId: string,
    @EndUserOrganizationId() organizationId: string,
  ) {
    return this.chatFileService.confirmChatFileUploadForEndUser({
      fileId,
      endUserId,
      organizationId,
    });
  }

  @UseGuards(LiffGuard)
  @Mutation(() => DeleteChatFileResponse, { name: 'deleteChatFileForEndUser' })
  async deleteChatFileForEndUser(
    @Args('input') input: DeleteChatFileEndUserInput,
    @EndUserId() endUserId: string,
    @EndUserOrganizationId() organizationId: string,
  ) {
    return this.chatFileService.deleteChatFileForEndUser({
      fileId: input.fileId,
      endUserId,
      organizationId,
    });
  }

  @UseGuards(LiffGuard)
  @Query(() => ChatFileListResponse, { name: 'chatFilesForEndUser' })
  async getChatFilesForEndUser(
    @Args() _args: ChatFileListEndUserArgs,
    @Args() paginationArgs: CursorPaginationArgs,
    @EndUserId() endUserId: string,
    @EndUserOrganizationId() organizationId: string,
  ): Promise<ChatFileListResponse> {
    return this.chatFileService.listChatFilesForEndUser(
      { endUserId, organizationId },
      paginationArgs,
    );
  }

  @UseGuards(LiffGuard)
  @Query(() => ChatFileDownloadUrlResponse, { name: 'chatFileDownloadUrlForEndUser' })
  async getChatFileDownloadUrlForEndUser(
    @Args('input') input: DownloadChatFileEndUserInput,
    @EndUserId() endUserId: string,
    @EndUserOrganizationId() organizationId: string,
  ): Promise<ChatFileDownloadUrlResponse> {
    return this.chatFileService.getDownloadUrlForEndUser(input.fileId, endUserId, organizationId);
  }
}
