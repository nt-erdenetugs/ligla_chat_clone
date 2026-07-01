import { UseGuards } from '@nestjs/common';
import { Resolver, Query, Args, Mutation } from '@nestjs/graphql';

import { Roles } from '@/common/decorators/roles.decorator';
import { UserOrganizationId } from '@/common/decorators/user.decorator';
import { GqlThrottlerGuard } from '@/common/guards/graphql-throttler.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { RoleGuard } from '@/common/guards/role.guard';
import { AuthGuard } from '@/modules/auth/auth.guard';
import { adminManagerRoles, adminRoles, allUserRoles } from '@/modules/auth/constants';

import { UpdateMemberFeedSettingInput } from './dto/update-member-feed-setting.input';
import { MemberFeed, MemberFeedColumn } from './entities/member-feed.entity';
import { MemberFeedService } from './member-feed.service';

@UseGuards(GqlThrottlerGuard)
@Resolver(() => MemberFeedColumn)
export class MemberFeedResolver {
  constructor(private readonly memberFeedService: MemberFeedService) {}

  @Roles(adminManagerRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => [MemberFeedColumn], { name: 'memberFeedColumns' })
  findMemberFeedColumns(@UserOrganizationId() organizationId: string) {
    return this.memberFeedService.findMemberFeedColumns(organizationId);
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => [MemberFeed], { name: 'memberFeeds', nullable: true })
  findMemberFeeds(
    @UserOrganizationId() organizationId: string,
    @Args('clientUserId', { nullable: true }) clientUserId: string,
  ) {
    return this.memberFeedService.findMemberFeeds(organizationId, clientUserId);
  }

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => [MemberFeedColumn])
  async updateMemberFeedSetting(
    @Args('updateMemberFeedSettingInput')
    updateMemberFeedSettingInput: UpdateMemberFeedSettingInput,
    @UserOrganizationId() organizationId: string,
  ) {
    return this.memberFeedService.updateMemberFeedSetting(
      updateMemberFeedSettingInput,
      organizationId,
    );
  }
}
