import { DRIZZLE_DB, DrizzleDB } from './drizzle.provider';

export type DrizzleTransaction = Parameters<Parameters<DrizzleDB['transaction']>[0]>[0];

export { DRIZZLE_DB, type DrizzleDB };
export { DrizzleModule } from './drizzle.module';
export { InjectDrizzle } from './inject-drizzle.decorator';
export { TenantSchemaService } from './tenant-schema.service';
