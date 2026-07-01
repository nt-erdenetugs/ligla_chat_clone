import { Module } from '@nestjs/common';

import { ChatService } from '@/modules/chat/chat.service';
import { FileService } from '@/modules/file/file.service';
import { HypervisorService } from '@/modules/hypervisor/hypervisor.service';
import { LiglaService } from '@/modules/ligla/ligla.service';
import { MailService } from '@/modules/mail/mail.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { OrganizationService } from '@/modules/organization/organization.service';
import { UserService } from '@/modules/user/user.service';

import { TeamResolver } from './team.resolver';
import { TeamService } from './team.service';

@Module({
  providers: [
    TeamResolver,
    TeamService,
    ChatService,
    UserService,
    LiglaService,
    NotificationsService,
    FileService,
    MailService,
    HypervisorService,
    OrganizationService,
  ],
  exports: [TeamService],
})
export class TeamModule {}
