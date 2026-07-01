import { Module } from '@nestjs/common';

import { FileService } from '@/modules/file/file.service';
import { HypervisorService } from '@/modules/hypervisor/hypervisor.service';
import { MailService } from '@/modules/mail/mail.service';
import { TeamService } from '@/modules/team/team.service';
import { UserService } from '@/modules/user/user.service';

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    UserService,
    TeamService,
    FileService,
    MailService,
    HypervisorService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
