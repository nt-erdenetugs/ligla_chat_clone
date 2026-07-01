import { Module } from '@nestjs/common';

import { HypervisorModule } from '@/modules/hypervisor/hypervisor.module';
import { UserModule } from '@/modules/user/user.module';

import { SurveyResolver } from './survey.resolver';
import { SurveyService } from './survey.service';

@Module({
  imports: [UserModule, HypervisorModule],
  providers: [SurveyResolver, SurveyService],
  exports: [SurveyService],
})
export class SurveyModule {}
