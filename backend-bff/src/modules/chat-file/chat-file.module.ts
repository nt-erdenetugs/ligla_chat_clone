import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FileModule } from '../file/file.module';
import { HypervisorModule } from '../hypervisor/hypervisor.module';
import { LiffModule } from '../liff/liff.module';
import { UserModule } from '../user/user.module';

import { ChatFileStorageService } from './chat-file-storage.service';
import { ChatFileController } from './chat-file.controller';
import { ChatFileResolver } from './chat-file.resolver';
import { ChatFileService } from './chat-file.service';

@Module({
  imports: [FileModule, AuthModule, UserModule, HypervisorModule, LiffModule],
  controllers: [ChatFileController],
  providers: [ChatFileResolver, ChatFileService, ChatFileStorageService],
  exports: [ChatFileService],
})
export class ChatFileModule {}
