import { Module } from '@nestjs/common';

import { ChatModule } from '@/modules/chat/chat.module';
import { HypervisorModule } from '@/modules/hypervisor/hypervisor.module';
import { TeamModule } from '@/modules/team/team.module';
import { UserModule } from '@/modules/user/user.module';

import { ChatAssignmentResolver } from './chat-assignment.resolver';
import { ChatAssignmentService } from './chat-assignment.service';

@Module({
  imports: [ChatModule, TeamModule, UserModule, HypervisorModule],
  providers: [ChatAssignmentResolver, ChatAssignmentService],
  exports: [ChatAssignmentService],
})
export class ChatAssignmentModule {}
