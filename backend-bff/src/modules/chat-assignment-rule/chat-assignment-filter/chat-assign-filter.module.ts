import { Module } from '@nestjs/common';

import { HypervisorModule } from '@/modules/hypervisor/hypervisor.module';
import { UserModule } from '@/modules/user/user.module';

import { ChatAssignFilterResolver } from './chat-assign-filter.resolver';
import { ChatAssignFilterService } from './chat-assign-filter.service';

@Module({
  imports: [UserModule, HypervisorModule],
  providers: [ChatAssignFilterResolver, ChatAssignFilterService],
  exports: [ChatAssignFilterService],
})
export class ChatAssignFilterModule {}
