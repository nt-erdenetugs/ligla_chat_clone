import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Resolver, Query, Args, Mutation } from '@nestjs/graphql';

import { I18nService } from 'nestjs-i18n';

import { Roles } from '@/common/decorators/roles.decorator';
import { UserOrganizationId } from '@/common/decorators/user.decorator';
import { FilterInput } from '@/common/dto/filter.args';
import {
  createCursorPaginatedResponse,
  CursorPaginationArgs,
  PaginationArgs,
} from '@/common/dto/pagination.args';
import { GqlThrottlerGuard } from '@/common/guards/graphql-throttler.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { RoleGuard } from '@/common/guards/role.guard';
import { AuthGuard } from '@/modules/auth/auth.guard';
import { adminRoles, allUserRoles } from '@/modules/auth/constants';

import { CreateTagInput } from './dto/create-tag.input';
import { TagsWithCount } from './dto/tags-with-count.dto';
import { UpdateTagInput } from './dto/update-tag.input';
import { Tag } from './entities/tag.entity';
import { TagService } from './tag.service';
// import { NotifyCore } from '@/common/Interceptor/notify-core.interceptor';
// import { ChatDataSyncType } from '../chat-data-sync/dto/notify-core.input';

const TagsCursorPaginatedResponse = createCursorPaginatedResponse(Tag);

@UseGuards(GqlThrottlerGuard)
@Resolver(() => Tag)
export class TagResolver {
  constructor(
    private readonly tagService: TagService,
    private readonly i18n: I18nService,
  ) {}

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => TagsWithCount, { name: 'tags' })
  async findAll(
    @Args() paginationArgs: PaginationArgs,
    @UserOrganizationId() organizationId: string,
    @Args('filter', { nullable: true }) filter?: FilterInput,
  ) {
    return this.tagService.findAll(paginationArgs, organizationId, filter);
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => TagsCursorPaginatedResponse, { name: 'cursorPaginatedTags' })
  findAllCursorPaginated(
    @Args() paginationArgs: CursorPaginationArgs,
    @UserOrganizationId() organizationId: string,
  ) {
    return this.tagService.findAllCursorPaginated(paginationArgs, organizationId);
  }

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => Tag, { name: 'tag' })
  findOneById(@UserOrganizationId() organizationId: string, @Args('id') id: string) {
    return this.tagService.findOneById(organizationId, id);
  }

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => Tag)
  // @NotifyCore({
  //   type: ChatDataSyncType.TAGS,
  // })
  async createTag(
    @Args('createTagInput') createTagInput: CreateTagInput,
    @UserOrganizationId() organizationId: string,
  ) {
    return this.tagService.create(createTagInput, organizationId);
  }

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => Tag)
  // @NotifyCore({
  //   type: ChatDataSyncType.TAGS,
  // })
  async updateTag(
    @Args('updateTagInput') updateTagInput: UpdateTagInput,
    @UserOrganizationId() organizationId: string,
  ) {
    return this.tagService.update(updateTagInput, organizationId);
  }

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => Tag)
  // @NotifyCore({
  //   type: ChatDataSyncType.TAGS,
  // })
  async toggleTagStatus(
    @UserOrganizationId() organizationId: string,
    @Args('id', { type: () => String }) id: string,
  ) {
    const tag = await this.tagService.findOneById(organizationId, id);

    const isActive = !tag.isActive;
    return this.tagService.update({ ...tag, isActive }, organizationId);
  }

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => Tag)
  // @NotifyCore({
  //   type: ChatDataSyncType.TAGS,
  // })
  async disableTag(
    @UserOrganizationId() organizationId: string,
    @Args('id', { type: () => String }) id: string,
  ) {
    const tag = await this.tagService.findOneById(organizationId, id);

    if (!tag.isActive) {
      throw new ForbiddenException(this.i18n.t('errors.tag.alreadyDisabled'));
    }

    return this.tagService.disable(organizationId, id);
  }
}
