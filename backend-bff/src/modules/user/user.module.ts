import { Module, forwardRef } from '@nestjs/common';

import { FileService } from '@/modules/file/file.service';
import { HypervisorService } from '@/modules/hypervisor/hypervisor.service';
import { MailService } from '@/modules/mail/mail.service';
import { OrganizationModule } from '@/modules/organization/organization.module';
import { TeamModule } from '@/modules/team/team.module';

import { UserResolver } from './user.resolver';
import { UserService } from './user.service';

@Module({
  imports: [TeamModule, forwardRef(() => OrganizationModule)],
  providers: [UserResolver, UserService, HypervisorService, FileService, MailService],
  exports: [UserService],
})
export class UserModule {}
