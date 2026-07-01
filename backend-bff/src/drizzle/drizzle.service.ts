import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { DRIZZLE_POOL } from './drizzle.provider';

@Injectable()
export class DrizzleService implements OnModuleDestroy {
  private readonly logger = new Logger(DrizzleService.name);

  constructor(@Inject(DRIZZLE_POOL) private readonly pool: Pool) {}

  async onModuleDestroy() {
    this.logger.log('Closing Drizzle database connection pool');
    await this.pool.end();
    this.logger.log('Drizzle database connection pool closed');
  }

  getPool(): Pool {
    return this.pool;
  }
}
