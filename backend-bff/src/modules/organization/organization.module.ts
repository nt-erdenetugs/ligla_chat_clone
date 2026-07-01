import { Module, forwardRef } from '@nestjs/common';

import { HypervisorModule } from '@/modules/hypervisor/hypervisor.module';
import { TeamModule } from '@/modules/team/team.module';
import { UserModule } from '@/modules/user/user.module';

import { OrganizationResolver } from './organization.resolver';
import { OrganizationService } from './organization.service';

@Module({
  imports: [forwardRef(() => UserModule), TeamModule, HypervisorModule],
  providers: [OrganizationResolver, OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
