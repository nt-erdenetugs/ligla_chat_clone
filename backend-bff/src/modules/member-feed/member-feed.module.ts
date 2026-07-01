import { Module } from '@nestjs/common';

import { HypervisorModule } from '@/modules/hypervisor/hypervisor.module';
import { UserModule } from '@/modules/user/user.module';

import { MemberFeedResolver } from './member-feed.resolver';
import { MemberFeedService } from './member-feed.service';

@Module({
  imports: [UserModule, HypervisorModule],
  providers: [MemberFeedResolver, MemberFeedService],
  exports: [MemberFeedService],
})
export class MemberFeedModule {}
