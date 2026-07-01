import { Module } from '@nestjs/common';

import { HypervisorService } from './hypervisor.service';

@Module({
  providers: [HypervisorService],
  exports: [HypervisorService],
})
export class HypervisorModule {}
