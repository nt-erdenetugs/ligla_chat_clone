import { Module } from '@nestjs/common';

import { HypervisorModule } from '@/modules/hypervisor/hypervisor.module';
import { OrganizationModule } from '@/modules/organization/organization.module';
import { UserModule } from '@/modules/user/user.module';

import { StoreResolver } from './store.resolver';
import { StoreService } from './store.service';

@Module({
  imports: [UserModule, HypervisorModule, OrganizationModule],
  providers: [StoreResolver, StoreService],
  exports: [StoreService],
})
export class StoreModule {}
