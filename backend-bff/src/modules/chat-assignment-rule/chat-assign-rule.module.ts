import { Module } from '@nestjs/common';

import { HypervisorModule } from '@/modules/hypervisor/hypervisor.module';
import { UserModule } from '@/modules/user/user.module';

import { ChatAssignRuleResolver } from './chat-assign-rule.resolver';
import { ChatAssignRuleService } from './chat-assign-rule.service';
import { ChatAssignFilterModule } from './chat-assignment-filter/chat-assign-filter.module';

@Module({
  imports: [UserModule, HypervisorModule, ChatAssignFilterModule],
  providers: [ChatAssignRuleResolver, ChatAssignRuleService],
  exports: [ChatAssignRuleService],
})
export class ChatAssignRuleModule {}
