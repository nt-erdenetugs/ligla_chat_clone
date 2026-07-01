import { Global, Module } from '@nestjs/common';

import { ChatDataSyncService } from './chat-data-sync.service';

@Global()
@Module({
  providers: [ChatDataSyncService],
  exports: [ChatDataSyncService],
})
export class ChatDataSyncModule {}
