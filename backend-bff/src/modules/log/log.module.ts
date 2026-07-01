import { Module } from '@nestjs/common';

import { FileService } from '@/modules/file/file.service';
import { HypervisorModule } from '@/modules/hypervisor/hypervisor.module';
import { MailService } from '@/modules/mail/mail.service';
import { TeamService } from '@/modules/team/team.service';
import { UserService } from '@/modules/user/user.service';

import { LogController } from './log.controller';

@Module({
  imports: [HypervisorModule],
  controllers: [LogController],
  providers: [UserService, TeamService, FileService, MailService],
})
export class LogModule {}
