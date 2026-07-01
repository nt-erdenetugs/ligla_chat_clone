import { Module } from '@nestjs/common';

import { HypervisorModule } from '@/modules/hypervisor/hypervisor.module';
import { UserModule } from '@/modules/user/user.module';

import { FileController } from './file.controller';
import { FileService } from './file.service';

@Module({
  imports: [HypervisorModule, UserModule],
  controllers: [FileController],
  providers: [FileService],
  exports: [FileService],
})
export class FileModule {}
