import { Global, Module } from '@nestjs/common';

import { DrizzleModule } from '@/drizzle';

import { EncryptionService } from './encryption.service';

@Global()
@Module({
  imports: [DrizzleModule],
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class EncryptionModule {}
