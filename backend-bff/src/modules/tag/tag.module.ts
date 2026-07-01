import { Module } from '@nestjs/common';

import { ChatModule } from '@/modules/chat/chat.module';
import { HypervisorModule } from '@/modules/hypervisor/hypervisor.module';
import { UserModule } from '@/modules/user/user.module';

import { TagResolver } from './tag.resolver';
import { TagService } from './tag.service';

@Module({
  imports: [UserModule, ChatModule, HypervisorModule],
  providers: [TagResolver, TagService],
  exports: [TagService],
})
export class TagModule {}
