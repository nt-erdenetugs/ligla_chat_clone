import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { secretManagerFactory } from './secret-manager.factory';

@Global()
@Module({
  providers: [
    {
      provide: ConfigService,
      useFactory: secretManagerFactory,
    },
  ],
  exports: [ConfigService],
})
export class ConfigModule {}
