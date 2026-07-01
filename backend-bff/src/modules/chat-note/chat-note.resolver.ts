import { UseGuards } from '@nestjs/common';
import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';

import { Roles } from '@/common/decorators/roles.decorator';
import { UserId, UserOrganizationId, UserRole } from '@/common/decorators/user.decorator';
import { GqlThrottlerGuard } from '@/common/guards/graphql-throttler.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { RoleGuard } from '@/common/guards/role.guard';
import { AuthGuard } from '@/modules/auth/auth.guard';
import { allUserRoles } from '@/modules/auth/constants';

import { ChatNoteService } from './chat-note.service';
import { CreateChatNoteInput } from './dto/create-chat-note.input';
import { UpdateChatNoteInput } from './dto/update-chat-note.input';
import { ChatNote } from './entities/chat-note.entity';

@UseGuards(GqlThrottlerGuard)
@Resolver(() => ChatNote)
export class ChatNoteResolver {
  constructor(private readonly noteService: ChatNoteService) {}

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => [ChatNote], { name: 'notes' })
  findByChatId(
    @UserOrganizationId() organizationId: string,
    @Args('chatId', { type: () => String }) chatId: string,
  ) {
    return this.noteService.findByChatId(chatId, organizationId);
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => ChatNote)
  createNote(
    @Args('createNoteInput') createNoteInput: CreateChatNoteInput,
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
    @UserRole() role: string,
  ) {
    return this.noteService.create(createNoteInput, userId, organizationId, role);
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => ChatNote)
  updateNote(
    @Args('updateNoteInput') updateNoteInput: UpdateChatNoteInput,
    @UserOrganizationId() organizationId: string,
    @UserId() userId: string,
    @UserRole() role: string,
  ) {
    return this.noteService.update(updateNoteInput, userId, role, organizationId);
  }

  @Roles(allUserRoles)
  @Mutation(() => ChatNote)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  removeNote(
    @UserOrganizationId() organizationId: string,
    @Args('id', { type: () => String }) id: string,
    @Args('chatId', { type: () => String }) chatId: string,
    @UserId() userId: string,
    @UserRole() role: string,
  ) {
    return this.noteService.remove(organizationId, id, chatId, userId, role);
  }
}
