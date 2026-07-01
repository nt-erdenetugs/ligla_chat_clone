import { Module } from '@nestjs/common';

import { HypervisorModule } from '@/modules/hypervisor/hypervisor.module';
import { UserModule } from '@/modules/user/user.module';

import { ChatNoteResolver } from './chat-note.resolver';
import { ChatNoteService } from './chat-note.service';

@Module({
  imports: [UserModule, HypervisorModule],
  providers: [ChatNoteResolver, ChatNoteService],
  exports: [ChatNoteService],
})
export class ChatNoteModule {}
