import { Module } from '@nestjs/common';

import { ChatModule } from '@/modules/chat/chat.module';
import { HypervisorModule } from '@/modules/hypervisor/hypervisor.module';
import { UserModule } from '@/modules/user/user.module';

import { ChatReplyResolver } from './chat-reply.resolver';
import { ChatReplyService } from './chat-reply.service';

@Module({
  imports: [UserModule, HypervisorModule, ChatModule],
  providers: [ChatReplyResolver, ChatReplyService],
})
export class ChatReplyModule {}
