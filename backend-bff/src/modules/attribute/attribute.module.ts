import { Module } from '@nestjs/common';

import { HypervisorModule } from '@/modules/hypervisor/hypervisor.module';
import { UserModule } from '@/modules/user/user.module';

import { AttributeResolver } from './attribute.resolver';
import { AttributeService } from './attribute.service';

@Module({
  imports: [UserModule, HypervisorModule],
  providers: [AttributeResolver, AttributeService],
  exports: [AttributeService],
})
export class AttributeModule {}
