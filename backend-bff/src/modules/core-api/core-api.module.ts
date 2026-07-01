import { Global, Module } from '@nestjs/common';

import { CoreApiService } from './core-api.service';

@Global()
@Module({
  providers: [CoreApiService],
  exports: [CoreApiService],
})
export class CoreApiModule {}
