import { Module } from '@nestjs/common';

import { HypervisorModule } from '@/modules/hypervisor/hypervisor.module';
import { LiglaModule } from '@/modules/ligla/ligla.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { OrganizationModule } from '@/modules/organization/organization.module';
import { TagService } from '@/modules/tag/tag.service';
import { UserModule } from '@/modules/user/user.module';

import { ChatEventController } from './chat.controller';
import { ChatResolver } from './chat.resolver';
import { ChatService } from './chat.service';

@Module({
  imports: [HypervisorModule, NotificationsModule, UserModule, LiglaModule, OrganizationModule],
  controllers: [ChatEventController],
  providers: [ChatService, ChatResolver, TagService],
  exports: [ChatService],
})
export class ChatModule {}
