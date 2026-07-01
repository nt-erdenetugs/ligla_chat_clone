import { UseGuards } from '@nestjs/common';
import { Resolver, Query, Args, Mutation } from '@nestjs/graphql';

import { Roles } from '@/common/decorators/roles.decorator';
import { UserOrganizationId } from '@/common/decorators/user.decorator';
import { GqlThrottlerGuard } from '@/common/guards/graphql-throttler.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { RoleGuard } from '@/common/guards/role.guard';
import { AuthGuard } from '@/modules/auth/auth.guard';
import { adminManagerRoles, adminRoles, allUserRoles } from '@/modules/auth/constants';

import { UpdateSurveySettingInput } from './dto/update-survey-setting.input';
import { Survey, SurveyColumn } from './entities/survey.entity';
import { SurveyService } from './survey.service';

@UseGuards(GqlThrottlerGuard)
@Resolver(() => SurveyColumn)
export class SurveyResolver {
  constructor(private readonly surveyService: SurveyService) {}

  @Roles(adminManagerRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => [SurveyColumn], { name: 'surveyColumns' })
  findSurveyColumns(@UserOrganizationId() organizationId: string) {
    return this.surveyService.findSurveyColumns(organizationId);
  }

  @Roles(allUserRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Query(() => [Survey], { name: 'surveys', nullable: true })
  findSurveys(@UserOrganizationId() organizationId: string, @Args('chatId') chatId: string) {
    return this.surveyService.findSurveys(organizationId, chatId);
  }

  @Roles(adminRoles)
  @UseGuards(AuthGuard, RoleGuard, OrganizationGuard)
  @Mutation(() => [SurveyColumn])
  async updateSurveySetting(
    @Args('updateSurveySettingInput')
    updateSurveySettingInput: UpdateSurveySettingInput,
    @UserOrganizationId() organizationId: string,
  ) {
    return this.surveyService.updateSurveySetting(updateSurveySettingInput, organizationId);
  }
}
