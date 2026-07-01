import { Module } from '@nestjs/common';

import { HypervisorModule } from '@/modules/hypervisor/hypervisor.module';
import { UserModule } from '@/modules/user/user.module';

import { OperatorController } from './operator.controller';

@Module({
  imports: [UserModule, HypervisorModule],
  controllers: [OperatorController],
})
export class OperatorModule {}
