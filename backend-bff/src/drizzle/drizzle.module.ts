import { Global, Module } from '@nestjs/common';
import { drizzleProvider, DRIZZLE_DB } from './drizzle.provider';
import { DrizzleService } from './drizzle.service';
import { TenantSchemaService } from './tenant-schema.service';

@Global()
@Module({
  providers: [...drizzleProvider, DrizzleService, TenantSchemaService],
  exports: [DRIZZLE_DB, TenantSchemaService],
})
export class DrizzleModule {}
